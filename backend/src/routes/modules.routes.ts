import { Router, Request, Response } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth';
import { db } from '../database/connection';
import { googleWorkspaceService } from '../services/google-workspace.service';
import { googleWorkspaceSyncService } from '../services/google-workspace-sync.service';
import { logger } from '../utils/logger';
import crypto from 'crypto';

const router = Router();

// Encryption key for service account credentials
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const IV_LENGTH = 16;

// Encrypt sensitive data
function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(
    'aes-256-cbc',
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    iv
  );
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

// Decrypt sensitive data
function decrypt(text: string): string {
  const textParts = text.split(':');
  const iv = Buffer.from(textParts.shift()!, 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    iv
  );
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

/**
 * GET /api/modules
 * Get all available modules and their status
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;

    // Get all modules
    const modulesResult = await db.query(`
      SELECT
        m.id,
        m.name,
        m.slug,
        m.description,
        m.icon,
        m.version,
        m.is_available,
        om.is_enabled,
        om.is_configured,
        om.last_sync_at,
        om.sync_status,
        om.sync_error
      FROM modules m
      LEFT JOIN organization_modules om
        ON m.id = om.module_id
        AND om.organization_id = $1
      WHERE m.is_available = true
      ORDER BY m.name
    `, [organizationId]);

    // Get stats for enabled modules
    const modules = await Promise.all(modulesResult.rows.map(async (module: any) => {
      const stats: any = {};

      if (module.is_enabled && module.is_configured && module.slug === 'google_workspace') {
        // Get Google Workspace stats
        const userCountResult = await db.query(
          'SELECT COUNT(*) as count FROM gw_synced_users WHERE organization_id = $1',
          [organizationId]
        );
        const groupCountResult = await db.query(
          'SELECT COUNT(*) as count FROM gw_groups WHERE organization_id = $1',
          [organizationId]
        );

        stats.users = parseInt(userCountResult.rows[0].count);
        stats.groups = parseInt(groupCountResult.rows[0].count);
      }

      return {
        id: module.id,
        name: module.name,
        slug: module.slug,
        description: module.description,
        icon: module.icon,
        version: module.version,
        isEnabled: module.is_enabled || false,
        isConfigured: module.is_configured || false,
        lastSync: module.last_sync_at,
        syncStatus: module.sync_status,
        syncError: module.sync_error,
        stats
      };
    }));

    res.json({
      success: true,
      data: modules
    });
  } catch (error: any) {
    logger.error('Failed to get modules', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve modules'
    });
  }
});

/**
 * POST /api/modules/:moduleSlug/enable
 * Enable a module for the organization
 */
router.post('/:moduleSlug/enable', requirePermission('admin'), async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    const { moduleSlug } = req.params;

    // Get module ID
    const moduleResult = await db.query(
      'SELECT id FROM modules WHERE slug = $1 AND is_available = true',
      [moduleSlug]
    );

    if (moduleResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Module not found'
      });
    }

    const moduleId = moduleResult.rows[0].id;

    // Enable module
    await db.query(`
      INSERT INTO organization_modules (organization_id, module_id, is_enabled, is_configured, created_at, updated_at)
      VALUES ($1, $2, true, false, NOW(), NOW())
      ON CONFLICT (organization_id, module_id)
      DO UPDATE SET is_enabled = true, updated_at = NOW()
    `, [organizationId, moduleId]);

    res.json({
      success: true,
      message: 'Module enabled successfully'
    });
  } catch (error: any) {
    logger.error('Failed to enable module', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to enable module'
    });
  }
});

/**
 * POST /api/modules/:moduleSlug/disable
 * Disable a module for the organization
 */
router.post('/:moduleSlug/disable', requirePermission('admin'), async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    const { moduleSlug } = req.params;

    // Get module ID
    const moduleResult = await db.query(
      'SELECT id FROM modules WHERE slug = $1',
      [moduleSlug]
    );

    if (moduleResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Module not found'
      });
    }

    const moduleId = moduleResult.rows[0].id;

    // Disable module
    await db.query(`
      UPDATE organization_modules
      SET is_enabled = false, updated_at = NOW()
      WHERE organization_id = $1 AND module_id = $2
    `, [organizationId, moduleId]);

    res.json({
      success: true,
      message: 'Module disabled successfully'
    });
  } catch (error: any) {
    logger.error('Failed to disable module', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to disable module'
    });
  }
});

/**
 * POST /api/modules/google-workspace/test
 * Test Google Workspace connection with domain-wide delegation
 */
router.post('/google-workspace/test', requirePermission('admin'), async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    const { serviceAccount, adminEmail, domain } = req.body;

    if (!serviceAccount || !adminEmail || !domain) {
      return res.status(400).json({
        success: false,
        error: 'Service account, admin email, and domain are required'
      });
    }

    // Validate service account structure
    const requiredFields = [
      'type', 'project_id', 'private_key_id', 'private_key',
      'client_email', 'client_id', 'auth_uri', 'token_uri'
    ];

    const missingFields = requiredFields.filter(field => !serviceAccount[field]);
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Invalid service account. Missing fields: ${missingFields.join(', ')}`
      });
    }

    // Test the connection
    const testResult = await googleWorkspaceService.testConnectionWithDelegation(
      serviceAccount,
      adminEmail,
      domain
    );

    if (testResult.success) {
      res.json({
        success: true,
        message: 'Connection successful',
        details: testResult.details
      });
    } else {
      res.status(400).json({
        success: false,
        error: testResult.error || 'Connection test failed'
      });
    }
  } catch (error: any) {
    logger.error('Failed to test Google Workspace connection', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to test connection'
    });
  }
});

/**
 * POST /api/modules/google-workspace/configure
 * Configure Google Workspace with domain-wide delegation
 */
router.post('/google-workspace/configure', requirePermission('admin'), async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    const { serviceAccount, adminEmail, domain } = req.body;

    if (!serviceAccount || !adminEmail || !domain) {
      return res.status(400).json({
        success: false,
        error: 'Service account, admin email, and domain are required'
      });
    }

    // Encrypt the service account key
    const encryptedKey = encrypt(JSON.stringify(serviceAccount));

    // Store credentials
    await db.query(`
      INSERT INTO gw_credentials (
        organization_id,
        service_account_key,
        admin_email,
        domain,
        scopes,
        is_valid,
        last_validated_at,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW(), NOW())
      ON CONFLICT (organization_id)
      DO UPDATE SET
        service_account_key = $2,
        admin_email = $3,
        domain = $4,
        scopes = $5,
        is_valid = true,
        last_validated_at = NOW(),
        updated_at = NOW()
    `, [
      organizationId,
      encryptedKey,
      adminEmail,
      domain,
      [
        'https://www.googleapis.com/auth/admin.directory.user',
        'https://www.googleapis.com/auth/admin.directory.group',
        'https://www.googleapis.com/auth/admin.directory.orgunit',
        'https://www.googleapis.com/auth/admin.directory.domain',
        'https://www.googleapis.com/auth/admin.reports.audit.readonly'
      ]
    ]);

    // Mark module as configured
    const moduleResult = await db.query(
      'SELECT id FROM modules WHERE slug = $1',
      ['google_workspace']
    );

    if (moduleResult.rows.length > 0) {
      await db.query(`
        UPDATE organization_modules
        SET is_configured = true,
            config = $3,
            updated_at = NOW()
        WHERE organization_id = $1 AND module_id = $2
      `, [
        organizationId,
        moduleResult.rows[0].id,
        JSON.stringify({
          domain,
          adminEmail,
          projectId: serviceAccount.project_id,
          clientEmail: serviceAccount.client_email
        })
      ]);
    }

    res.json({
      success: true,
      message: 'Google Workspace configured successfully'
    });
  } catch (error: any) {
    logger.error('Failed to configure Google Workspace', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to save configuration'
    });
  }
});

/**
 * POST /api/modules/google-workspace/sync
 * Trigger Google Workspace sync
 */
router.post('/google-workspace/sync', requirePermission('admin'), async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;

    // Get credentials
    const credResult = await db.query(
      'SELECT * FROM gw_credentials WHERE organization_id = $1',
      [organizationId]
    );

    if (credResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Google Workspace not configured'
      });
    }

    const credentials = credResult.rows[0];

    // Decrypt service account key
    const serviceAccount = JSON.parse(decrypt(credentials.service_account_key));

    // Update sync status
    await db.query(`
      UPDATE organization_modules om
      SET sync_status = 'syncing', sync_error = NULL, updated_at = NOW()
      FROM modules m
      WHERE om.module_id = m.id
        AND om.organization_id = $1
        AND m.slug = 'google_workspace'
    `, [organizationId]);

    // Perform sync
    const syncResult = await googleWorkspaceSyncService.performFullSync(
      organizationId,
      credentials.domain,
      credentials.admin_email,
      serviceAccount
    );

    // Update sync status with results
    const status = syncResult.success ? 'success' : 'error';
    const error = syncResult.error || null;

    await db.query(`
      UPDATE organization_modules om
      SET sync_status = $2,
          sync_error = $3,
          last_sync_at = NOW(),
          updated_at = NOW()
      FROM modules m
      WHERE om.module_id = m.id
        AND om.organization_id = $1
        AND m.slug = 'google_workspace'
    `, [organizationId, status, error]);

    res.json(syncResult);
  } catch (error: any) {
    logger.error('Failed to sync Google Workspace', { error: error.message });

    // Update sync status to error
    await db.query(`
      UPDATE organization_modules om
      SET sync_status = 'error',
          sync_error = $2,
          updated_at = NOW()
      FROM modules m
      WHERE om.module_id = m.id
        AND om.organization_id = $1
        AND m.slug = 'google_workspace'
    `, [req.user?.organizationId, error.message]);

    res.status(500).json({
      success: false,
      error: 'Sync failed',
      details: error.message
    });
  }
});

/**
 * GET /api/modules/google-workspace/users
 * Get synced Google Workspace users
 */
router.get('/google-workspace/users', requireAuth, async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    const { limit = 100, offset = 0, search } = req.query;

    let query = `
      SELECT
        id,
        google_id,
        email,
        given_name,
        family_name,
        full_name,
        is_admin,
        is_suspended,
        org_unit_path,
        department,
        job_title,
        last_login_time,
        creation_time,
        last_sync_at
      FROM gw_synced_users
      WHERE organization_id = $1
    `;
    const params: any[] = [organizationId];

    if (search) {
      query += ` AND (email ILIKE $${params.length + 1} OR full_name ILIKE $${params.length + 1})`;
      params.push(`%${search}%`);
    }

    query += ` ORDER BY full_name ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    res.json({
      success: true,
      data: result.rows,
      total: result.rowCount
    });
  } catch (error: any) {
    logger.error('Failed to get Google Workspace users', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve users'
    });
  }
});

export default router;