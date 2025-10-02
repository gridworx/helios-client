import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { db } from '../database/connection';
import { logger } from '../utils/logger';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

/**
 * POST /api/tenant-setup/account-only
 * Create organization and admin account (without modules)
 */
router.post('/account-only', [
  body('organizationName').notEmpty().withMessage('Organization name is required'),
  body('domain').notEmpty().withMessage('Domain is required'),
  body('adminEmail').isEmail().withMessage('Valid admin email is required'),
  body('adminFirstName').notEmpty().withMessage('Admin first name is required'),
  body('adminLastName').notEmpty().withMessage('Admin last name is required'),
  body('adminPassword').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
  }

  const {
    organizationName,
    domain,
    adminEmail,
    adminFirstName,
    adminLastName,
    adminPassword
  } = req.body;

  try {
    // Start transaction
    await db.transaction(async (client) => {
      const tenantId = randomUUID();

      // 1. Create organization (tenant)
      await client.query(`
        INSERT INTO tenants (id, domain, name, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, true, NOW(), NOW())
      `, [tenantId, domain, organizationName]);

      // 2. Create admin user account
      const passwordHash = await bcrypt.hash(adminPassword, 12);

      await client.query(`
        INSERT INTO tenant_users (tenant_id, email, password_hash, first_name, last_name, role, is_active, email_verified)
        VALUES ($1, $2, $3, $4, $5, 'admin', true, true)
      `, [tenantId, adminEmail, passwordHash, adminFirstName, adminLastName]);

      // 3. Initialize tenant settings (no modules enabled yet)
      await client.query(`
        INSERT INTO tenant_settings (tenant_id, sync_interval_seconds, auto_sync_enabled)
        VALUES ($1, 900, false)
      `, [tenantId]);

      logger.info('Organization and admin account created', {
        tenantId,
        domain,
        organizationName,
        adminEmail
      });

      res.json({
        success: true,
        message: 'Account created successfully',
        data: {
          tenantId,
          domain,
          organizationName,
          setupComplete: true
        }
      });
    });

  } catch (error: any) {
    logger.error('Account setup failed', { error: error.message });

    if (error.code === '23505') {
      if (error.constraint?.includes('domain')) {
        return res.status(409).json({
          success: false,
          error: 'This domain is already registered'
        });
      }
      if (error.constraint?.includes('email')) {
        return res.status(409).json({
          success: false,
          error: 'This email is already registered'
        });
      }
    }

    res.status(500).json({
      success: false,
      error: 'Account setup failed'
    });
  }
}));

/**
 * POST /api/tenant-setup/complete
 * Complete tenant setup with organization, DWD, and admin user
 */
router.post('/complete', [
  body('organizationName').notEmpty().withMessage('Organization name is required'),
  body('domain').notEmpty().withMessage('Domain is required'),
  body('adminEmail').isEmail().withMessage('Valid admin email is required'),
  body('adminFirstName').notEmpty().withMessage('Admin first name is required'),
  body('adminLastName').notEmpty().withMessage('Admin last name is required'),
  body('adminPassword').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('credentials').isObject().withMessage('Service account credentials are required'),
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
  }

  const {
    organizationName,
    domain,
    adminEmail,
    adminFirstName,
    adminLastName,
    adminPassword,
    credentials
  } = req.body;

  try {
    // Start transaction
    await db.transaction(async (client) => {
      const tenantId = randomUUID();

      // 1. Create tenant
      await client.query(`
        INSERT INTO tenants (id, domain, name, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, true, NOW(), NOW())
      `, [tenantId, domain, organizationName]);

      // 2. Store service account credentials
      await client.query(`
        INSERT INTO tenant_credentials (tenant_id, service_account_key, admin_email, domain, admin_email_stored, scopes, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      `, [
        tenantId,
        JSON.stringify(credentials),
        credentials.client_email,
        domain,
        adminEmail,
        [
          'https://www.googleapis.com/auth/admin.directory.user',
          'https://www.googleapis.com/auth/admin.directory.group',
          'https://www.googleapis.com/auth/admin.directory.orgunit',
          'https://www.googleapis.com/auth/admin.directory.domain'
        ]
      ]);

      // 3. Create admin user account in users table
      const passwordHash = await bcrypt.hash(adminPassword, 12);

      const userResult = await client.query(`
        INSERT INTO users (email, password_hash, full_name, role, is_active, is_verified)
        VALUES ($1, $2, $3, 'organization_admin', true, true)
        RETURNING id
      `, [adminEmail, passwordHash, `${adminFirstName} ${adminLastName}`]);

      const userId = userResult.rows[0].id;

      // 4. Link user to tenant
      await client.query(`
        INSERT INTO tenant_users (tenant_id, user_id, role, is_active)
        VALUES ($1, $2, 'organization_admin', true)
      `, [tenantId, userId]);

      // 5. Initialize sync settings (auto-sync enabled with DWD)
      await client.query(`
        INSERT INTO sync_settings (tenant_id, sync_type, conflict_resolution, auto_sync_enabled, sync_interval)
        VALUES ($1, 'all', 'platform_wins', true, 900)
      `, [tenantId]);

      logger.info('Tenant setup completed successfully', {
        tenantId,
        domain,
        organizationName,
        adminEmail
      });

      res.json({
        success: true,
        message: 'Setup completed successfully',
        data: {
          tenantId,
          domain,
          organizationName,
          setupComplete: true
        }
      });
    });

  } catch (error: any) {
    logger.error('Tenant setup failed', { error: error.message });

    if (error.code === '23505') {
      if (error.constraint?.includes('domain')) {
        return res.status(409).json({
          success: false,
          error: 'This domain is already configured'
        });
      }
      if (error.constraint?.includes('email')) {
        return res.status(409).json({
          success: false,
          error: 'This email is already registered'
        });
      }
    }

    res.status(500).json({
      success: false,
      error: 'Setup failed due to server error'
    });
  }
}));

/**
 * GET /api/tenant-setup/check
 * Check if any tenant is configured (determines welcome vs login)
 */
router.get('/check', asyncHandler(async (_req, res) => {
  const result = await db.query('SELECT COUNT(*) as count, MAX(name) as org_name FROM tenants WHERE is_active = true');
  const count = parseInt(result.rows[0].count);
  const orgName = result.rows[0].org_name;

  res.json({
    success: true,
    hasSetup: count > 0,
    needsSetup: count === 0,
    organizationName: orgName
  });
}));

export default router;