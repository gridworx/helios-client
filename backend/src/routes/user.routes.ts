import { Router } from 'express';
import { db } from '../database/connection';
import { logger } from '../utils/logger';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Get current user (requires authentication)
router.get('/me', authenticateToken, asyncHandler(async (req, res) => {
  try {
    // Get the authenticated user from the token
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const result = await db.query(
      `SELECT id, email, first_name, last_name, role, created_at
       FROM users
       WHERE id = $1 AND is_active = true`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No platform owner found'
      });
    }

    const user = result.rows[0];

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          createdAt: user.created_at
        }
      }
    });
  } catch (error) {
    logger.error('Failed to get user info', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve user information'
    });
  }
}));

export default router;