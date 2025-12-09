import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { db } from '../database/connection';
import { logger } from '../utils/logger';
import { cacheService } from '../services/cache.service';
import { activityTracker } from '../services/activity-tracker.service';

const router = Router();
router.use(authenticateToken);

/**
 * GET /api/dashboard/stats
 * Get real dashboard statistics
 */
router.get('/stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      res.status(400).json({ success: false, error: 'Organization ID not found' });
      return;
    }

    const cacheKey = cacheService.keys.dashboardStats(organizationId);

    const stats = await cacheService.remember(cacheKey, async () => {
      // Get real statistics from database
      const [
        totalUsers,
        activeUsers,
        suspendedUsers,
        deletedUsers,
        totalGroups,
        googleUsers,
        localUsers,
        guestUsers,
        admins
      ] = await Promise.all([
        db.query('SELECT COUNT(*) as count FROM organization_users WHERE organization_id = $1', [organizationId]),
        db.query('SELECT COUNT(*) as count FROM organization_users WHERE organization_id = $1 AND is_active = true', [organizationId]),
        db.query('SELECT COUNT(*) as count FROM organization_users WHERE organization_id = $1 AND is_active = false', [organizationId]),
        db.query('SELECT COUNT(*) as count FROM organization_users WHERE organization_id = $1 AND user_status = \'deleted\'', [organizationId]),
        db.query('SELECT COUNT(*) as count FROM access_groups WHERE organization_id = $1', [organizationId]),
        db.query('SELECT COUNT(*) as count FROM organization_users WHERE organization_id = $1 AND google_workspace_id IS NOT NULL', [organizationId]),
        db.query('SELECT COUNT(*) as count FROM organization_users WHERE organization_id = $1 AND google_workspace_id IS NULL', [organizationId]),
        db.query('SELECT COUNT(*) as count FROM organization_users WHERE organization_id = $1 AND user_type = \'guest\'', [organizationId]),
        db.query('SELECT COUNT(*) as count FROM organization_users WHERE organization_id = $1 AND role = \'admin\'', [organizationId])
      ]);

      // Check if Google Workspace is configured
      const gwConfig = await db.query(
        'SELECT COUNT(*) as count FROM gw_credentials WHERE organization_id = $1',
        [organizationId]
      );

      const isGoogleConfigured = gwConfig.rows[0].count > 0;

      // Get last sync time if Google Workspace is configured
      // Use gw_synced_users updated_at as a proxy for last sync
      let lastSync: string | null = null;
      if (isGoogleConfigured) {
        const syncResult = await db.query(`
          SELECT MAX(updated_at) as last_sync
          FROM gw_synced_users
          WHERE organization_id = $1
        `, [organizationId]);
        lastSync = syncResult.rows[0]?.last_sync || null;
      }

      return {
        google: isGoogleConfigured ? {
          connected: true,
          totalUsers: parseInt(googleUsers.rows[0].count),
          suspendedUsers: parseInt(suspendedUsers.rows[0].count),
          adminUsers: parseInt(admins.rows[0].count),
          lastSync: lastSync
        } : {
          connected: false,
          totalUsers: 0,
          suspendedUsers: 0,
          adminUsers: 0,
          lastSync: null as string | null
        },
        helios: {
          totalUsers: parseInt(localUsers.rows[0].count),
          guestUsers: parseInt(guestUsers.rows[0].count)
        },
        microsoft: {
          connected: false,
          totalUsers: 0,
          disabledUsers: 0,
          adminUsers: 0,
          lastSync: null as string | null
        }
      };
    }, 60); // Cache for 1 minute

    res.json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    logger.error('Failed to get dashboard stats', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get dashboard statistics'
    });
  }
});

/**
 * GET /api/dashboard/activity
 * Get recent activity events
 */
router.get('/activity', async (req: Request, res: Response): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      res.status(400).json({ success: false, error: 'Organization ID not found' });
      return;
    }

    const activity = await activityTracker.getRecentActivity(organizationId, 10);

    res.json({
      success: true,
      data: activity
    });
  } catch (error: any) {
    logger.error('Failed to get activity', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get activity'
    });
  }
});

/**
 * GET /api/dashboard/alerts
 * Get system alerts
 */
router.get('/alerts', async (req: Request, res: Response): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      res.status(400).json({ success: false, error: 'Organization ID not found' });
      return;
    }

    const alerts = [];

    // Check for suspended users
    const suspendedResult = await db.query(
      'SELECT COUNT(*) as count FROM organization_users WHERE organization_id = $1 AND is_active = false',
      [organizationId]
    );
    const suspendedCount = parseInt(suspendedResult.rows[0].count);

    if (suspendedCount > 0) {
      alerts.push({
        id: 'suspended-users',
        severity: 'warning',
        title: `${suspendedCount} suspended users`,
        description: 'Review and restore or remove suspended users',
        link: '/users?status=suspended'
      });
    }

    // Check for sync issues
    const syncResult = await db.query(`
      SELECT COUNT(*) as count
      FROM security_events
      WHERE organization_id = $1
      AND event_type = 'sync.failed'
      AND created_at > NOW() - INTERVAL '24 hours'
    `, [organizationId]);
    const failedSyncs = parseInt(syncResult.rows[0].count);

    if (failedSyncs > 0) {
      alerts.push({
        id: 'sync-failures',
        severity: 'error',
        title: `${failedSyncs} sync failures in last 24 hours`,
        description: 'Check Google Workspace configuration',
        link: '/settings'
      });
    }

    // Check if Google Workspace needs initial sync
    const gwCheck = await db.query(`
      SELECT gc.created_at,
             (SELECT COUNT(*) FROM organization_users WHERE organization_id = $1 AND google_workspace_id IS NOT NULL) as synced_users
      FROM gw_credentials gc
      WHERE gc.organization_id = $1
    `, [organizationId]);

    if (gwCheck.rows.length > 0 && gwCheck.rows[0].synced_users === '0') {
      alerts.push({
        id: 'initial-sync',
        severity: 'info',
        title: 'Initial Google Workspace sync recommended',
        description: 'Sync users from Google Workspace to get started',
        link: '/settings',
        action: 'Sync Now'
      });
    }

    res.json({
      success: true,
      data: alerts
    });
  } catch (error: any) {
    logger.error('Failed to get alerts', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get alerts'
    });
  }
});

/**
 * GET /api/dashboard/widgets
 * Get user's widget preferences
 */
router.get('/widgets', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(400).json({ success: false, error: 'User ID not found' });
      return;
    }

    const cacheKey = cacheService.keys.dashboardWidgets(userId);

    const widgets = await cacheService.remember(cacheKey, async () => {
      const result = await db.query(`
        SELECT widget_id, position, is_visible, config
        FROM user_dashboard_widgets
        WHERE user_id = $1
        ORDER BY position
      `, [userId]);

      // If no widgets configured, return defaults matching frontend widget registry
      if (result.rows.length === 0) {
        return [
          { widgetId: 'google-total-users', position: 0, isVisible: true },
          { widgetId: 'google-suspended', position: 1, isVisible: true },
          { widgetId: 'google-admins', position: 2, isVisible: true },
          { widgetId: 'helios-total-users', position: 3, isVisible: true },
          { widgetId: 'helios-guests', position: 4, isVisible: true },
          { widgetId: 'system-alerts', position: 5, isVisible: true }
        ];
      }

      return result.rows.map((row: any) => ({
        widgetId: row.widget_id,
        position: row.position,
        isVisible: row.is_visible,
        config: row.config
      }));
    }, 300); // Cache for 5 minutes

    res.json({
      success: true,
      data: widgets
    });
  } catch (error: any) {
    logger.error('Failed to get widgets', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get widget preferences'
    });
  }
});

/**
 * PUT /api/dashboard/widgets
 * Save user's widget preferences
 */
router.put('/widgets', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const widgets = req.body.widgets;

    if (!userId) {
      res.status(400).json({ success: false, error: 'User ID not found' });
      return;
    }

    if (!Array.isArray(widgets)) {
      res.status(400).json({ success: false, error: 'Invalid widget data' });
      return;
    }

    // Begin transaction
    await db.query('BEGIN');

    try {
      // Clear existing widgets
      await db.query('DELETE FROM user_dashboard_widgets WHERE user_id = $1', [userId]);

      // Insert new widget preferences
      for (let i = 0; i < widgets.length; i++) {
        const widget = widgets[i];
        await db.query(`
          INSERT INTO user_dashboard_widgets (user_id, widget_id, position, is_visible, config)
          VALUES ($1, $2, $3, $4, $5)
        `, [userId, widget.widgetId, i, widget.isVisible !== false, JSON.stringify(widget.config || {})]);
      }

      await db.query('COMMIT');

      // Clear cache
      await cacheService.del(cacheService.keys.dashboardWidgets(userId));

      res.json({
        success: true,
        message: 'Widget preferences saved'
      });
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error: any) {
    logger.error('Failed to save widgets', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to save widget preferences'
    });
  }
});

export default router;