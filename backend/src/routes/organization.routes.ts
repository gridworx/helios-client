import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../database/connection';
import { logger } from '../utils/logger';
import { authService } from '../services/auth.service';

const router = Router();

// Check if organization is set up
router.get('/setup/status', async (req: Request, res: Response) => {
  try {
    // Check if any organization exists
    const orgResult = await db.query('SELECT COUNT(*) as count FROM organizations');
    const orgCount = parseInt(orgResult.rows[0].count);

    // Check if any admin exists
    const adminResult = await db.query("SELECT COUNT(*) as count FROM organization_users WHERE role = 'admin'");
    const adminCount = parseInt(adminResult.rows[0].count);

    res.json({
      success: true,
      data: {
        isSetupComplete: orgCount > 0 && adminCount > 0,
        hasOrganization: orgCount > 0,
        hasAdmin: adminCount > 0
      }
    });
  } catch (error) {
    logger.error('Failed to check setup status', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check setup status'
    });
  }
});

// Create organization and admin account
router.post('/setup', async (req: Request, res: Response) => {
  try {
    const {
      organizationName,
      organizationDomain,
      adminEmail,
      adminPassword,
      adminFirstName,
      adminLastName
    } = req.body;

    // Validate input
    if (!organizationName || !organizationDomain || !adminEmail || !adminPassword || !adminFirstName || !adminLastName) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required'
      });
    }

    // Check if organization already exists
    const existingOrg = await db.query('SELECT id FROM organizations LIMIT 1');
    if (existingOrg.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Organization already exists'
      });
    }

    // Check if admin already exists
    const existingAdmin = await db.query('SELECT id FROM organization_users WHERE email = $1', [adminEmail]);
    if (existingAdmin.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Admin user already exists'
      });
    }

    // Start transaction
    await db.query('BEGIN');

    try {
      // Create organization
      const orgResult = await db.query(
        `INSERT INTO organizations (name, domain, is_setup_complete)
         VALUES ($1, $2, true)
         RETURNING id, name, domain`,
        [organizationName, organizationDomain]
      );
      const organization = orgResult.rows[0];

      // Hash password
      const passwordHash = await bcrypt.hash(adminPassword, 12);

      // Create admin user
      const userResult = await db.query(
        `INSERT INTO organization_users (
          email, password_hash, first_name, last_name,
          role, organization_id, is_active, email_verified
        )
         VALUES ($1, $2, $3, $4, 'admin', $5, true, true)
         RETURNING id, email, first_name, last_name, role`,
        [adminEmail, passwordHash, adminFirstName, adminLastName, organization.id]
      );
      const admin = userResult.rows[0];

      // Create default organization settings
      await db.query(
        `INSERT INTO organization_settings (organization_id, key, value)
         VALUES ($1, 'google_workspace_enabled', 'false')`,
        [organization.id]
      );
      await db.query(
        `INSERT INTO organization_settings (organization_id, key, value)
         VALUES ($1, 'microsoft_365_enabled', 'false')`,
        [organization.id]
      );

      // Insert default modules
      const modules = [
        { name: 'Google Workspace', slug: 'google-workspace', description: 'Sync users and groups from Google Workspace' },
        { name: 'Microsoft 365', slug: 'microsoft-365', description: 'Sync users and groups from Microsoft 365' },
        { name: 'User Management', slug: 'user-management', description: 'Manage organization users' },
        { name: 'Audit Logs', slug: 'audit-logs', description: 'Track all system activities' }
      ];

      for (const module of modules) {
        await db.query(
          `INSERT INTO modules (name, slug, description, version, config_schema)
           VALUES ($1, $2, $3, '1.0.0', '{}')
           ON CONFLICT (slug) DO NOTHING`,
          [module.name, module.slug, module.description]
        );
      }

      // Commit transaction
      await db.query('COMMIT');

      // Generate token for auto-login
      const token = authService.generateAccessToken(
        admin.id,
        admin.email,
        admin.role
      );

      logger.info('Organization setup completed', {
        organizationId: organization.id,
        adminId: admin.id
      });

      res.json({
        success: true,
        message: 'Organization setup completed successfully',
        data: {
          organization: {
            id: organization.id,
            name: organization.name,
            domain: organization.domain
          },
          admin: {
            id: admin.id,
            email: admin.email,
            firstName: admin.first_name,
            lastName: admin.last_name,
            role: admin.role
          },
          token
        }
      });
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    logger.error('Failed to setup organization', error);
    res.status(500).json({
      success: false,
      error: 'Failed to setup organization',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get organization details (requires auth in production)
router.get('/current', async (req: Request, res: Response) => {
  try {
    const result = await db.query(
      `SELECT id, name, domain, is_setup_complete, created_at
       FROM organizations
       LIMIT 1`
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No organization found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Failed to get organization', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get organization'
    });
  }
});

export default router;