import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db } from '../database/connection';
import { logger } from '../utils/logger';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secure_jwt_secret_key_here';

/**
 * POST /api/auth/login
 * Login with email and password
 */
router.post('/login',
  [
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required')
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { email, password } = req.body;

    // Find user
    const result = await db.query(
      `SELECT id, email, password_hash, first_name, last_name, role, is_active, organization_id
       FROM organization_users
       WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        error: 'Account is disabled'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      logger.warn('Failed login attempt', { email });
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Generate tokens
    const accessToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, organizationId: user.organization_id, type: 'access' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    const refreshToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, organizationId: user.organization_id, type: 'refresh' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Update last login
    await db.query('UPDATE organization_users SET last_login = NOW() WHERE id = $1', [user.id]);

    // Log login
    await db.query(
      `INSERT INTO audit_logs (user_id, organization_id, action, resource, ip_address, user_agent)
       VALUES ($1, $2, 'login', 'auth', $3, $4)`,
      [user.id, user.organization_id, req.ip, req.get('User-Agent') || 'Unknown']
    );

    // Get organization details
    const orgResult = await db.query(
      'SELECT id, name, domain FROM organizations WHERE id = $1',
      [user.organization_id]
    );

    const organization = orgResult.rows[0];

    logger.info('User logged in successfully', {
      userId: user.id,
      email: user.email,
      role: user.role
    });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          organizationId: user.organization_id
        },
        organization: {
          id: organization.id,
          name: organization.name,
          domain: organization.domain
        },
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: 86400
        }
      }
    });
  })
);

/**
 * GET /api/auth/verify
 * Verify JWT token validity
 */
router.get('/verify', asyncHandler(async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'No token provided'
    });
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    // Verify user still exists and is active
    const result = await db.query(
      `SELECT id, email, first_name, last_name, role, is_active, organization_id
       FROM organization_users
       WHERE id = $1`,
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        error: 'Account is disabled'
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          organizationId: user.organization_id
        }
      }
    });
  } catch (error: any) {
    logger.warn('Token verification failed', { error: error.message });
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired token'
    });
  }
}));

/**
 * POST /api/auth/logout
 */
router.post('/logout', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.body.userId;

  if (userId) {
    await db.query(
      `INSERT INTO audit_logs (user_id, action, resource, ip_address, user_agent)
       VALUES ($1, 'logout', 'auth', $2, $3)`,
      [userId, req.ip, req.get('User-Agent') || 'Unknown']
    );

    logger.info('User logged out', { userId });
  }

  res.json({
    success: true,
    message: 'Logged out successfully'
  });
}));

export default router;