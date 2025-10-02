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
 * POST /api/auth/tenant-login
 * Login to tenant portal with email + password
 */
router.post('/tenant-login', [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
  }

  const { email, password } = req.body;

  // Find tenant user by email
  const userResult = await db.query(`
    SELECT
      tu.id, tu.email, tu.password_hash, tu.first_name, tu.last_name, tu.role, tu.is_active,
      t.id as tenant_id, t.domain, t.name as organization_name
    FROM tenant_users tu
    JOIN tenants t ON tu.tenant_id = t.id
    WHERE tu.email = $1 AND tu.is_active = true AND t.is_active = true
  `, [email.toLowerCase()]);

  if (userResult.rows.length === 0) {
    return res.status(401).json({
      success: false,
      error: 'Invalid email or password'
    });
  }

  const user = userResult.rows[0];

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.password_hash);

  if (!isPasswordValid) {
    logger.warn('Failed login attempt', { email });
    return res.status(401).json({
      success: false,
      error: 'Invalid email or password'
    });
  }

  // Generate JWT token with user and tenant context
  const token = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      tenantId: user.tenant_id,
      domain: user.domain,
      organizationName: user.organization_name,
      role: user.role,
      firstName: user.first_name,
      lastName: user.last_name
    },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  // Update last login
  await db.query('UPDATE tenant_users SET last_login = NOW() WHERE id = $1', [user.id]);

  // Log successful login
  await db.query(
    `INSERT INTO audit_logs (tenant_id, action, resource, ip_address, user_agent, new_values)
     VALUES ($1, 'login', 'tenant_user_auth', $2, $3, $4)`,
    [
      user.tenant_id,
      req.ip,
      req.get('User-Agent') || 'Unknown',
      JSON.stringify({ email, loginMethod: 'email_password', role: user.role })
    ]
  );

  logger.info('Tenant user login successful', {
    userId: user.id,
    email: user.email,
    tenantId: user.tenant_id,
    organizationName: user.organization_name
  });

  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role
    },
    tenant: {
      id: user.tenant_id,
      domain: user.domain,
      name: user.organization_name
    }
  });
}));

/**
 * POST /api/auth/tenant-logout
 */
router.post('/tenant-logout', asyncHandler(async (req: Request, res: Response) => {
  const { tenantId } = req.body;

  if (tenantId) {
    await db.query(
      `INSERT INTO audit_logs (tenant_id, action, resource, ip_address, user_agent)
       VALUES ($1, 'logout', 'tenant_auth', $2, $3)`,
      [tenantId, req.ip, req.get('User-Agent') || 'Unknown']
    );

    logger.info('Tenant logout', { tenantId });
  }

  res.json({
    success: true,
    message: 'Logged out successfully'
  });
}));

/**
 * GET /api/auth/tenant-verify
 * Verify tenant token
 */
router.get('/tenant-verify', asyncHandler(async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'No token provided'
    });
  }

  const token = authHeader.substring(7);

  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);

    // Verify user and tenant still exist and are active
    const userResult = await db.query(`
      SELECT
        tu.id, tu.email, tu.first_name, tu.last_name, tu.role, tu.is_active,
        t.id as tenant_id, t.domain, t.name as organization_name, t.is_active as tenant_active
      FROM tenant_users tu
      JOIN tenants t ON tu.tenant_id = t.id
      WHERE tu.id = $1 AND tu.is_active = true AND t.is_active = true
    `, [decoded.userId]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'User or organization not found'
      });
    }

    const user = userResult.rows[0];

    res.json({
      success: true,
      data: {
        userId: decoded.userId,
        email: decoded.email,
        tenantId: decoded.tenantId,
        domain: decoded.domain,
        organizationName: decoded.organizationName,
        role: decoded.role,
        valid: true,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role
        },
        tenant: {
          id: user.tenant_id,
          domain: user.domain,
          name: user.organization_name
        }
      }
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Invalid or expired token'
    });
  }
}));

export default router;