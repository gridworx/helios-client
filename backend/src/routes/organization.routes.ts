import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../database/connection';
import { logger } from '../utils/logger';
import { authService } from '../services/auth.service';
import { authenticateToken } from '../middleware/auth';

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

      // Generate token for auto-login with organizationId
      const token = authService.generateAccessToken(
        admin.id,
        admin.email,
        admin.role,
        organization.id
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

// Get all users for the organization
router.get('/users', authenticateToken, async (req: Request, res: Response) => {
  try {
    // Get organizationId from authenticated user or query parameter (fallback to database)
    let organizationId = req.user?.organizationId || req.query.organizationId;

    // If no organizationId, get the only organization (single-tenant)
    if (!organizationId) {
      const orgResult = await db.query('SELECT id FROM organizations LIMIT 1');
      if (orgResult.rows.length > 0) {
        organizationId = orgResult.rows[0].id;
      } else {
        return res.status(404).json({
          success: false,
          error: 'No organization found'
        });
      }
    }

    logger.info('Fetching users for organization', { organizationId });

    // Check if Google Workspace is enabled
    const moduleCheckResult = await db.query(`
      SELECT om.is_enabled
      FROM organization_modules om
      JOIN modules m ON m.id = om.module_id
      WHERE om.organization_id = $1 AND m.slug = 'google-workspace'
    `, [organizationId]);

    const googleWorkspaceEnabled = moduleCheckResult.rows.length > 0 && moduleCheckResult.rows[0].is_enabled;

    let users = [];

    if (googleWorkspaceEnabled) {
      // Get users from Google Workspace synced data
      logger.info('Fetching users from Google Workspace cache');
      const gwUsersResult = await db.query(`
        SELECT
          id,
          google_id as external_id,
          email,
          given_name as firstName,
          family_name as lastName,
          full_name as displayName,
          is_admin,
          is_suspended,
          org_unit_path as department,
          job_title,
          last_login_time,
          creation_time,
          last_sync_at
        FROM gw_synced_users
        WHERE organization_id = $1
        ORDER BY full_name, email
      `, [organizationId]);

      users = gwUsersResult.rows.map((user: any) => {
        // In the future, we could check if user exists in multiple platforms
        const platforms = ['google_workspace'];

        // Example: If Microsoft 365 is also enabled and user exists there
        // if (microsoftEnabled && userExistsInMicrosoft(user.email)) {
        //   platforms.push('microsoft_365');
        // }

        return {
          id: user.id,
          email: user.email,
          firstName: user.firstname || user.email.split('@')[0],
          lastName: user.lastname || '',
          displayName: user.displayname || `${user.firstname || ''} ${user.lastname || ''}`.trim(),
          role: user.is_admin ? 'admin' : 'user',
          isActive: !user.is_suspended,
          platforms: platforms,
          department: user.department,
          jobTitle: user.job_title,
          lastLogin: user.last_login_time,
          createdAt: user.creation_time,
          source: 'google_workspace'
        };
      });
    } else {
      // Get users from local organization_users table
      logger.info('Fetching users from local database');
      const localUsersResult = await db.query(`
        SELECT
          id,
          email,
          first_name as firstName,
          last_name as lastName,
          role,
          is_active as isActive,
          created_at as createdAt,
          updated_at as updatedAt
        FROM organization_users
        WHERE organization_id = $1
        ORDER BY first_name, last_name, email
      `, [organizationId]);

      users = localUsersResult.rows.map((user: any) => ({
        ...user,
        displayName: `${user.firstname || ''} ${user.lastname || ''}`.trim(),
        platforms: ['local'],
        source: 'local'
      }));
    }

    logger.info('Users fetched', {
      organizationId,
      count: users.length,
      source: googleWorkspaceEnabled ? 'google_workspace' : 'local'
    });

    res.json({
      success: true,
      data: users,
      meta: {
        total: users.length,
        source: googleWorkspaceEnabled ? 'google_workspace' : 'local'
      }
    });
  } catch (error: any) {
    logger.error('Failed to fetch users', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users'
    });
  }
});

// Get organization statistics
router.get('/stats', authenticateToken, async (req: Request, res: Response) => {
  try {
    // Get organizationId from authenticated user or query parameter (fallback to database)
    let organizationId = req.user?.organizationId || req.query.organizationId;

    // If no organizationId, get the only organization (single-tenant)
    if (!organizationId) {
      const orgResult = await db.query('SELECT id FROM organizations LIMIT 1');
      if (orgResult.rows.length > 0) {
        organizationId = orgResult.rows[0].id;
      } else {
        return res.status(404).json({
          success: false,
          error: 'No organization found'
        });
      }
    }

    logger.info('Fetching organization stats', { organizationId });

    // Check if Google Workspace is enabled
    const moduleCheckResult = await db.query(`
      SELECT om.is_enabled, om.last_sync_at
      FROM organization_modules om
      JOIN modules m ON m.id = om.module_id
      WHERE om.organization_id = $1 AND m.slug = 'google-workspace'
    `, [organizationId]);

    const googleWorkspaceEnabled = moduleCheckResult.rows.length > 0 && moduleCheckResult.rows[0].is_enabled;
    const lastSync = moduleCheckResult.rows.length > 0 ? moduleCheckResult.rows[0].last_sync_at : null;

    let stats: {
      totalUsers: number;
      activeUsers: number;
      suspendedUsers: number;
      adminUsers: number;
      totalGroups: number;
      lastSync: Date | null;
      source: string;
    } = {
      totalUsers: 0,
      activeUsers: 0,
      suspendedUsers: 0,
      adminUsers: 0,
      totalGroups: 0,
      lastSync: null,
      source: 'local'
    };

    if (googleWorkspaceEnabled) {
      // Get stats from Google Workspace synced data
      const userStatsResult = await db.query(`
        SELECT
          COUNT(*) as total_users,
          COUNT(CASE WHEN is_suspended = false THEN 1 END) as active_users,
          COUNT(CASE WHEN is_suspended = true THEN 1 END) as suspended_users,
          COUNT(CASE WHEN is_admin = true THEN 1 END) as admin_users
        FROM gw_synced_users
        WHERE organization_id = $1
      `, [organizationId]);

      const userStats = userStatsResult.rows[0];

      // TODO: Add groups count when groups table is implemented
      stats = {
        totalUsers: parseInt(userStats.total_users) || 0,
        activeUsers: parseInt(userStats.active_users) || 0,
        suspendedUsers: parseInt(userStats.suspended_users) || 0,
        adminUsers: parseInt(userStats.admin_users) || 0,
        totalGroups: 0, // TODO: implement groups sync
        lastSync: lastSync,
        source: 'google_workspace'
      };
    } else {
      // Get stats from local users
      const localStatsResult = await db.query(`
        SELECT
          COUNT(*) as total_users,
          COUNT(CASE WHEN is_active = true THEN 1 END) as active_users,
          COUNT(CASE WHEN is_active = false THEN 1 END) as inactive_users,
          COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_users
        FROM organization_users
        WHERE organization_id = $1
      `, [organizationId]);

      const localStats = localStatsResult.rows[0];
      stats = {
        totalUsers: parseInt(localStats.total_users) || 0,
        activeUsers: parseInt(localStats.active_users) || 0,
        suspendedUsers: parseInt(localStats.inactive_users) || 0,
        adminUsers: parseInt(localStats.admin_users) || 0,
        totalGroups: 0,
        lastSync: null,
        source: 'local'
      };
    }

    res.json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    logger.error('Failed to fetch organization stats', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch organization statistics'
    });
  }
});

// Get all administrators for the organization
router.get('/admins', authenticateToken, async (req: Request, res: Response) => {
  try {
    // Get organizationId from authenticated user
    let organizationId = req.user?.organizationId;

    // If no organizationId, get the only organization (single-tenant)
    if (!organizationId) {
      const orgResult = await db.query('SELECT id FROM organizations LIMIT 1');
      if (orgResult.rows.length > 0) {
        organizationId = orgResult.rows[0].id;
      } else {
        return res.status(404).json({
          success: false,
          error: 'No organization found'
        });
      }
    }

    // Get all admins from organization_users table
    const adminsResult = await db.query(`
      SELECT
        id, email, first_name, last_name, role,
        is_active, created_at, last_login
      FROM organization_users
      WHERE organization_id = $1 AND role = 'admin'
      ORDER BY first_name, last_name, email
    `, [organizationId]);

    res.json({
      success: true,
      data: adminsResult.rows
    });
  } catch (error: any) {
    logger.error('Failed to fetch admins', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch administrators'
    });
  }
});

// Promote a user to admin
router.post('/admins/promote/:userId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    // Get organizationId from authenticated user
    let organizationId = req.user?.organizationId;

    if (!organizationId) {
      const orgResult = await db.query('SELECT id FROM organizations LIMIT 1');
      if (orgResult.rows.length > 0) {
        organizationId = orgResult.rows[0].id;
      }
    }

    // Check if requesting user is admin
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only administrators can promote users'
      });
    }

    // Update user role to admin
    const result = await db.query(`
      UPDATE organization_users
      SET role = 'admin', updated_at = NOW()
      WHERE id = $1 AND organization_id = $2
      RETURNING id, email, first_name, last_name, role
    `, [userId, organizationId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    logger.info('User promoted to admin', {
      promotedUserId: userId,
      promotedBy: req.user?.userId
    });

    res.json({
      success: true,
      data: result.rows[0],
      message: 'User promoted to administrator successfully'
    });
  } catch (error: any) {
    logger.error('Failed to promote user', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to promote user'
    });
  }
});

// Demote an admin to regular user
router.post('/admins/demote/:userId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    // Get organizationId from authenticated user
    let organizationId = req.user?.organizationId;

    if (!organizationId) {
      const orgResult = await db.query('SELECT id FROM organizations LIMIT 1');
      if (orgResult.rows.length > 0) {
        organizationId = orgResult.rows[0].id;
      }
    }

    // Check if requesting user is admin
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only administrators can demote users'
      });
    }

    // Prevent self-demotion
    if (userId === req.user?.userId) {
      return res.status(400).json({
        success: false,
        error: 'You cannot demote yourself'
      });
    }

    // Check if there will be at least one admin left
    const adminCount = await db.query(`
      SELECT COUNT(*) as count
      FROM organization_users
      WHERE organization_id = $1 AND role = 'admin'
    `, [organizationId]);

    if (parseInt(adminCount.rows[0].count) <= 1) {
      return res.status(400).json({
        success: false,
        error: 'Cannot demote the last administrator'
      });
    }

    // Update user role to user
    const result = await db.query(`
      UPDATE organization_users
      SET role = 'user', updated_at = NOW()
      WHERE id = $1 AND organization_id = $2
      RETURNING id, email, first_name, last_name, role
    `, [userId, organizationId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    logger.info('Admin demoted to user', {
      demotedUserId: userId,
      demotedBy: req.user?.userId
    });

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Administrator demoted to regular user successfully'
    });
  } catch (error: any) {
    logger.error('Failed to demote admin', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to demote administrator'
    });
  }
});

export default router;