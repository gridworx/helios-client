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
   * Start sync for an organization with their configured interval
   */
  async startOrganizationSync(organizationId: string): Promise<void> {
    try {
      // Get organization sync interval from database (use default for now)
      const interval = this.config.defaultInterval;

      // Ensure interval respects platform limits
      const validInterval = Math.max(
        this.config.minInterval,
        Math.min(interval, this.config.maxInterval)
      );

      // Clear existing interval if any
      this.stopOrganizationSync(organizationId);

      // Set up new interval
      const intervalMs = validInterval * 1000;  // Convert seconds to milliseconds
      const timeout = setInterval(() => {
        this.syncOrganizationData(organizationId).catch(error => {
          logger.error('Sync failed for organization', { organizationId, error });
        });
      }, intervalMs);

      this.syncIntervals.set(organizationId, timeout);

      // Run initial sync
      await this.syncOrganizationData(organizationId);

      logger.info('Started sync for organization', { organizationId, intervalSeconds: validInterval });
    } catch (error) {
      logger.error('Failed to start organization sync', { organizationId, error });
    }
  }

  /**
   * Stop sync for an organization
   */
  stopOrganizationSync(organizationId: string): void {
    const interval = this.syncIntervals.get(organizationId);
    if (interval) {
      clearInterval(interval);
      this.syncIntervals.delete(organizationId);
      logger.info('Stopped sync for organization', { organizationId });
    }
  }

  /**
   * Sync data for a specific organization
   */
  async syncOrganizationData(organizationId: string): Promise<void> {
    try {
      // Get organization info and admin email from credentials
      const orgResult = await db.query(`
        SELECT o.domain, o.name, gc.admin_email
        FROM organizations o
        LEFT JOIN gw_credentials gc ON o.id = gc.organization_id
        WHERE o.id = $1
      `, [organizationId]);

      if (orgResult.rows.length === 0) {
        throw new Error('Organization not found');
      }

      const org = orgResult.rows[0];

      if (!org.admin_email) {
        throw new Error('Admin email not configured for organization');
      }

      logger.info('Starting sync for organization', { organizationId, domain: org.domain });

      // Get users from Google Workspace
      const usersResult = await googleWorkspaceService.getUsers(
        organizationId,
        org.domain,
        org.admin_email,
        500
      );

      if (!usersResult.success || !usersResult.users) {
        throw new Error(usersResult.error || 'Failed to fetch users from Google Workspace');
      }

      const users = usersResult.users;

      // Clear existing synced users for this organization
      await db.query('DELETE FROM gw_synced_users WHERE organization_id = $1', [organizationId]);

      // Insert all users into gw_synced_users table
      for (const user of users) {
        await db.query(`
          INSERT INTO gw_synced_users (
            organization_id, google_id, email,
            given_name, family_name, full_name,
            is_admin, is_suspended, org_unit_path,
            creation_time, last_login_time, raw_data,
            last_sync_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
        `, [
          organizationId,
          user.id,
          user.primaryEmail,
          user.name?.givenName || '',
          user.name?.familyName || '',
          user.name?.fullName || '',
          user.isAdmin || user.isDelegatedAdmin || false,
          user.suspended || false,
          user.orgUnitPath || '/',
          user.creationTime || null,
          user.lastLoginTime || null,
          JSON.stringify(user)
        ]);
      }

      // Update organization_modules table with last sync
      const moduleResult = await db.query(
        `SELECT id FROM modules WHERE slug = 'google-workspace' LIMIT 1`
      );

      if (moduleResult.rows.length > 0) {
        const moduleId = moduleResult.rows[0].id;
        await db.query(`
          UPDATE organization_modules
          SET last_sync_at = NOW(),
              config = config || $3::jsonb,
              updated_at = NOW()
          WHERE organization_id = $1 AND module_id = $2
        `, [organizationId, moduleId, JSON.stringify({ user_count: users.length })]);
      }

      logger.info('Sync completed successfully', {
        organizationId,
        domain: org.domain,
        userCount: users.length
      });

    } catch (error: any) {
      logger.error('Sync failed for organization', { organizationId, error: error.message });
      throw error;
    }
  }

  /**
   * Manual sync trigger for immediate sync
   */
  async manualSync(organizationId: string): Promise<{ success: boolean; message: string; stats?: any }> {
    try {
      await this.syncOrganizationData(organizationId);

      // Get updated stats from gw_synced_users
      const statsResult = await db.query(
        `SELECT COUNT(*) as total_users,
                COUNT(CASE WHEN is_suspended = false THEN 1 END) as active_users,
                COUNT(CASE WHEN is_suspended = true THEN 1 END) as suspended_users,
                COUNT(CASE WHEN is_admin = true THEN 1 END) as admin_users,
                MAX(last_sync_at) as last_sync
         FROM gw_synced_users WHERE organization_id = $1`,
        [organizationId]
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
   * Get organization dashboard stats
   */
  async getOrganizationStats(organizationId: string): Promise<any> {
    const result = await db.query(
      `SELECT COUNT(*) as total_users,
              COUNT(CASE WHEN is_suspended = false THEN 1 END) as active_users,
              COUNT(CASE WHEN is_suspended = true THEN 1 END) as suspended_users,
              COUNT(CASE WHEN is_admin = true THEN 1 END) as admin_users,
              MAX(last_sync_at) as last_sync
       FROM gw_synced_users
       WHERE organization_id = $1`,
      [organizationId]
    );

    if (result.rows.length === 0 || result.rows[0].total_users == 0) {
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
      totalUsers: parseInt(row.total_users) || 0,
      activeUsers: parseInt(row.active_users) || 0,
      suspendedUsers: parseInt(row.suspended_users) || 0,
      adminUsers: parseInt(row.admin_users) || 0,
      lastSync: row.last_sync,
      syncStatus: 'synced',
      errorMessage: null
    };
  }

  /**
   * Get cached users for an organization
   */
  async getCachedUsers(organizationId: string): Promise<any[]> {
    const result = await db.query(
      `SELECT
        id,
        google_id,
        email,
        full_name,
        given_name,
        family_name,
        org_unit_path,
        department,
        job_title,
        is_admin,
        is_suspended,
        last_login_time,
        creation_time,
        last_sync_at
       FROM gw_synced_users
       WHERE organization_id = $1
       ORDER BY full_name`,
      [organizationId]
    );

    return result.rows;
  }
}

export const syncScheduler = new SyncSchedulerService();