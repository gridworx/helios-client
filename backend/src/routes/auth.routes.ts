import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db } from '../database/connection';
import { logger } from '../utils/logger';
import { asyncHandler } from '../middleware/errorHandler';
import { PasswordSetupService } from '../services/password-setup.service';

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

    // Find user with admin/employee flags
    const result = await db.query(
      `SELECT id, email, password_hash, first_name, last_name, role, is_active, organization_id,
              COALESCE(is_external_admin, false) as is_external_admin,
              default_view
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

    // Determine if user is external admin
    const isExternalAdmin = user.is_external_admin === true;

    // Generate tokens (include isExternalAdmin for access control)
    const accessToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, organizationId: user.organization_id, isExternalAdmin, type: 'access' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    const refreshToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, organizationId: user.organization_id, isExternalAdmin, type: 'refresh' },
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

    // Determine access capabilities
    // isExternalAdmin already determined above for JWT
    const isAdmin = user.role === 'admin' || user.role === 'super_admin';
    const isEmployee = !isExternalAdmin; // Internal users are employees

    // Determine default view
    // External admin: always admin
    // Internal admin: use saved preference or default to admin
    // Regular user: always user
    let defaultView = 'admin';
    if (!isAdmin) {
      defaultView = 'user';
    } else if (isEmployee) {
      // Internal admin - check for saved preference from default_view column
      if (user.default_view === 'user') {
        defaultView = 'user';
      }
    }

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
          organizationId: user.organization_id,
          // Access control flags
          isAdmin,
          isEmployee,
          isExternalAdmin,
          canAccessAdminUI: isAdmin,
          canAccessUserUI: isEmployee,
          canSwitchViews: isAdmin && isEmployee,
          defaultView
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
      `SELECT id, email, first_name, last_name, role, is_active, organization_id,
              COALESCE(is_external_admin, false) as is_external_admin,
              default_view
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

    // Determine access capabilities
    const isAdmin = user.role === 'admin' || user.role === 'super_admin';
    const isExternalAdmin = user.is_external_admin === true;
    const isEmployee = !isExternalAdmin; // Internal users are employees

    // Determine default view
    let defaultView = 'admin';
    if (!isAdmin) {
      defaultView = 'user';
    } else if (isEmployee) {
      if (user.default_view === 'user') {
        defaultView = 'user';
      }
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
          organizationId: user.organization_id,
          // Access control flags
          isAdmin,
          isEmployee,
          isExternalAdmin,
          canAccessAdminUI: isAdmin,
          canAccessUserUI: isEmployee,
          canSwitchViews: isAdmin && isEmployee,
          defaultView
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

/**
 * GET /api/auth/verify-setup-token
 * Verify a password setup token's validity
 */
router.get('/verify-setup-token', asyncHandler(async (req: Request, res: Response) => {
  const token = req.query.token as string;

  if (!token) {
    return res.status(400).json({
      success: false,
      error: 'Token is required'
    });
  }

  const verification = await PasswordSetupService.verifyToken(token);

  if (!verification.valid) {
    return res.status(400).json({
      success: false,
      error: verification.error || 'Invalid token'
    });
  }

  // Get user info for display (without sensitive data)
  const userResult = await db.query(
    'SELECT email, first_name, last_name FROM organization_users WHERE id = $1',
    [verification.userId]
  );

  if (userResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'User not found'
    });
  }

  const user = userResult.rows[0];

  res.json({
    success: true,
    data: {
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name
    }
  });
}));

/**
 * POST /api/auth/setup-password
 * Set password using a valid setup token
 */
router.post('/setup-password',
  [
    body('token').notEmpty().withMessage('Token is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
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

    const { token, password } = req.body;

    // Verify token
    const verification = await PasswordSetupService.verifyToken(token);

    if (!verification.valid) {
      return res.status(400).json({
        success: false,
        error: verification.error || 'Invalid or expired token'
      });
    }

    const userId = verification.userId!;

    // Hash the new password
    const passwordHash = await bcrypt.hash(password, 12);

    // Update user password and activate account
    await db.query(
      `UPDATE organization_users
       SET password_hash = $1, status = 'active', is_active = true
       WHERE id = $2`,
      [passwordHash, userId]
    );

    // Mark token as used
    await PasswordSetupService.markTokenAsUsed(token);

    // Get updated user info
    const userResult = await db.query(
      `SELECT id, email, first_name, last_name, role, organization_id
       FROM organization_users
       WHERE id = $1`,
      [userId]
    );

    const user = userResult.rows[0];

    // Generate JWT tokens for auto-login
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

    // Get organization details
    const orgResult = await db.query(
      'SELECT id, name, domain FROM organizations WHERE id = $1',
      [user.organization_id]
    );

    const organization = orgResult.rows[0];

    logger.info('Password setup completed', {
      userId: user.id,
      email: user.email
    });

    res.json({
      success: true,
      message: 'Password set successfully',
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

export default router;