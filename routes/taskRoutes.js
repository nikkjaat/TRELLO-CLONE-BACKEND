import express from "express";
import { body, query } from "express-validator";
import {
  getTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  bulkUpdateTasks,
  bulkDeleteTasks,
  addComment,
  updateSubtask,
  getTaskStats,
  getOverdueTasks,
} from "../controllers/taskController.js";
import { protect, authorize, checkTaskAccess } from "../middleware/auth.js";

const router = express.Router();

// All routes are protected
router.use(protect);

// Validation rules
const createTaskValidation = [
  body("title")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Title is required and must be less than 100 characters"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Description must be less than 1000 characters"),
  body("priority")
    .optional()
    .isIn(["low", "medium", "high"])
    .withMessage("Priority must be low, medium, or high"),
  body("assigneeId").isMongoId().withMessage("Valid assignee ID is required"),
  body("dueDate").isISO8601().withMessage("Valid due date is required"),
  body("tags").optional().isArray().withMessage("Tags must be an array"),
];

const updateTaskValidation = [
  body("title")
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Title must be less than 100 characters"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Description must be less than 1000 characters"),
  body("priority")
    .optional()
    .isIn(["low", "medium", "high"])
    .withMessage("Priority must be low, medium, or high"),
  body("status")
    .optional()
    .isIn(["todo", "inprogress", "done"])
    .withMessage("Status must be todo, inprogress, or done"),
  body("assigneeId")
    .optional()
    .isMongoId()
    .withMessage("Valid assignee ID is required"),
  body("dueDate")
    .optional()
    .isISO8601()
    .withMessage("Valid due date is required"),
  body("tags").optional().isArray().withMessage("Tags must be an array"),
  body("timeSpent")
    .optional()
    .isNumeric()
    .withMessage("Time spent must be a number"),
];

const commentValidation = [
  body("text")
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage(
      "Comment text is required and must be less than 500 characters"
    ),
];

const bulkUpdateValidation = [
  body("taskIds").isArray({ min: 1 }).withMessage("Task IDs array is required"),
  body("taskIds.*").isMongoId().withMessage("All task IDs must be valid"),
  body("updates").isObject().withMessage("Updates object is required"),
];

// Query validation
const getTasksValidation = [
  query("status")
    .optional()
    .isIn(["todo", "inprogress", "done"])
    .withMessage("Status must be todo, inprogress, or done"),
  query("priority")
    .optional()
    .isIn(["low", "medium", "high"])
    .withMessage("Priority must be low, medium, or high"),
  query("assigneeId")
    .optional()
    .isMongoId()
    .withMessage("Assignee ID must be valid"),
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
];

// Routes
router.get("/", getTasksValidation, getTasks);
router.get("/stats", getTaskStats);
router.get("/overdue", getOverdueTasks);
router.get("/:id", getTask);

router.post(
  "/",
  authorize("admin", "vendor"),
  createTaskValidation,
  createTask
);

router.put("/:id", checkTaskAccess, updateTaskValidation, updateTask);
router.delete("/:id", authorize("admin"), deleteTask);

// Bulk operations (admin and vendor only)
router.put(
  "/bulk/update",
  authorize("admin", "vendor"),
  bulkUpdateValidation,
  bulkUpdateTasks
);
router.delete("/bulk/delete", authorize("admin"), bulkDeleteTasks);

// Comments
router.post("/:id/comments", checkTaskAccess, commentValidation, addComment);

// Subtasks
router.put("/:id/subtasks/:subtaskId", checkTaskAccess, updateSubtask);

export default router;
