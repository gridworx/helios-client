import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { googleWorkspaceService } from '../services/google-workspace.service';
import { logger } from '../utils/logger';
import { db } from '../database/connection';
import { syncScheduler } from '../services/sync-scheduler.service';

const router = Router();

/**
 * Validation middleware
 */
const validateRequest = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  return next();
};

/**
 * POST /api/plugins/google-workspace/setup
 * Upload service account credentials and setup Domain-Wide Delegation
 */
router.post('/setup', [
  body('tenantId').notEmpty().withMessage('Tenant ID is required'),
  body('domain').notEmpty().withMessage('Domain is required'),
  body('organizationName').optional().notEmpty().withMessage('Organization name required if provided'),
  body('adminEmail').optional().isEmail().withMessage('Valid admin email required if provided'),
  body('credentials').isObject().withMessage('Service account credentials are required'),
  body('credentials.client_email').isEmail().withMessage('Valid service account email is required'),
  body('credentials.private_key').notEmpty().withMessage('Private key is required'),
  body('credentials.client_id').notEmpty().withMessage('Client ID is required'),
], validateRequest, async (req: Request, res: Response) => {
  try {
    const { tenantId, domain, organizationName, adminEmail, credentials } = req.body;

    logger.info('Setting up Google Workspace DWD', { tenantId, domain });

    // First, create or update tenant record (using correct column names)
    await db.query(`
      INSERT INTO tenants (id, domain, name, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, true, NOW(), NOW())
      ON CONFLICT (domain) DO UPDATE SET
        name = EXCLUDED.name,
        updated_at = NOW()
      RETURNING id
    `, [tenantId, domain, organizationName || domain]);

    const result = await googleWorkspaceService.storeServiceAccountCredentials(
      tenantId,
      domain,
      credentials
    );

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        delegationInfo: googleWorkspaceService.getDomainWideDelegationInfo()
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.message
      });
    }
  } catch (error: any) {
    logger.error('Google Workspace setup failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Internal server error during setup'
    });
  }
});

/**
 * POST /api/plugins/google-workspace/test-connection
 * Test Domain-Wide Delegation connection
 */
router.post('/test-connection', [
  body('tenantId').notEmpty().withMessage('Tenant ID is required'),
  body('domain').notEmpty().withMessage('Domain is required'),
  body('adminEmail').optional().isEmail().withMessage('Admin email must be valid if provided'),
], validateRequest, async (req: Request, res: Response) => {
  try {
    const { tenantId, domain, adminEmail } = req.body;

    logger.info('Testing Google Workspace DWD connection', { tenantId, domain });

    const result = await googleWorkspaceService.testConnection(tenantId, domain, adminEmail);

    res.json(result);
  } catch (error: any) {
    logger.error('Google Workspace connection test failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Internal server error during connection test'
    });
  }
});

/**
 * GET /api/plugins/google-workspace/users
 * Get Google Workspace users via Domain-Wide Delegation
 */
router.get('/users', async (req: Request, res: Response) => {
  try {
    const { tenantId, domain, adminEmail, maxResults } = req.query;

    if (!tenantId || !domain) {
      return res.status(400).json({
        success: false,
        error: 'tenantId and domain are required'
      });
    }

    logger.info('Fetching Google Workspace users via DWD', { tenantId, domain });

    const result = await googleWorkspaceService.getUsers(
      tenantId as string,
      domain as string,
      adminEmail as string,
      maxResults ? parseInt(maxResults as string) : 100
    );

    res.json(result);
  } catch (error: any) {
    logger.error('Failed to fetch Google Workspace users', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Internal server error while fetching users'
    });
  }
});

/**
 * GET /api/google-workspace/delegation-info
 * Get Domain-Wide Delegation setup information
 */
router.get('/delegation-info', async (req: Request, res: Response) => {
  try {
    const info = googleWorkspaceService.getDomainWideDelegationInfo();

    res.json({
      success: true,
      ...info
    });
  } catch (error: any) {
    logger.error('Failed to get delegation info', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/google-workspace/sync-now
 * Trigger manual sync for a tenant
 */
router.post('/sync-now', [
  body('tenantId').notEmpty().withMessage('Tenant ID is required'),
], validateRequest, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.body;

    logger.info('Manual sync triggered', { tenantId });

    const result = await syncScheduler.manualSync(tenantId);

    res.json(result);
  } catch (error: any) {
    logger.error('Manual sync failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Manual sync failed'
    });
  }
});

/**
 * GET /api/google-workspace/tenant-stats/:tenantId
 * Get dashboard stats for a tenant
 */
router.get('/tenant-stats/:tenantId', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;

    const stats = await syncScheduler.getTenantStats(tenantId);

    res.json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    logger.error('Failed to get tenant stats', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get tenant stats'
    });
  }
});

/**
 * GET /api/google-workspace/cached-users/:tenantId
 * Get cached Google Workspace users for a tenant
 */
router.get('/cached-users/:tenantId', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;

    const users = await syncScheduler.getCachedUsers(tenantId);

    res.json({
      success: true,
      data: {
        users,
        count: users.length
      }
    });
  } catch (error: any) {
    logger.error('Failed to get cached users', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get cached users'
    });
  }
});

/**
 * GET /api/google-workspace/org-units/:tenantId
 * Get organizational units from Google Workspace
 */
router.get('/org-units/:tenantId', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;

    logger.info('Fetching Google Workspace organizational units', { tenantId });

    const result = await googleWorkspaceService.getOrgUnits(tenantId);

    res.json(result);
  } catch (error: any) {
    logger.error('Failed to fetch org units', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch organizational units'
    });
  }
});

/**
 * POST /api/google-workspace/sync-org-units
 * Sync organizational units from Google Workspace to database
 */
router.post('/sync-org-units', [
  body('tenantId').notEmpty().withMessage('Tenant ID is required'),
], validateRequest, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.body;

    logger.info('Syncing Google Workspace org units', { tenantId });

    const result = await googleWorkspaceService.syncOrgUnits(tenantId);

    res.json(result);
  } catch (error: any) {
    logger.error('Org units sync failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to sync organizational units'
    });
  }
});

/**
 * GET /api/google-workspace/module-status/:tenantId
 * Get Google Workspace module status for a tenant
 */
router.get('/module-status/:tenantId', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;

    // Query tenant_modules table for status
    const result = await db.query(`
      SELECT
        module_name,
        is_enabled,
        user_count,
        configuration,
        last_sync,
        updated_at
      FROM tenant_modules
      WHERE tenant_id = $1 AND module_name = 'google_workspace'
    `, [tenantId]);

    if (result.rows.length === 0) {
      // Module not configured yet
      return res.json({
        success: true,
        data: {
          isEnabled: false,
          userCount: 0,
          lastSync: null,
          configuration: null
        }
      });
    }

    const module = result.rows[0];

    res.json({
      success: true,
      data: {
        isEnabled: module.is_enabled,
        userCount: module.user_count || 0,
        lastSync: module.last_sync,
        configuration: module.configuration,
        updatedAt: module.updated_at
      }
    });
  } catch (error: any) {
    logger.error('Failed to get module status', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get module status'
    });
  }
});

export default router;