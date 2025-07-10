import jwt from "jsonwebtoken";
import User from "../models/User.js";

// Protect routes - verify JWT token
export const protect = async (req, res, next) => {
  try {
    let token;

    // Check for token in headers
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    // Make sure token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Not authorized to access this route",
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);


      // Get user from token
      const user = await User.findById(decoded.userId).select("-password");

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "No user found with this token",
        });
      }

      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: "User account is deactivated",
        });
      }

      req.user = user;
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: "Not authorized to access this route",
      });
    }
  } catch (error) {
    next(error);
  }
};

// Grant access to specific roles
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role ${req.user.role} is not authorized to access this route`,
      });
    }
    next();
  };
};

// Check if user can access specific task
export const checkTaskAccess = async (req, res, next) => {
  try {
    const { user } = req;
    const taskId = req.params.id || req.body.taskId;

    // Admin can access all tasks
    if (user.role === "admin") {
      return next();
    }

    // For other roles, check if they are assigned to the task
    const Task = (await import("../models/Task.js")).default;
    const task = await Task.findById(taskId);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // Vendor can access tasks they created or are assigned to
    if (user.role === "vendor") {
      if (
        task.createdBy.toString() === user._id.toString() ||
        task.assigneeId.toString() === user._id.toString()
      ) {
        return next();
      }
    }

    // Customer can only access tasks assigned to them
    if (user.role === "customer") {
      if (task.assigneeId.toString() === user._id.toString()) {
        return next();
      }
    }

    return res.status(403).json({
      success: false,
      message: "Not authorized to access this task",
    });
  } catch (error) {
    next(error);
  }
};

// Generate JWT token
export const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "7d",
  });
};
