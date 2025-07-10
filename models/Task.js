import mongoose from "mongoose";

const subtaskSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    trim: true,
  },
  completed: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const commentSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    trim: true,
  },
  author: {
    type: String,
    required: true,
  },
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  authorRole: {
    type: String,
    enum: ["admin", "vendor", "customer"],
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Task title is required"],
      trim: true,
      maxlength: [100, "Title cannot be more than 100 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Description cannot be more than 1000 characters"],
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    status: {
      type: String,
      enum: ["todo", "inprogress", "done"],
      default: "todo",
    },
    assignee: {
      type: String,
      required: [true, "Assignee name is required"],
    },
    assigneeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Assignee ID is required"],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    dueDate: {
      type: Date,
      required: [true, "Due date is required"],
    },
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
    subtasks: [subtaskSchema],
    timeSpent: {
      type: Number,
      default: 0, // in seconds
      min: 0,
    },
    comments: [commentSchema],
    attachments: [
      {
        filename: String,
        originalName: String,
        mimetype: String,
        size: Number,
        url: String,
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    isArchived: {
      type: Boolean,
      default: false,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for better query performance
taskSchema.index({ assigneeId: 1 });
taskSchema.index({ status: 1 });
taskSchema.index({ priority: 1 });
taskSchema.index({ dueDate: 1 });
taskSchema.index({ createdBy: 1 });
taskSchema.index({ tags: 1 });
taskSchema.index({ createdAt: -1 });

// Compound indexes
taskSchema.index({ assigneeId: 1, status: 1 });
taskSchema.index({ status: 1, priority: 1 });

// Virtual for checking if task is overdue
taskSchema.virtual("isOverdue").get(function () {
  return this.status !== "done" && new Date() > this.dueDate;
});

// Virtual for subtask completion percentage
taskSchema.virtual("subtaskProgress").get(function () {
  if (this.subtasks.length === 0)
    return { completed: 0, total: 0, percentage: 0 };

  const completed = this.subtasks.filter((subtask) => subtask.completed).length;
  const total = this.subtasks.length;
  const percentage = Math.round((completed / total) * 100);

  return { completed, total, percentage };
});

// Virtual for formatted time spent
taskSchema.virtual("formattedTimeSpent").get(function () {
  const hours = Math.floor(this.timeSpent / 3600);
  const minutes = Math.floor((this.timeSpent % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
});

// Pre-save middleware to update timestamps
taskSchema.pre("save", function (next) {
  this.updatedAt = Date.now();

  // Set completedAt when status changes to 'done'
  if (
    this.isModified("status") &&
    this.status === "done" &&
    !this.completedAt
  ) {
    this.completedAt = new Date();
  }

  // Clear completedAt if status changes from 'done' to something else
  if (this.isModified("status") && this.status !== "done" && this.completedAt) {
    this.completedAt = null;
  }

  next();
});

// Static method to get tasks by assignee
taskSchema.statics.findByAssignee = function (assigneeId, filters = {}) {
  const query = { assigneeId, isArchived: false, ...filters };
  return this.find(query)
    .populate("assigneeId", "name email role")
    .sort({ createdAt: -1 });
};

// Static method to get tasks by status
taskSchema.statics.findByStatus = function (status, filters = {}) {
  const query = { status, isArchived: false, ...filters };
  return this.find(query)
    .populate("assigneeId", "name email role")
    .sort({ createdAt: -1 });
};

// Static method to get overdue tasks
taskSchema.statics.findOverdue = function () {
  return this.find({
    status: { $ne: "done" },
    dueDate: { $lt: new Date() },
    isArchived: false,
  })
    .populate("assigneeId", "name email role")
    .sort({ dueDate: 1 });
};

// Instance method to add comment
taskSchema.methods.addComment = function (commentData) {
  this.comments.push(commentData);
  return this.save();
};

// Instance method to update subtask
taskSchema.methods.updateSubtask = function (subtaskId, updates) {
  const subtask = this.subtasks.id(subtaskId);
  if (subtask) {
    Object.assign(subtask, updates);
    return this.save();
  }
  throw new Error("Subtask not found");
};

const Task = mongoose.model("Task", taskSchema);

export default Task;
