import { logger } from '../utils/logger';
import { db } from '../database/connection';
import { googleWorkspaceService } from './google-workspace.service';

interface SyncConfig {
  minInterval: number; // Platform minimum in seconds
  defaultInterval: number; // Default for new tenants in seconds
  maxInterval: number; // Maximum allowed in seconds
}

export class SyncSchedulerService {
  private syncIntervals: Map<string, NodeJS.Timeout> = new Map();
  private config: SyncConfig;

  constructor() {
    this.config = {
      minInterval: parseInt(process.env.MIN_SYNC_INTERVAL_SECONDS || '300'),  // 5 minutes
      defaultInterval: parseInt(process.env.DEFAULT_SYNC_INTERVAL_SECONDS || '900'),  // 15 minutes
      maxInterval: parseInt(process.env.MAX_SYNC_INTERVAL_SECONDS || '86400')  // 24 hours
    };

    logger.info('Sync scheduler initialized', this.config);
  }

  /**
   * Start sync for a tenant with their configured interval
   */
  async startTenantSync(tenantId: string): Promise<void> {
    try {
      // Get tenant sync interval from database
      const result = await db.query(
        'SELECT sync_interval_seconds FROM tenant_settings WHERE tenant_id = $1',
        [tenantId]
      );

      const interval = result.rows[0]?.sync_interval_seconds || this.config.defaultInterval;

      // Ensure interval respects platform limits
      const validInterval = Math.max(
        this.config.minInterval,
        Math.min(interval, this.config.maxInterval)
      );

      // Clear existing interval if any
      this.stopTenantSync(tenantId);

      // Set up new interval
      const intervalMs = validInterval * 1000;  // Convert seconds to milliseconds
      const timeout = setInterval(() => {
        this.syncTenantData(tenantId).catch(error => {
          logger.error('Sync failed for tenant', { tenantId, error });
        });
      }, intervalMs);

      this.syncIntervals.set(tenantId, timeout);

      // Run initial sync
      await this.syncTenantData(tenantId);

      logger.info('Started sync for tenant', { tenantId, intervalSeconds: validInterval });
    } catch (error) {
      logger.error('Failed to start tenant sync', { tenantId, error });
    }
  }

  /**
   * Stop sync for a tenant
   */
  stopTenantSync(tenantId: string): void {
    const interval = this.syncIntervals.get(tenantId);
    if (interval) {
      clearInterval(interval);
      this.syncIntervals.delete(tenantId);
      logger.info('Stopped sync for tenant', { tenantId });
    }
  }

  /**
   * Sync data for a specific tenant
   */
  async syncTenantData(tenantId: string): Promise<void> {
    try {
      // Get tenant info and admin email from credentials
      const tenantResult = await db.query(`
        SELECT t.domain, t.name, tc.admin_email_stored as admin_email
        FROM tenants t
        LEFT JOIN tenant_credentials tc ON t.id = tc.tenant_id
        WHERE t.id = $1
      `, [tenantId]);

      if (tenantResult.rows.length === 0) {
        throw new Error('Tenant not found');
      }

      const tenant = tenantResult.rows[0];

      if (!tenant.admin_email) {
        throw new Error('Admin email not configured for tenant');
      }

      logger.info('Starting sync for tenant', { tenantId, domain: tenant.domain });

      // Get users from Google Workspace
      const usersResult = await googleWorkspaceService.getUsers(
        tenantId,
        tenant.domain,
        tenant.admin_email,
        500
      );

      if (!usersResult.success || !usersResult.users) {
        throw new Error(usersResult.error || 'Failed to fetch users from Google Workspace');
      }

      const users = usersResult.users;

      // Calculate statistics
      const stats = {
        totalUsers: users.length,
        activeUsers: users.filter(u => !u.suspended).length,
        suspendedUsers: users.filter(u => u.suspended).length,
        adminUsers: users.filter(u => u.isAdmin || u.isDelegatedAdmin).length
      };

      // Update dashboard cache
      await db.query(`
        INSERT INTO dashboard_cache (
          tenant_id, total_users, active_users, suspended_users,
          admin_users, last_sync, sync_status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, NOW(), 'healthy', NOW(), NOW())
        ON CONFLICT (tenant_id)
        DO UPDATE SET
          total_users = EXCLUDED.total_users,
          active_users = EXCLUDED.active_users,
          suspended_users = EXCLUDED.suspended_users,
          admin_users = EXCLUDED.admin_users,
          last_sync = NOW(),
          sync_status = 'healthy',
          error_message = NULL,
          updated_at = NOW()
      `, [tenantId, stats.totalUsers, stats.activeUsers, stats.suspendedUsers, stats.adminUsers]);

      // Update tenant_modules table with user count and last sync
      await db.query(`
        UPDATE tenant_modules
        SET user_count = $1,
            last_sync = NOW(),
            updated_at = NOW()
        WHERE tenant_id = $2 AND module_name = 'google_workspace'
      `, [stats.totalUsers, tenantId]);

      // Clear and update user cache
      await db.query('DELETE FROM user_cache WHERE tenant_id = $1', [tenantId]);

      // Store all users in the user_data JSONB column
      if (users.length > 0) {
        await db.query(`
          INSERT INTO user_cache (tenant_id, user_data, cached_at, expires_at)
          VALUES ($1, $2, NOW(), NOW() + INTERVAL '24 hours')
        `, [
          tenantId,
          JSON.stringify(users)
        ]);
      }

      logger.info('Sync completed successfully', {
        tenantId,
        domain: tenant.domain,
        stats
      });

    } catch (error: any) {
      // Update sync status with error
      await db.query(`
        INSERT INTO sync_status (tenant_id, sync_type, sync_status, error_message, last_sync_at, updated_at)
        VALUES ($1, 'all', 'failed', $2, NOW(), NOW())
        ON CONFLICT (tenant_id, sync_type)
        DO UPDATE SET
          sync_status = 'failed',
          error_message = EXCLUDED.error_message,
          last_sync_at = NOW(),
          updated_at = NOW()
      `, [tenantId, error.message]);

      logger.error('Sync failed for tenant', { tenantId, error: error.message });
      throw error;
    }
  }

  /**
   * Manual sync trigger for immediate sync
   */
  async manualSync(tenantId: string): Promise<{ success: boolean; message: string; stats?: any }> {
    try {
      await this.syncTenantData(tenantId);

      // Get updated stats
      const statsResult = await db.query(
        'SELECT total_users, active_users, suspended_users, admin_users, last_sync FROM dashboard_cache WHERE tenant_id = $1',
        [tenantId]
      );

      return {
        success: true,
        message: 'Sync completed successfully',
        stats: statsResult.rows[0] || null
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Sync failed'
      };
    }
  }

  /**
   * Get tenant dashboard stats
   */
  async getTenantStats(tenantId: string): Promise<any> {
    const result = await db.query(
      `SELECT total_users, active_users, suspended_users, admin_users,
              last_sync, sync_status, error_message
       FROM dashboard_cache
       WHERE tenant_id = $1`,
      [tenantId]
    );

    if (result.rows.length === 0) {
      return {
        totalUsers: 0,
        activeUsers: 0,
        suspendedUsers: 0,
        adminUsers: 0,
        lastSync: null,
        syncStatus: 'pending',
        errorMessage: null
      };
    }

    const row = result.rows[0];
    return {
      totalUsers: row.total_users,
      activeUsers: row.active_users,
      suspendedUsers: row.suspended_users,
      adminUsers: row.admin_users,
      lastSync: row.last_sync,
      syncStatus: row.sync_status,
      errorMessage: row.error_message
    };
  }

  /**
   * Get cached users for a tenant
   */
  async getCachedUsers(tenantId: string): Promise<any[]> {
    const result = await db.query(
      'SELECT user_data FROM user_cache WHERE tenant_id = $1 AND expires_at > NOW()',
      [tenantId]
    );

    if (result.rows.length === 0) {
      return [];
    }

    return JSON.parse(result.rows[0].user_data);
  }
}

export const syncScheduler = new SyncSchedulerService();