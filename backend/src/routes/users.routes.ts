import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth';
import { userSyncService } from '../services/user-sync.service';
import { googleWorkspaceService } from '../services/google-workspace.service';
import { logger } from '../utils/logger';
import { db } from '../database/connection';

const router = Router();

/**
 * @openapi
 * /user:
 *   get:
 *     summary: List all users
 *     description: |
 *       Get all users for the organization with platform indicators.
 *       Supports filtering by platform and active status, and pagination.
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: platform
 *         schema:
 *           type: string
 *           enum: [google, microsoft, local]
 *         description: Filter by source platform
 *       - in: query
 *         name: active
 *         schema:
 *           type: string
 *           enum: ['true', 'false']
 *         description: Filter by active status
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *           maximum: 500
 *         description: Maximum number of users to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of users to skip
 *     responses:
 *       200:
 *         description: List of users
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *                 total:
 *                   type: integer
 *                   description: Total number of users returned
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalError'
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
 * @openapi
 * /user/stats:
 *   get:
 *     summary: Get user statistics
 *     description: |
 *       Get user statistics by role, status, and employee type.
 *       Includes counts of managers and orphaned users (users without managers).
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       description: Total active users
 *                     byRole:
 *                       type: object
 *                       properties:
 *                         admin:
 *                           type: integer
 *                         manager:
 *                           type: integer
 *                         user:
 *                           type: integer
 *                     byEmployeeType:
 *                       type: object
 *                       additionalProperties:
 *                         type: integer
 *                       description: User counts by employee type
 *                     managers:
 *                       type: integer
 *                       description: Number of users with direct reports
 *                     orphans:
 *                       type: integer
 *                       description: Number of users without a manager (excluding CEO)
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalError'
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
 * @openapi
 * /user/sync/google-workspace:
 *   post:
 *     summary: Sync users from Google Workspace
 *     description: |
 *       Trigger a sync of users from Google Workspace to Helios.
 *       Creates new users, updates existing users, and marks removed users as inactive.
 *       Requires admin permission.
 *     tags: [Users, Google Workspace]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [domain]
 *             properties:
 *               domain:
 *                 type: string
 *                 description: Google Workspace domain to sync
 *                 example: example.com
 *               adminEmail:
 *                 type: string
 *                 format: email
 *                 description: Admin email for impersonation
 *                 example: admin@example.com
 *     responses:
 *       200:
 *         description: Sync completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 usersCreated:
 *                   type: integer
 *                 usersUpdated:
 *                   type: integer
 *                 usersDisabled:
 *                   type: integer
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/InternalError'
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
 * @openapi
 * /user/sync/all:
 *   post:
 *     summary: Sync users from all platforms
 *     description: |
 *       Trigger a sync of users from all connected platforms (Google Workspace, Microsoft 365).
 *       Returns results for each platform and a combined summary.
 *       Requires admin permission.
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Sync completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 results:
 *                   type: object
 *                   properties:
 *                     google_workspace:
 *                       type: object
 *                       nullable: true
 *                     microsoft_365:
 *                       type: object
 *                       nullable: true
 *                     total:
 *                       type: object
 *                       properties:
 *                         usersCreated:
 *                           type: integer
 *                         usersUpdated:
 *                           type: integer
 *                         usersDisabled:
 *                           type: integer
 *                 summary:
 *                   type: object
 *                   properties:
 *                     platforms_synced:
 *                       type: integer
 *                     total_users_created:
 *                       type: integer
 *                     total_users_updated:
 *                       type: integer
 *                     total_users_disabled:
 *                       type: integer
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/InternalError'
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
 * @openapi
 * /user/{userId}:
 *   get:
 *     summary: Get a specific user
 *     description: |
 *       Get detailed information about a specific user including all platform data.
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The user's unique identifier
 *     responses:
 *       200:
 *         description: User details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalError'
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