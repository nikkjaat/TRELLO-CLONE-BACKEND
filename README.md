# Task Manager Backend API

A robust Node.js and Express.js backend API for the Task Manager application with real-time features using Socket.IO.

## 🚀 Features

- **User Authentication & Authorization** (JWT-based)
- **Role-based Access Control** (Admin, Vendor, Customer)
- **Complete Task Management** (CRUD operations)
- **Real-time Updates** (Socket.IO)
- **Comments System** with real-time chat
- **Subtask Management**
- **Time Tracking**
- **Bulk Operations**
- **Advanced Filtering & Search**
- **Statistics & Analytics**
- **Input Validation & Security**

## 🛠️ Tech Stack

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM
- **Socket.IO** - Real-time communication
- **JWT** - Authentication
- **bcryptjs** - Password hashing
- **express-validator** - Input validation
- **helmet** - Security headers
- **cors** - Cross-origin resource sharing

## 📦 Installation

1. **Install dependencies:**
   ```bash
   cd server
   npm install
   ```

2. **Environment Setup:**
   - Copy `.env.example` to `.env`
   - Update the environment variables:
     ```env
     MONGODB_URI=mongodb://localhost:27017/taskmanager
     JWT_SECRET=your_super_secret_jwt_key_here
     JWT_EXPIRE=7d
     PORT=5000
     NODE_ENV=development
     CLIENT_URL=http://localhost:5173
     ```

3. **Database Setup:**
   - Install MongoDB locally or use MongoDB Atlas
   - Update `MONGODB_URI` in `.env` file

4. **Start the server:**
   ```bash
   # Development mode with auto-restart
   npm run dev
   
   # Production mode
   npm start
   ```

## 🔗 API Endpoints

### Authentication Routes (`/api/auth`)
- `POST /register` - Register new user
- `POST /login` - User login
- `GET /me` - Get current user profile
- `PUT /profile` - Update user profile
- `PUT /change-password` - Change password
- `POST /logout` - Logout user

### Task Routes (`/api/tasks`)
- `GET /` - Get all tasks (with filtering)
- `GET /stats` - Get task statistics
- `GET /overdue` - Get overdue tasks
- `GET /:id` - Get single task
- `POST /` - Create new task
- `PUT /:id` - Update task
- `DELETE /:id` - Delete task
- `PUT /bulk/update` - Bulk update tasks
- `DELETE /bulk/delete` - Bulk delete tasks
- `POST /:id/comments` - Add comment to task
- `PUT /:id/subtasks/:subtaskId` - Update subtask

### User Routes (`/api/users`)
- `GET /` - Get all users
- `GET /stats` - Get user statistics (Admin only)
- `GET /:id` - Get single user
- `PUT /:id` - Update user (Admin only)
- `DELETE /:id` - Delete user (Admin only)

## 🔐 Authentication & Authorization

### JWT Token
Include JWT token in request headers:
```
Authorization: Bearer <your_jwt_token>
```

### User Roles
- **Admin**: Full access to all resources
- **Vendor**: Can create tasks, manage assigned tasks
- **Customer**: Can only view and update assigned tasks

## 🔌 Real-time Features (Socket.IO)

### Connection
```javascript
const socket = io('http://localhost:5000', {
  auth: {
    token: 'your_jwt_token'
  }
});
```

### Events
- `taskCreated` - New task created
- `taskUpdated` - Task updated
- `taskDeleted` - Task deleted
- `commentAdded` - New comment added
- `userTyping` - User typing indicator
- `userPresenceUpdate` - User online/offline status

## 📊 Data Models

### User Model
```javascript
{
  name: String,
  email: String,
  password: String (hashed),
  role: ['admin', 'vendor', 'customer'],
  avatar: String,
  isActive: Boolean,
  lastLogin: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### Task Model
```javascript
{
  title: String,
  description: String,
  priority: ['low', 'medium', 'high'],
  status: ['todo', 'inprogress', 'done'],
  assignee: String,
  assigneeId: ObjectId,
  createdBy: ObjectId,
  dueDate: Date,
  tags: [String],
  subtasks: [SubtaskSchema],
  timeSpent: Number,
  comments: [CommentSchema],
  isArchived: Boolean,
  completedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

## 🛡️ Security Features

- **Helmet.js** - Security headers
- **Rate Limiting** - Prevent abuse
- **Input Validation** - Sanitize user input
- **Password Hashing** - bcryptjs
- **JWT Authentication** - Secure token-based auth
- **CORS Configuration** - Controlled cross-origin access

## 🚦 Error Handling

The API uses consistent error response format:
```javascript
{
  success: false,
  message: "Error description",
  errors: [] // Validation errors (if any)
}
```

## 📈 Performance Features

- **Database Indexing** - Optimized queries
- **Pagination** - Efficient data loading
- **Aggregation Pipelines** - Complex statistics
- **Connection Pooling** - MongoDB optimization

## 🧪 Testing

Health check endpoint:
```
GET /api/health
```

Response:
```javascript
{
  success: true,
  message: "Server is running successfully",
  timestamp: "2024-01-01T00:00:00.000Z",
  environment: "development"
}
```

## 🔧 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/taskmanager` |
| `JWT_SECRET` | JWT signing secret | Required |
| `JWT_EXPIRE` | JWT expiration time | `7d` |
| `PORT` | Server port | `5000` |
| `NODE_ENV` | Environment mode | `development` |
| `CLIENT_URL` | Frontend URL for CORS | `http://localhost:5173` |

## 📝 Development Notes

- Use `npm run dev` for development with auto-restart
- MongoDB must be running before starting the server
- Check console logs for connection status
- Use MongoDB Compass or similar tools for database management

## 🤝 Contributing

1. Follow the existing code structure
2. Add proper validation for new endpoints
3. Include error handling
4. Update documentation for new features
5. Test thoroughly before committing