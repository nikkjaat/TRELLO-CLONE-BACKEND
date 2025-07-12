import express from 'express';
import { query } from 'express-validator';
import {
  getUsers,
  getUser,
  updateUser,
  deleteUser,
  getUserStats
} from '../controllers/userController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// All routes are protected
// router.use(protect);

// Query validation
const getUsersValidation = [
  query('role')
    .optional()
    .isIn(['admin', 'vendor', 'customer'])
    .withMessage('Role must be admin, vendor, or customer'),
  query('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];

// Routes
router.get('/', getUsersValidation, getUsers);
router.get('/stats', authorize('admin'), getUserStats);
router.get('/:id', getUser);

// Admin only routes
router.put('/:id', authorize('admin'), updateUser);
router.delete('/:id', authorize('admin'), deleteUser);

export default router;