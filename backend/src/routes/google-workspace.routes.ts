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
 * @openapi
 * /api/v1/google-workspace/setup:
 *   post:
 *     summary: Setup Google Workspace integration
 *     description: |
 *       Upload service account credentials and configure Domain-Wide Delegation.
 *       Triggers initial sync after successful setup.
 *     tags: [Google Workspace]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [organizationId, domain, credentials]
 *             properties:
 *               organizationId:
 *                 type: string
 *                 format: uuid
 *               domain:
 *                 type: string
 *                 example: example.com
 *               adminEmail:
 *                 type: string
 *                 format: email
 *               credentials:
 *                 type: object
 *                 required: [client_email, private_key, client_id]
 *                 properties:
 *                   client_email:
 *                     type: string
 *                   private_key:
 *                     type: string
 *                   client_id:
 *                     type: string
 *     responses:
 *       200:
 *         description: Setup successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 delegationInfo:
 *                   type: object
 *                 syncTriggered:
 *                   type: boolean
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.post('/setup', [
  body('organizationId').notEmpty().withMessage('Organization ID is required'),
  body('domain').notEmpty().withMessage('Domain is required'),
  body('organizationName').optional().notEmpty().withMessage('Organization name required if provided'),
  body('adminEmail').optional().isEmail().withMessage('Valid admin email required if provided'),
  body('credentials').isObject().withMessage('Service account credentials are required'),
  body('credentials.client_email').isEmail().withMessage('Valid service account email is required'),
  body('credentials.private_key').notEmpty().withMessage('Private key is required'),
  body('credentials.client_id').notEmpty().withMessage('Client ID is required'),
], validateRequest, async (req: Request, res: Response) => {
  try {
    const { organizationId, domain, organizationName, adminEmail, credentials } = req.body;

    logger.info('Setting up Google Workspace DWD', { organizationId, domain });

    // Check if organization exists
    const orgResult = await db.query(
      'SELECT id FROM organizations WHERE id = $1',
      [organizationId]
    );

    if (orgResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Organization not found'
      });
    }

    const result = await googleWorkspaceService.storeServiceAccountCredentials(
      organizationId,
      domain,
      credentials,
      adminEmail
    );

    if (result.success) {
      // Trigger initial sync after successful setup (do not wait for it)
      logger.info('Triggering initial sync after Google Workspace setup', { organizationId, domain });
      syncScheduler.manualSync(organizationId).then((syncResult) => {
        if (syncResult.success) {
          logger.info('Initial Google Workspace sync completed', {
            organizationId,
            domain,
            userCount: syncResult.stats?.total_users || 0
          });
        } else {
          logger.warn('Initial Google Workspace sync failed', {
            organizationId,
            domain,
            error: syncResult.message
          });
        }
      }).catch((err) => {
        logger.error('Initial Google Workspace sync error', {
          organizationId,
          domain,
          error: err.message
        });
      });

      res.json({
        success: true,
        message: result.message,
        delegationInfo: googleWorkspaceService.getDomainWideDelegationInfo(),
        syncTriggered: true
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
 * @openapi
 * /api/v1/google-workspace/test-connection:
 *   post:
 *     summary: Test connection with stored credentials
 *     description: Test Domain-Wide Delegation connection using credentials stored in the database.
 *     tags: [Google Workspace]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [organizationId, domain]
 *             properties:
 *               organizationId:
 *                 type: string
 *                 format: uuid
 *               domain:
 *                 type: string
 *               adminEmail:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Connection test result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.post('/test-connection', [
  body('organizationId').notEmpty().withMessage('Organization ID is required'),
  body('domain').notEmpty().withMessage('Domain is required'),
  body('adminEmail').optional().isEmail().withMessage('Admin email must be valid if provided'),
], validateRequest, async (req: Request, res: Response) => {
  try {
    const { organizationId, domain } = req.body;
    let { adminEmail } = req.body;

    logger.info('Testing Google Workspace DWD connection', { organizationId, domain });

    // If adminEmail not provided, get it from the database
    if (!adminEmail) {
      const credResult = await db.query(
        'SELECT admin_email FROM gw_credentials WHERE organization_id = $1',
        [organizationId]
      );

      if (credResult.rows.length > 0) {
        adminEmail = credResult.rows[0].admin_email;
      }
    }

    const result = await googleWorkspaceService.testConnection(organizationId, domain, adminEmail);

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
 * POST /api/google-workspace/test-credentials
 * Test Domain-Wide Delegation connection with inline credentials (for wizard)
 */
router.post('/test-credentials', [
  body('serviceAccount').isObject().withMessage('Service account credentials are required'),
  body('serviceAccount.client_email').isEmail().withMessage('Valid service account email is required'),
  body('serviceAccount.private_key').notEmpty().withMessage('Private key is required'),
  body('domain').notEmpty().withMessage('Domain is required'),
  body('adminEmail').isEmail().withMessage('Valid admin email is required'),
], validateRequest, async (req: Request, res: Response) => {
  try {
    const { serviceAccount, domain, adminEmail } = req.body;

    logger.info('Testing Google Workspace DWD with inline credentials', { domain });

    const result = await googleWorkspaceService.testConnectionWithCredentials(
      serviceAccount,
      domain,
      adminEmail
    );

    res.json(result);
  } catch (error: any) {
    logger.error('Google Workspace credential test failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Internal server error during credential test'
    });
  }
});

/**
 * GET /api/google-workspace/users
 * Get Google Workspace users via Domain-Wide Delegation
 */
router.get('/users', async (req: Request, res: Response) => {
  try {
    const { organizationId, domain, adminEmail, maxResults } = req.query;

    if (!organizationId || !domain) {
      return res.status(400).json({
        success: false,
        error: 'organizationId and domain are required'
      });
    }

    logger.info('Fetching Google Workspace users via DWD', { organizationId, domain });

    const result = await googleWorkspaceService.getUsers(
      organizationId as string,
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
 * Trigger manual sync for an organization
 */
router.post('/sync-now', [
  body('organizationId').notEmpty().withMessage('Organization ID is required'),
], validateRequest, async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.body;

    logger.info('Manual sync triggered', { organizationId });

    const result = await syncScheduler.manualSync(organizationId);

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
 * GET /api/google-workspace/organization-stats/:organizationId
 * Get dashboard stats for an organization
 */
router.get('/organization-stats/:organizationId', async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.params;

    const stats = await syncScheduler.getOrganizationStats(organizationId);

    res.json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    logger.error('Failed to get organization stats', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get organization stats'
    });
  }
});

/**
 * GET /api/google-workspace/cached-users/:organizationId
 * Get cached Google Workspace users for an organization
 */
router.get('/cached-users/:organizationId', async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.params;

    const users = await syncScheduler.getCachedUsers(organizationId);

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
 * GET /api/google-workspace/org-units/:organizationId
 * Get organizational units from Google Workspace
 */
router.get('/org-units/:organizationId', async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.params;

    logger.info('Fetching Google Workspace organizational units', { organizationId });

    const result = await googleWorkspaceService.getOrgUnits(organizationId);

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
  body('organizationId').notEmpty().withMessage('Organization ID is required'),
], validateRequest, async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.body;

    logger.info('Syncing Google Workspace org units', { organizationId });

    const result = await googleWorkspaceService.syncOrgUnits(organizationId);

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
 * GET /api/google-workspace/module-status/:organizationId
 * Get Google Workspace module status for an organization
 */
router.get('/module-status/:organizationId', async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.params;

    // Try to get module status from organization_modules table
    const result = await db.query(`
      SELECT
        om.is_enabled,
        om.config,
        om.updated_at,
        om.last_sync_at,
        m.name as name,
        m.slug as slug
      FROM organization_modules om
      JOIN modules m ON m.id = om.module_id
      WHERE om.organization_id = $1 AND m.slug = 'google_workspace'
    `, [organizationId]);

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
    const config = module.config || {};

    // Get actual user count from gw_synced_users
    const userCountResult = await db.query(
      'SELECT COUNT(*) as count FROM gw_synced_users WHERE organization_id = $1',
      [organizationId]
    );
    const userCount = parseInt(userCountResult.rows[0]?.count || '0');

    // Get Google Workspace credentials to show configuration details
    const credentialsResult = await db.query(
      'SELECT service_account_key, admin_email FROM gw_credentials WHERE organization_id = $1',
      [organizationId]
    );

    let configurationDetails = config;
    if (credentialsResult.rows.length > 0) {
      try {
        const serviceAccount = JSON.parse(credentialsResult.rows[0].service_account_key);
        configurationDetails = {
          ...config,
          projectId: serviceAccount.project_id,
          clientEmail: serviceAccount.client_email,
          adminEmail: credentialsResult.rows[0].admin_email
        };
      } catch (error) {
        // If parsing fails, just use existing config
        configurationDetails = config;
      }
    }

    res.json({
      success: true,
      data: {
        isEnabled: module.is_enabled,
        userCount: userCount,
        lastSync: module.last_sync_at || null,
        configuration: configurationDetails,
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

/**
 * GET /api/google-workspace/groups/:organizationId
 * Get Google Workspace groups
 */
router.get('/groups/:organizationId', async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.params;

    logger.info('Fetching Google Workspace groups', { organizationId });

    const result = await googleWorkspaceService.getGroups(organizationId);

    res.json(result);
  } catch (error: any) {
    logger.error('Failed to fetch groups', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch groups'
    });
  }
});

/**
 * POST /api/google-workspace/sync-groups
 * Sync groups from Google Workspace to database
 */
router.post('/sync-groups', [
  body('organizationId').notEmpty().withMessage('Organization ID is required'),
], validateRequest, async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.body;

    logger.info('Syncing Google Workspace groups', { organizationId });

    const result = await googleWorkspaceService.syncGroups(organizationId);

    res.json(result);
  } catch (error: any) {
    logger.error('Groups sync failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to sync groups'
    });
  }
});

/**
 * GET /api/google-workspace/groups/:groupId/members
 * Get members of a specific group
 */
router.get('/groups/:groupId/members', async (req: Request, res: Response) => {
  try {
    const { groupId } = req.params;
    const { organizationId } = req.query;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: 'organizationId is required'
      });
    }

    logger.info('Fetching group members', { groupId, organizationId });

    const result = await googleWorkspaceService.getGroupMembers(
      organizationId as string,
      groupId
    );

    res.json(result);
  } catch (error: any) {
    logger.error('Failed to fetch group members', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch group members'
    });
  }
});

/**
 * POST /api/google-workspace/groups/:groupId/members
 * Add a member to a group
 */
router.post('/groups/:groupId/members', [
  body('organizationId').notEmpty().withMessage('Organization ID is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('role').optional().isIn(['MEMBER', 'MANAGER', 'OWNER']).withMessage('Invalid role')
], validateRequest, async (req: Request, res: Response) => {
  try {
    const { groupId } = req.params;
    const { organizationId, email, role } = req.body;

    logger.info('Adding member to group', { groupId, email, role });

    const result = await googleWorkspaceService.addGroupMember(
      organizationId,
      groupId,
      email,
      role || 'MEMBER'
    );

    res.json(result);
  } catch (error: any) {
    logger.error('Failed to add group member', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to add member to group'
    });
  }
});

/**
 * DELETE /api/google-workspace/groups/:groupId/members/:memberEmail
 * Remove a member from a group
 */
router.delete('/groups/:groupId/members/:memberEmail', async (req: Request, res: Response) => {
  try {
    const { groupId, memberEmail } = req.params;
    const { organizationId } = req.query;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: 'organizationId is required'
      });
    }

    logger.info('Removing member from group', { groupId, memberEmail });

    const result = await googleWorkspaceService.removeGroupMember(
      organizationId as string,
      groupId,
      memberEmail
    );

    res.json(result);
  } catch (error: any) {
    logger.error('Failed to remove group member', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to remove member from group'
    });
  }
});

/**
 * POST /api/google-workspace/groups
 * Create a new group
 */
router.post('/groups', [
  body('organizationId').notEmpty().withMessage('Organization ID is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('name').notEmpty().withMessage('Group name is required'),
  body('description').optional().isString()
], validateRequest, async (req: Request, res: Response) => {
  try {
    const { organizationId, email, name, description } = req.body;

    logger.info('Creating new group', { email, name });

    const result = await googleWorkspaceService.createGroup(
      organizationId,
      email,
      name,
      description || ''
    );

    res.json(result);
  } catch (error: any) {
    logger.error('Failed to create group', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to create group'
    });
  }
});

/**
 * PATCH /api/google-workspace/groups/:groupId
 * Update group settings
 */
router.patch('/groups/:groupId', [
  body('organizationId').notEmpty().withMessage('Organization ID is required'),
  body('name').optional().isString(),
  body('description').optional().isString()
], validateRequest, async (req: Request, res: Response) => {
  try {
    const { groupId } = req.params;
    const { organizationId, name, description } = req.body;

    logger.info('Updating group', { groupId, name, description });

    const result = await googleWorkspaceService.updateGroup(
      organizationId,
      groupId,
      { name, description }
    );

    res.json(result);
  } catch (error: any) {
    logger.error('Failed to update group', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to update group'
    });
  }
});

/**
 * POST /api/google-workspace/disable/:organizationId
 * Disable Google Workspace module for an organization
 */
router.post('/disable/:organizationId', async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.params;

    logger.info('Disabling Google Workspace module', { organizationId });

    // Get Google Workspace module ID
    const moduleResult = await db.query(
      `SELECT id FROM modules WHERE slug = 'google_workspace' LIMIT 1`
    );

    if (moduleResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Google Workspace module not found'
      });
    }

    const moduleId = moduleResult.rows[0].id;

    // Disable the module for this organization
    await db.query(`
      UPDATE organization_modules
      SET is_enabled = false,
          updated_at = NOW()
      WHERE organization_id = $1 AND module_id = $2
    `, [organizationId, moduleId]);

    logger.info('Google Workspace module disabled', { organizationId });

    res.json({
      success: true,
      message: 'Google Workspace module has been disabled'
    });
  } catch (error: any) {
    logger.error('Failed to disable Google Workspace module', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to disable Google Workspace module'
    });
  }
});

export default router;