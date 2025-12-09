import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth';
import { userSyncService } from '../services/user-sync.service';
import { googleWorkspaceService } from '../services/google-workspace.service';
import { logger } from '../utils/logger';
import { db } from '../database/connection';

const router = Router();

/**
 * GET /api/users
 * Get all users for the organization with platform indicators
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: 'Organization ID required'
      });
    }

    const { platform, active, limit = 100, offset = 0 } = req.query;

    const users = await userSyncService.getUnifiedUsers(organizationId, {
      platform: platform as string,
      isActive: active === 'true' ? true : active === 'false' ? false : undefined,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });

    res.json({
      success: true,
      data: users,
      total: users.length
    });

  } catch (error: any) {
    logger.error('Failed to get users', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/users/stats
 * Get user statistics by role, status, and type
 */
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: 'Organization ID required'
      });
    }

    // Get counts by role
    const roleCountsResult = await db.query(`
      SELECT
        role,
        COUNT(*) as count
      FROM organization_users
      WHERE organization_id = $1 AND is_active = true
      GROUP BY role
    `, [organizationId]);

    // Get counts by employee type
    const employeeTypeResult = await db.query(`
      SELECT
        COALESCE(employee_type, 'Unknown') as employee_type,
        COUNT(*) as count
      FROM organization_users
      WHERE organization_id = $1 AND is_active = true
      GROUP BY employee_type
    `, [organizationId]);

    // Get managers count (users who have direct reports)
    const managersResult = await db.query(`
      SELECT COUNT(DISTINCT reporting_manager_id) as count
      FROM organization_users
      WHERE organization_id = $1
        AND reporting_manager_id IS NOT NULL
        AND is_active = true
    `, [organizationId]);

    // Get orphaned users count (no manager, not CEO)
    const orphansResult = await db.query(`
      SELECT COUNT(*) as count
      FROM organization_users
      WHERE organization_id = $1
        AND is_active = true
        AND reporting_manager_id IS NULL
        AND job_title NOT LIKE '%Chief Executive%'
        AND job_title != 'CEO'
    `, [organizationId]);

    // Get total active users
    const totalResult = await db.query(`
      SELECT COUNT(*) as count
      FROM organization_users
      WHERE organization_id = $1 AND is_active = true
    `, [organizationId]);

    // Build role counts object
    const roleCounts: Record<string, number> = {};
    roleCountsResult.rows.forEach((row: any) => {
      roleCounts[row.role] = parseInt(row.count);
    });

    // Build employee type counts object
    const employeeTypeCounts: Record<string, number> = {};
    employeeTypeResult.rows.forEach((row: any) => {
      employeeTypeCounts[row.employee_type] = parseInt(row.count);
    });

    res.json({
      success: true,
      data: {
        total: parseInt(totalResult.rows[0].count),
        byRole: {
          admin: roleCounts['admin'] || 0,
          manager: roleCounts['manager'] || 0,
          user: roleCounts['user'] || 0
        },
        byEmployeeType: employeeTypeCounts,
        managers: parseInt(managersResult.rows[0].count),
        orphans: parseInt(orphansResult.rows[0].count)
      }
    });

  } catch (error: any) {
    logger.error('Failed to get user stats', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/users/sync/google-workspace
 * Sync users from Google Workspace
 */
router.post('/sync/google-workspace', requirePermission('admin'), async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    const { domain, adminEmail } = req.body;

    if (!organizationId || !domain) {
      return res.status(400).json({
        success: false,
        error: 'Organization ID and domain required'
      });
    }

    // Start sync process
    const result = await userSyncService.syncGoogleWorkspaceUsers(
      organizationId,
      domain,
      adminEmail
    );

    res.json(result);

  } catch (error: any) {
    logger.error('User sync failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/users/sync/all
 * Sync users from all connected platforms
 */
router.post('/sync/all', requirePermission('admin'), async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: 'Organization ID required'
      });
    }

    const results = {
      google_workspace: null as any,
      microsoft_365: null as any,
      total: {
        usersCreated: 0,
        usersUpdated: 0,
        usersDisabled: 0
      }
    };

    // Check if Google Workspace is enabled
    const gwStatus = await googleWorkspaceService.getSetupStatus(organizationId);
    if (gwStatus.isConfigured) {
      const { domain } = gwStatus.config || {};
      if (domain) {
        results.google_workspace = await userSyncService.syncGoogleWorkspaceUsers(
          organizationId,
          domain,
          gwStatus.config?.adminEmail
        );

        if (results.google_workspace.success) {
          results.total.usersCreated += results.google_workspace.usersCreated;
          results.total.usersUpdated += results.google_workspace.usersUpdated;
          results.total.usersDisabled += results.google_workspace.usersDisabled;
        }
      }
    }

    // Future: Add Microsoft 365 sync here
    // if (m365Status.isConfigured) { ... }

    res.json({
      success: true,
      results,
      summary: {
        platforms_synced: Object.keys(results).filter(k => k !== 'total' && results[k as keyof typeof results] !== null).length,
        total_users_created: results.total.usersCreated,
        total_users_updated: results.total.usersUpdated,
        total_users_disabled: results.total.usersDisabled
      }
    });

  } catch (error: any) {
    logger.error('Full sync failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/users/:userId
 * Get a specific user with all platform data
 */
router.get('/:userId', requireAuth, async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    const { userId } = req.params;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: 'Organization ID required'
      });
    }

    const users = await userSyncService.getUnifiedUsers(organizationId, {
      limit: 1
    });

    const user = users.find(u => u.id === userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user
    });

  } catch (error: any) {
    logger.error('Failed to get user', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;