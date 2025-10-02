import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import { db } from '../database/connection';
import { dbInitializer } from '../database/init';
import { logger } from '../utils/logger';
import { asyncHandler, createError } from '../middleware/errorHandler';

const router = Router();

// Check platform setup status
router.get('/status', asyncHandler(async (_req, res) => {
  const isPlatformSetup = await dbInitializer.isPlatformSetupComplete();
  const ownerCount = await dbInitializer.getPlatformOwnerCount();

  res.json({
    success: true,
    data: {
      setupComplete: isPlatformSetup,
      hasOwners: ownerCount > 0,
      requiresSetup: !isPlatformSetup || ownerCount === 0
    }
  });
}));

// Platform setup - create first platform owner
router.post('/initialize',
  [
    body('ownerEmail')
      .isEmail()
      .withMessage('Valid email is required')
      .normalizeEmail(),
    body('ownerPassword')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long'),
    body('ownerFirstName')
      .trim()
      .isLength({ min: 1 })
      .withMessage('First name is required'),
    body('ownerLastName')
      .trim()
      .isLength({ min: 1 })
      .withMessage('Last name is required'),
    body('platformName')
      .optional()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Platform name must be between 1-100 characters')
  ],
  asyncHandler(async (req, res) => {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    // Check if setup is already complete
    const isPlatformSetup = await dbInitializer.isPlatformSetupComplete();
    if (isPlatformSetup) {
      return res.status(409).json({
        success: false,
        error: 'Platform setup already complete'
      });
    }

    // Check if platform owner already exists
    const ownerCount = await dbInitializer.getPlatformOwnerCount();
    if (ownerCount > 0) {
      return res.status(409).json({
        success: false,
        error: 'Platform owner already exists'
      });
    }

    const {
      ownerEmail,
      ownerPassword,
      ownerFirstName,
      ownerLastName,
      platformName = 'Helios'
    } = req.body;

    try {
      // Start transaction
      await db.transaction(async (client) => {
        // Hash password
        const passwordHash = await bcrypt.hash(ownerPassword, 12);

        // Create platform owner
        const ownerResult = await client.query(
          `INSERT INTO users (email, password_hash, first_name, last_name, role, is_active, email_verified)
           VALUES ($1, $2, $3, $4, 'platform_owner', true, true)
           RETURNING id, email, first_name, last_name, role, created_at`,
          [ownerEmail, passwordHash, ownerFirstName, ownerLastName]
        );

        const owner = ownerResult.rows[0];

        // Update platform name if provided
        if (platformName && platformName !== 'Helios') {
          await client.query(
            `INSERT INTO platform_settings (key, value, description, is_public)
             VALUES ('platform_name', $1, 'The name of the platform', true)
             ON CONFLICT (key) DO UPDATE SET
             value = $1, updated_at = NOW()`,
            [platformName]
          );
        }

        // Mark setup as complete
        await client.query(
          `INSERT INTO platform_settings (key, value, description, is_public)
           VALUES ('setup_complete', 'true', 'Platform setup completed', false)
           ON CONFLICT (key) DO UPDATE SET
           value = 'true', updated_at = NOW()`
        );

        // Log the setup completion
        await client.query(
          `INSERT INTO audit_logs (user_id, action, resource, new_values, ip_address, user_agent)
           VALUES ($1, 'create', 'platform_setup', $2, $3, $4)`,
          [
            owner.id,
            JSON.stringify({ setupComplete: true, platformName }),
            req.ip,
            req.get('User-Agent') || 'Unknown'
          ]
        );

        logger.info('Platform setup completed successfully', {
          ownerId: owner.id,
          ownerEmail: owner.email,
          platformName
        });

        res.json({
          success: true,
          message: 'Platform setup completed successfully',
          data: {
            owner: {
              id: owner.id,
              email: owner.email,
              firstName: owner.first_name,
              lastName: owner.last_name,
              role: owner.role,
              createdAt: owner.created_at
            },
            platformName,
            setupComplete: true
          }
        });
      });

    } catch (error) {
      logger.error('Platform setup failed', error);

      // Check for duplicate email error
      if ((error as any).code === '23505' && (error as any).constraint === 'users_email_key') {
        throw createError('An account with this email already exists', 409);
      }

      throw createError('Platform setup failed', 500);
    }
  })
);

// Validate setup requirements
router.post('/validate',
  [
    body('ownerEmail').isEmail().normalizeEmail(),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { ownerEmail } = req.body;

    // Check if email already exists
    const existingUser = await db.findOne('users', { email: ownerEmail });

    res.json({
      success: true,
      data: {
        emailAvailable: !existingUser,
        canProceed: !existingUser
      }
    });
  })
);

export { router as setupRoutes };