import { validationResult } from "express-validator";
import Task from "../models/Task.js";
import User from "../models/User.js";
import { asyncHandler } from "../middleware/errorHandler.js";

// @desc    Get all tasks with filtering and pagination
// @route   GET /api/tasks
// @access  Private
export const getTasks = asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array(),
    });
  }

  const {
    status,
    priority,
    assigneeId,
    tags,
    search,
    page = 1,
    limit = 50,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = req.query;

  // Build query based on user role
  let query = { isArchived: false };

  // Role-based filtering
  if (req.user.role === "customer") {
    query.assigneeId = req.user._id;
  } else if (req.user.role === "vendor") {
    query.$or = [{ assigneeId: req.user._id }, { createdBy: req.user._id }];
  }
  // Admin can see all tasks

  // Apply filters
  if (status) query.status = status;
  if (priority) query.priority = priority;
  if (assigneeId) query.assigneeId = assigneeId;
  if (tags) query.tags = { $in: tags.split(",") };
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }

  // Pagination
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  // Sort options
  const sortOptions = {};
  sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

  // Execute query
  const tasks = await Task.find(query)
    .populate("assigneeId", "name email role")
    .populate("createdBy", "name email role")
    .sort(sortOptions)
    .skip(skip)
    .limit(limitNum);

  // Get total count for pagination
  const total = await Task.countDocuments(query);

  res.status(200).json({
    success: true,
    count: tasks.length,
    total,
    pagination: {
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum),
    },
    data: tasks,
  });
});

// @desc    Get single task
// @route   GET /api/tasks/:id
// @access  Private
export const getTask = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id)
    .populate("assigneeId", "name email role")
    .populate("createdBy", "name email role")
    .populate("comments.authorId", "name email role");

  if (!task) {
    return res.status(404).json({
      success: false,
      message: "Task not found",
    });
  }

  // Check access permissions
  if (
    req.user.role === "customer" &&
    task.assigneeId._id.toString() !== req.user._id.toString()
  ) {
    return res.status(403).json({
      success: false,
      message: "Not authorized to access this task",
    });
  }

  if (req.user.role === "vendor") {
    const hasAccess =
      task.assigneeId._id.toString() === req.user._id.toString() ||
      task.createdBy._id.toString() === req.user._id.toString();
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to access this task",
      });
    }
  }

  res.status(200).json({
    success: true,
    data: task,
  });
});

// @desc    Create new task
// @route   POST /api/tasks
// @access  Private (Admin, Vendor)
export const createTask = asyncHandler(async (req, res) => {
  console.log(req.body);
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array(),
    });
  }

  const { assigneeId } = req.body;

  // Verify assignee exists
  const assignee = await User.findById(assigneeId);
  if (!assignee) {
    return res.status(400).json({
      success: false,
      message: "Assignee not found",
    });
  }

  // Create task
  const task = await Task.create({
    ...req.body,
    assignee: assignee.name,
    createdBy: req.user._id,
  });

  // Populate the created task
  await task.populate("assigneeId", "name email role");
  await task.populate("createdBy", "name email role");

  // Emit socket event for real-time updates
  if (req.io) {
    req.io.emit("taskCreated", task);
  }

  res.status(201).json({
    success: true,
    message: "Task created successfully",
    data: task,
  });
});

// @desc    Update task
// @route   PUT /api/tasks/:id
// @access  Private
export const updateTask = asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array(),
    });
  }

  let task = await Task.findById(req.params.id);

  if (!task) {
    return res.status(404).json({
      success: false,
      message: "Task not found",
    });
  }

  // If assigneeId is being updated, verify the new assignee exists
  if (req.body.assigneeId) {
    const assignee = await User.findById(req.body.assigneeId);
    if (!assignee) {
      return res.status(400).json({
        success: false,
        message: "Assignee not found",
      });
    }
    req.body.assignee = assignee.name;
  }

  // Update task
  task = await Task.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  })
    .populate("assigneeId", "name email role")
    .populate("createdBy", "name email role");

  // Emit socket event for real-time updates
  if (req.io) {
    req.io.emit("taskUpdated", task);
  }

  res.status(200).json({
    success: true,
    message: "Task updated successfully",
    data: task,
  });
});

// @desc    Delete task
// @route   DELETE /api/tasks/:id
// @access  Private (Admin only)
export const deleteTask = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id);

  if (!task) {
    return res.status(404).json({
      success: false,
      message: "Task not found",
    });
  }

  await Task.findByIdAndDelete(req.params.id);

  // Emit socket event for real-time updates
  if (req.io) {
    req.io.emit("taskDeleted", { taskId: req.params.id });
  }

  res.status(200).json({
    success: true,
    message: "Task deleted successfully",
  });
});

// @desc    Bulk update tasks
// @route   PUT /api/tasks/bulk/update
// @access  Private (Admin, Vendor)
export const bulkUpdateTasks = asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array(),
    });
  }

  const { taskIds, updates } = req.body;

  // If assigneeId is being updated, verify the new assignee exists
  if (updates.assigneeId) {
    const assignee = await User.findById(updates.assigneeId);
    if (!assignee) {
      return res.status(400).json({
        success: false,
        message: "Assignee not found",
      });
    }
    updates.assignee = assignee.name;
  }

  // Build query based on user role
  let query = { _id: { $in: taskIds } };

  if (req.user.role === "vendor") {
    query.$or = [{ assigneeId: req.user._id }, { createdBy: req.user._id }];
  }

  // Update tasks
  const result = await Task.updateMany(query, updates);

  // Get updated tasks for real-time updates
  const updatedTasks = await Task.find({ _id: { $in: taskIds } })
    .populate("assigneeId", "name email role")
    .populate("createdBy", "name email role");

  // Emit socket event for real-time updates
  if (req.io) {
    req.io.emit("tasksBulkUpdated", updatedTasks);
  }

  res.status(200).json({
    success: true,
    message: `${result.modifiedCount} tasks updated successfully`,
    modifiedCount: result.modifiedCount,
  });
});

// @desc    Bulk delete tasks
// @route   DELETE /api/tasks/bulk/delete
// @access  Private (Admin only)
export const bulkDeleteTasks = asyncHandler(async (req, res) => {
  const { taskIds } = req.body;

  if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Task IDs array is required",
    });
  }

  const result = await Task.deleteMany({ _id: { $in: taskIds } });

  // Emit socket event for real-time updates
  if (req.io) {
    req.io.emit("tasksBulkDeleted", { taskIds });
  }

  res.status(200).json({
    success: true,
    message: `${result.deletedCount} tasks deleted successfully`,
    deletedCount: result.deletedCount,
  });
});

// @desc    Add comment to task
// @route   POST /api/tasks/:id/comments
// @access  Private
export const addComment = asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array(),
    });
  }

  const task = await Task.findById(req.params.id);

  if (!task) {
    return res.status(404).json({
      success: false,
      message: "Task not found",
    });
  }

  const comment = {
    text: req.body.text,
    author: req.user.name,
    authorId: req.user._id,
    authorRole: req.user.role,
    createdAt: new Date(),
  };

  task.comments.push(comment);
  await task.save();

  // Populate the new comment
  await task.populate("comments.authorId", "name email role");

  // Emit socket event for real-time updates
  if (req.io) {
    req.io.emit("commentAdded", {
      taskId: task._id,
      comment: task.comments[task.comments.length - 1],
    });
  }

  res.status(201).json({
    success: true,
    message: "Comment added successfully",
    data: task.comments[task.comments.length - 1],
  });
});

// @desc    Update subtask
// @route   PUT /api/tasks/:id/subtasks/:subtaskId
// @access  Private
export const updateSubtask = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id);

  if (!task) {
    return res.status(404).json({
      success: false,
      message: "Task not found",
    });
  }

  const subtask = task.subtasks.id(req.params.subtaskId);
  if (!subtask) {
    return res.status(404).json({
      success: false,
      message: "Subtask not found",
    });
  }

  // Update subtask
  Object.assign(subtask, req.body);
  await task.save();

  // Emit socket event for real-time updates
  if (req.io) {
    req.io.emit("subtaskUpdated", {
      taskId: task._id,
      subtask,
    });
  }

  res.status(200).json({
    success: true,
    message: "Subtask updated successfully",
    data: subtask,
  });
});

// @desc    Get task statistics
// @route   GET /api/tasks/stats
// @access  Private
export const getTaskStats = asyncHandler(async (req, res) => {
  // Build query based on user role
  let matchQuery = { isArchived: false };

  if (req.user.role === "customer") {
    matchQuery.assigneeId = req.user._id;
  } else if (req.user.role === "vendor") {
    matchQuery.$or = [
      { assigneeId: req.user._id },
      { createdBy: req.user._id },
    ];
  }

  const stats = await Task.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        todo: { $sum: { $cond: [{ $eq: ["$status", "todo"] }, 1, 0] } },
        inprogress: {
          $sum: { $cond: [{ $eq: ["$status", "inprogress"] }, 1, 0] },
        },
        done: { $sum: { $cond: [{ $eq: ["$status", "done"] }, 1, 0] } },
        high: { $sum: { $cond: [{ $eq: ["$priority", "high"] }, 1, 0] } },
        medium: { $sum: { $cond: [{ $eq: ["$priority", "medium"] }, 1, 0] } },
        low: { $sum: { $cond: [{ $eq: ["$priority", "low"] }, 1, 0] } },
        overdue: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ["$status", "done"] },
                  { $lt: ["$dueDate", new Date()] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

  const result = stats[0] || {
    total: 0,
    todo: 0,
    inprogress: 0,
    done: 0,
    high: 0,
    medium: 0,
    low: 0,
    overdue: 0,
  };

  res.status(200).json({
    success: true,
    data: result,
  });
});

// @desc    Get overdue tasks
// @route   GET /api/tasks/overdue
// @access  Private
export const getOverdueTasks = asyncHandler(async (req, res) => {
  // Build query based on user role
  let query = {
    status: { $ne: "done" },
    dueDate: { $lt: new Date() },
    isArchived: false,
  };

  if (req.user.role === "customer") {
    query.assigneeId = req.user._id;
  } else if (req.user.role === "vendor") {
    query.$or = [{ assigneeId: req.user._id }, { createdBy: req.user._id }];
  }

  const overdueTasks = await Task.find(query)
    .populate("assigneeId", "name email role")
    .populate("createdBy", "name email role")
    .sort({ dueDate: 1 });

  res.status(200).json({
    success: true,
    count: overdueTasks.length,
    data: overdueTasks,
  });
});
