import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Socket authentication middleware
const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user || !user.isActive) {
      return next(new Error('Authentication error: Invalid user'));
    }

    socket.user = user;
    next();
  } catch (error) {
    next(new Error('Authentication error: Invalid token'));
  }
};

// Setup Socket.IO event handlers
export const setupSocketHandlers = (io) => {
  // Authentication middleware
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    console.log(`✅ User ${socket.user.name} connected (${socket.user.role})`);

    // Join user to their personal room
    socket.join(`user_${socket.user._id}`);

    // Join user to role-based rooms
    socket.join(`role_${socket.user.role}`);

    // Handle joining task-specific rooms
    socket.on('joinTask', (taskId) => {
      socket.join(`task_${taskId}`);
      console.log(`📋 User ${socket.user.name} joined task ${taskId}`);
    });

    // Handle leaving task-specific rooms
    socket.on('leaveTask', (taskId) => {
      socket.leave(`task_${taskId}`);
      console.log(`📋 User ${socket.user.name} left task ${taskId}`);
    });

    // Handle real-time task updates
    socket.on('taskUpdate', (data) => {
      // Broadcast to all users in the task room
      socket.to(`task_${data.taskId}`).emit('taskUpdated', data);
      
      // Also broadcast to admins and vendors
      socket.to('role_admin').emit('taskUpdated', data);
      socket.to('role_vendor').emit('taskUpdated', data);
    });

    // Handle real-time comments
    socket.on('newComment', (data) => {
      // Broadcast to all users in the task room
      socket.to(`task_${data.taskId}`).emit('commentAdded', {
        taskId: data.taskId,
        comment: {
          ...data.comment,
          author: socket.user.name,
          authorId: socket.user._id,
          authorRole: socket.user.role,
          createdAt: new Date()
        }
      });
    });

    // Handle typing indicators for comments
    socket.on('typing', (data) => {
      socket.to(`task_${data.taskId}`).emit('userTyping', {
        taskId: data.taskId,
        user: {
          id: socket.user._id,
          name: socket.user.name
        },
        isTyping: data.isTyping
      });
    });

    // Handle task status changes
    socket.on('statusChange', (data) => {
      // Broadcast to all relevant users
      socket.to(`task_${data.taskId}`).emit('taskStatusChanged', data);
      socket.to('role_admin').emit('taskStatusChanged', data);
      socket.to('role_vendor').emit('taskStatusChanged', data);
    });

    // Handle user presence
    socket.on('updatePresence', (status) => {
      socket.broadcast.emit('userPresenceUpdate', {
        userId: socket.user._id,
        name: socket.user.name,
        status: status // 'online', 'away', 'busy'
      });
    });

    // Handle notifications
    socket.on('sendNotification', (data) => {
      // Send notification to specific user
      if (data.targetUserId) {
        socket.to(`user_${data.targetUserId}`).emit('notification', {
          type: data.type,
          message: data.message,
          from: socket.user.name,
          timestamp: new Date()
        });
      }
    });

    // Handle bulk operations
    socket.on('bulkOperation', (data) => {
      // Broadcast bulk operations to admins and vendors
      socket.to('role_admin').emit('bulkOperationPerformed', {
        operation: data.operation,
        taskIds: data.taskIds,
        performedBy: socket.user.name,
        timestamp: new Date()
      });
      
      if (socket.user.role !== 'admin') {
        socket.to('role_vendor').emit('bulkOperationPerformed', {
          operation: data.operation,
          taskIds: data.taskIds,
          performedBy: socket.user.name,
          timestamp: new Date()
        });
      }
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log(`❌ User ${socket.user.name} disconnected: ${reason}`);
      
      // Broadcast user offline status
      socket.broadcast.emit('userPresenceUpdate', {
        userId: socket.user._id,
        name: socket.user.name,
        status: 'offline'
      });
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error(`Socket error for user ${socket.user.name}:`, error);
    });

    // Send welcome message
    socket.emit('connected', {
      message: 'Connected to Task Manager',
      user: {
        id: socket.user._id,
        name: socket.user.name,
        role: socket.user.role
      }
    });
  });

  // Handle connection errors
  io.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
  });

  console.log('🔌 Socket.IO server initialized');
};

// Helper function to emit to specific users
export const emitToUser = (io, userId, event, data) => {
  io.to(`user_${userId}`).emit(event, data);
};

// Helper function to emit to specific role
export const emitToRole = (io, role, event, data) => {
  io.to(`role_${role}`).emit(event, data);
};

// Helper function to emit to task participants
export const emitToTask = (io, taskId, event, data) => {
  io.to(`task_${taskId}`).emit(event, data);
};