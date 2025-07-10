import { validationResult } from 'express-validator';
import User from '../models/User.js';
import Task from '../models/Task.js';
import { asyncHandler } from '../middleware/errorHandler.js';

// @desc    Get all users
// @route   GET /api/users
// @access  Private
export const getUsers = asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const {
    role,
    isActive,
    search,
    page = 1,
    limit = 50,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  // Build query
  let query = {};

  if (role) query.role = role;
  if (isActive !== undefined) query.isActive = isActive === 'true';
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }

  // Pagination
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  // Sort options
  const sortOptions = {};
  sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

  // Execute query
  const users = await User.find(query)
    .select('-password')
    .sort(sortOptions)
    .skip(skip)
    .limit(limitNum);

  // Get total count for pagination
  const total = await User.countDocuments(query);

  res.status(200).json({
    success: true,
    count: users.length,
    total,
    pagination: {
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum)
    },
    data: users
  });
});

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private
export const getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('-password');

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Get user's task statistics
  const taskStats = await Task.aggregate([
    { $match: { assigneeId: user._id, isArchived: false } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        todo: { $sum: { $cond: [{ $eq: ['$status', 'todo'] }, 1, 0] } },
        inprogress: { $sum: { $cond: [{ $eq: ['$status', 'inprogress'] }, 1, 0] } },
        done: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } },
        totalTimeSpent: { $sum: '$timeSpent' }
      }
    }
  ]);

  const userWithStats = {
    ...user.toObject(),
    taskStats: taskStats[0] || {
      total: 0,
      todo: 0,
      inprogress: 0,
      done: 0,
      totalTimeSpent: 0
    }
  };

  res.status(200).json({
    success: true,
    data: userWithStats
  });
});

// @desc    Update user (Admin only)
// @route   PUT /api/users/:id
// @access  Private (Admin)
export const updateUser = asyncHandler(async (req, res) => {
  const { name, email, role, isActive } = req.body;

  const user = await User.findById(req.params.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Check if email is already taken by another user
  if (email && email !== user.email) {
    const existingUser = await User.findOne({ 
      email: email.toLowerCase(), 
      _id: { $ne: req.params.id } 
    });
    
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email is already taken'
      });
    }
  }

  // Update fields
  const fieldsToUpdate = {};
  if (name) fieldsToUpdate.name = name;
  if (email) fieldsToUpdate.email = email.toLowerCase();
  if (role) fieldsToUpdate.role = role;
  if (isActive !== undefined) fieldsToUpdate.isActive = isActive;

  const updatedUser = await User.findByIdAndUpdate(
    req.params.id,
    fieldsToUpdate,
    { new: true, runValidators: true }
  ).select('-password');

  res.status(200).json({
    success: true,
    message: 'User updated successfully',
    data: updatedUser
  });
});

// @desc    Delete user (Admin only)
// @route   DELETE /api/users/:id
// @access  Private (Admin)
export const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Check if user has assigned tasks
  const assignedTasks = await Task.countDocuments({ 
    assigneeId: req.params.id, 
    isArchived: false 
  });

  if (assignedTasks > 0) {
    return res.status(400).json({
      success: false,
      message: `Cannot delete user. User has ${assignedTasks} assigned tasks. Please reassign or complete these tasks first.`
    });
  }

  await User.findByIdAndDelete(req.params.id);

  res.status(200).json({
    success: true,
    message: 'User deleted successfully'
  });
});

// @desc    Get user statistics (Admin only)
// @route   GET /api/users/stats
// @access  Private (Admin)
export const getUserStats = asyncHandler(async (req, res) => {
  const userStats = await User.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        active: { $sum: { $cond: ['$isActive', 1, 0] } },
        inactive: { $sum: { $cond: ['$isActive', 0, 1] } },
        admins: { $sum: { $cond: [{ $eq: ['$role', 'admin'] }, 1, 0] } },
        vendors: { $sum: { $cond: [{ $eq: ['$role', 'vendor'] }, 1, 0] } },
        customers: { $sum: { $cond: [{ $eq: ['$role', 'customer'] }, 1, 0] } }
      }
    }
  ]);

  const roleDistribution = await User.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: '$role',
        count: { $sum: 1 }
      }
    }
  ]);

  const recentUsers = await User.find({ isActive: true })
    .select('-password')
    .sort({ createdAt: -1 })
    .limit(5);

  const result = {
    overview: userStats[0] || {
      total: 0,
      active: 0,
      inactive: 0,
      admins: 0,
      vendors: 0,
      customers: 0
    },
    roleDistribution,
    recentUsers
  };

  res.status(200).json({
    success: true,
    data: result
  });
});