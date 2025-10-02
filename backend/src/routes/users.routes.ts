import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth';
import { userSyncService } from '../services/user-sync.service';
import { googleWorkspaceService } from '../services/google-workspace.service';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/users
 * Get all users for the tenant with platform indicators
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