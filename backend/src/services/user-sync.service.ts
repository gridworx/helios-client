import { db } from '../database/connection';
import { logger } from '../utils/logger';
import { googleWorkspaceService } from './google-workspace.service';

export interface UnifiedUser {
  id: string;
  tenantId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  displayName?: string;
  avatarUrl?: string;
  jobTitle?: string;
  department?: string;
  phone?: string;
  mobile?: string;
  isActive: boolean;
  isSuspended: boolean;
  isAdmin: boolean;
  platforms: {
    platform: string;
    platformUserId: string;
    isActive: boolean;
    isAdmin: boolean;
    isSuspended: boolean;
    lastSynced: Date;
  }[];
}

export class UserSyncService {
  /**
   * Sync users from Google Workspace to unified users table
   */
  async syncGoogleWorkspaceUsers(tenantId: string, domain: string, adminEmail?: string): Promise<{
    success: boolean;
    usersCreated: number;
    usersUpdated: number;
    usersDisabled: number;
    error?: string;
  }> {
    const syncLogId = await this.createSyncLog(tenantId, 'google_workspace', 'full');
    const startTime = Date.now();

    try {
      logger.info('Starting Google Workspace user sync', { tenantId, domain });

      // Fetch users from Google Workspace
      const result = await googleWorkspaceService.getUsers(tenantId, domain, adminEmail);

      if (!result.success || !result.users) {
        throw new Error(result.error || 'Failed to fetch users from Google Workspace');
      }

      const googleUsers = result.users;
      let usersCreated = 0;
      let usersUpdated = 0;
      let usersDisabled = 0;

      // Start transaction
      await db.query('BEGIN');

      try {
        // Process each Google user
        for (const googleUser of googleUsers) {
          // Check if user already exists
          const existingUser = await db.query(
            'SELECT id FROM users WHERE tenant_id = $1 AND email = $2',
            [tenantId, googleUser.primaryEmail.toLowerCase()]
          );

          let userId: string;

          if (existingUser.rows.length === 0) {
            // Create new user
            const newUser = await db.query(`
              INSERT INTO users (
                tenant_id, email, first_name, last_name, full_name,
                display_name, is_active, is_suspended, is_admin
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
              RETURNING id
            `, [
              tenantId,
              googleUser.primaryEmail.toLowerCase(),
              googleUser.name?.givenName || '',
              googleUser.name?.familyName || '',
              googleUser.name?.fullName || '',
              googleUser.name?.fullName || googleUser.primaryEmail.split('@')[0],
              !googleUser.suspended,
              googleUser.suspended || false,
              googleUser.isAdmin || false
            ]);

            userId = newUser.rows[0].id;
            usersCreated++;
            logger.info('Created new user', { userId, email: googleUser.primaryEmail });
          } else {
            // Update existing user
            userId = existingUser.rows[0].id;

            await db.query(`
              UPDATE users SET
                first_name = $3,
                last_name = $4,
                full_name = $5,
                display_name = $6,
                is_active = $7,
                is_suspended = $8,
                is_admin = $9,
                updated_at = NOW()
              WHERE id = $1 AND tenant_id = $2
            `, [
              userId,
              tenantId,
              googleUser.name?.givenName || '',
              googleUser.name?.familyName || '',
              googleUser.name?.fullName || '',
              googleUser.name?.fullName || googleUser.primaryEmail.split('@')[0],
              !googleUser.suspended,
              googleUser.suspended || false,
              googleUser.isAdmin || false
            ]);

            usersUpdated++;
            logger.info('Updated user', { userId, email: googleUser.primaryEmail });
          }

          // Update or create platform entry
          await db.query(`
            INSERT INTO user_platforms (
              user_id, platform, platform_user_id, platform_email,
              is_active, is_admin, is_suspended, platform_data, last_synced_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
            ON CONFLICT (user_id, platform)
            DO UPDATE SET
              platform_user_id = EXCLUDED.platform_user_id,
              platform_email = EXCLUDED.platform_email,
              is_active = EXCLUDED.is_active,
              is_admin = EXCLUDED.is_admin,
              is_suspended = EXCLUDED.is_suspended,
              platform_data = EXCLUDED.platform_data,
              last_synced_at = NOW(),
              updated_at = NOW()
          `, [
            userId,
            'google_workspace',
            googleUser.id,
            googleUser.primaryEmail,
            !googleUser.suspended,
            googleUser.isAdmin || false,
            googleUser.suspended || false,
            JSON.stringify({
              orgUnitPath: googleUser.orgUnitPath,
              isDelegatedAdmin: googleUser.isDelegatedAdmin,
              creationTime: googleUser.creationTime,
              lastLoginTime: googleUser.lastLoginTime
            })
          ]);
        }

        // Find and disable users that no longer exist in Google Workspace
        const allLocalUsers = await db.query(`
          SELECT u.id, u.email
          FROM users u
          JOIN user_platforms up ON u.id = up.user_id
          WHERE u.tenant_id = $1 AND up.platform = 'google_workspace' AND u.is_active = true
        `, [tenantId]);

        const googleEmails = new Set(googleUsers.map(u => u.primaryEmail.toLowerCase()));

        for (const localUser of allLocalUsers.rows) {
          if (!googleEmails.has(localUser.email)) {
            await db.query(
              'UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1',
              [localUser.id]
            );
            await db.query(
              'UPDATE user_platforms SET is_active = false, updated_at = NOW() WHERE user_id = $1 AND platform = $2',
              [localUser.id, 'google_workspace']
            );
            usersDisabled++;
            logger.info('Disabled user not found in Google Workspace', { email: localUser.email });
          }
        }

        // Commit transaction
        await db.query('COMMIT');

        // Update sync log
        await this.completeSyncLog(syncLogId, 'completed', {
          usersFound: googleUsers.length,
          usersCreated,
          usersUpdated,
          usersDisabled,
          duration: Date.now() - startTime
        });

        // Update module user count
        await this.updateModuleUserCount(tenantId, 'google_workspace');

        logger.info('Google Workspace user sync completed', {
          tenantId,
          usersCreated,
          usersUpdated,
          usersDisabled
        });

        return {
          success: true,
          usersCreated,
          usersUpdated,
          usersDisabled
        };

      } catch (error) {
        await db.query('ROLLBACK');
        throw error;
      }

    } catch (error: any) {
      logger.error('Google Workspace user sync failed', {
        tenantId,
        error: error.message
      });

      await this.completeSyncLog(syncLogId, 'failed', {
        error: error.message,
        duration: Date.now() - startTime
      });

      return {
        success: false,
        usersCreated: 0,
        usersUpdated: 0,
        usersDisabled: 0,
        error: error.message
      };
    }
  }

  /**
   * Get all users for a tenant with platform indicators
   */
  async getUnifiedUsers(tenantId: string, options?: {
    platform?: string;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<UnifiedUser[]> {
    try {
      let query = `
        SELECT
          u.*,
          COALESCE(
            json_agg(
              json_build_object(
                'platform', up.platform,
                'platformUserId', up.platform_user_id,
                'isActive', up.is_active,
                'isAdmin', up.is_admin,
                'isSuspended', up.is_suspended,
                'lastSynced', up.last_synced_at
              ) ORDER BY up.platform
            ) FILTER (WHERE up.id IS NOT NULL),
            '[]'::json
          ) as platforms
        FROM users u
        LEFT JOIN user_platforms up ON u.id = up.user_id
        WHERE u.tenant_id = $1
      `;

      const params: any[] = [tenantId];
      let paramIndex = 2;

      if (options?.platform) {
        query += ` AND EXISTS (
          SELECT 1 FROM user_platforms up2
          WHERE up2.user_id = u.id AND up2.platform = $${paramIndex}
        )`;
        params.push(options.platform);
        paramIndex++;
      }

      if (options?.isActive !== undefined) {
        query += ` AND u.is_active = $${paramIndex}`;
        params.push(options.isActive);
        paramIndex++;
      }

      query += ' GROUP BY u.id ORDER BY u.email';

      if (options?.limit) {
        query += ` LIMIT $${paramIndex}`;
        params.push(options.limit);
        paramIndex++;
      }

      if (options?.offset) {
        query += ` OFFSET $${paramIndex}`;
        params.push(options.offset);
      }

      const result = await db.query(query, params);

      return result.rows.map((row: any) => ({
        id: row.id,
        tenantId: row.tenant_id,
        email: row.email,
        firstName: row.first_name,
        lastName: row.last_name,
        fullName: row.full_name,
        displayName: row.display_name,
        avatarUrl: row.avatar_url,
        jobTitle: row.job_title,
        department: row.department,
        phone: row.phone,
        mobile: row.mobile,
        isActive: row.is_active,
        isSuspended: row.is_suspended,
        isAdmin: row.is_admin,
        platforms: row.platforms
      }));

    } catch (error: any) {
      logger.error('Failed to get unified users', { tenantId, error: error.message });
      throw error;
    }
  }

  /**
   * Create a sync log entry
   */
  private async createSyncLog(tenantId: string, platform: string, syncType: string): Promise<string> {
    const result = await db.query(`
      INSERT INTO user_sync_logs (tenant_id, platform, sync_type, status, started_at)
      VALUES ($1, $2, $3, 'started', NOW())
      RETURNING id
    `, [tenantId, platform, syncType]);

    return result.rows[0].id;
  }

  /**
   * Complete a sync log entry
   */
  private async completeSyncLog(logId: string, status: string, data: any) {
    await db.query(`
      UPDATE user_sync_logs SET
        status = $2,
        users_found = $3,
        users_created = $4,
        users_updated = $5,
        users_disabled = $6,
        error_message = $7,
        completed_at = NOW(),
        duration_ms = $8
      WHERE id = $1
    `, [
      logId,
      status,
      data.usersFound || 0,
      data.usersCreated || 0,
      data.usersUpdated || 0,
      data.usersDisabled || 0,
      data.error || null,
      data.duration || 0
    ]);
  }

  /**
   * Update user count in tenant_modules
   */
  private async updateModuleUserCount(tenantId: string, platform: string) {
    const result = await db.query(`
      SELECT COUNT(DISTINCT u.id) as count
      FROM users u
      JOIN user_platforms up ON u.id = up.user_id
      WHERE u.tenant_id = $1 AND up.platform = $2 AND u.is_active = true
    `, [tenantId, platform]);

    const userCount = result.rows[0].count;

    await db.query(`
      UPDATE tenant_modules
      SET user_count = $3, last_sync = NOW(), updated_at = NOW()
      WHERE tenant_id = $1 AND module_name = $2
    `, [tenantId, platform, userCount]);

    logger.info('Updated module user count', { tenantId, platform, userCount });
  }
}

export const userSyncService = new UserSyncService();