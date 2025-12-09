/**
 * Signature Permissions Routes
 *
 * API endpoints for managing signature permission levels.
 */

import { Router, Request, Response } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { requireSignatureAdmin } from '../middleware/signature-auth';
import { signaturePermissionsService } from '../services/signature-permissions.service';
import { PermissionLevel, PERMISSION_CAPABILITIES } from '../types/signatures';
import { logger } from '../utils/logger';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// =====================================================
// PERMISSION INFO (Public to authenticated users)
// =====================================================

/**
 * GET /api/signatures/permissions/me
 * Get current user's signature permission level
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    const permission = await signaturePermissionsService.getUserPermission(
      req.user!.userId,
      req.user!.organizationId
    );

    if (!permission) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    return res.json({
      success: true,
      data: {
        effectivePermission: permission.effectivePermission,
        explicitPermission: permission.explicitPermission,
        isOrgAdmin: permission.isOrgAdmin,
        capabilities: PERMISSION_CAPABILITIES[permission.effectivePermission],
      },
    });
  } catch (error: any) {
    logger.error('Error getting user permission', {
      userId: req.user?.userId,
      error: error.message,
    });
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get permission',
    });
  }
});

/**
 * GET /api/signatures/permissions/levels
 * Get available permission levels and their capabilities
 */
router.get('/levels', async (req: Request, res: Response) => {
  try {
    const levels = [
      {
        level: 'admin',
        displayName: 'Administrator',
        description: 'Full control over all signature features',
        capabilities: PERMISSION_CAPABILITIES.admin,
      },
      {
        level: 'designer',
        displayName: 'Designer',
        description: 'Create and edit templates, preview signatures',
        capabilities: PERMISSION_CAPABILITIES.designer,
      },
      {
        level: 'campaign_manager',
        displayName: 'Campaign Manager',
        description: 'Manage campaigns, assignments, and view analytics',
        capabilities: PERMISSION_CAPABILITIES.campaign_manager,
      },
      {
        level: 'helpdesk',
        displayName: 'Helpdesk',
        description: 'View status and re-sync individual users',
        capabilities: PERMISSION_CAPABILITIES.helpdesk,
      },
      {
        level: 'viewer',
        displayName: 'Viewer',
        description: 'View-only access to templates and campaigns',
        capabilities: PERMISSION_CAPABILITIES.viewer,
      },
    ];

    return res.json({
      success: true,
      data: levels,
    });
  } catch (error: any) {
    logger.error('Error getting permission levels', { error: error.message });
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get permission levels',
    });
  }
});

// =====================================================
// PERMISSION MANAGEMENT (Admin only)
// =====================================================

/**
 * GET /api/signatures/permissions
 * Get all users with their signature permissions
 */
router.get('/', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { includeInactive, permissionLevel } = req.query;

    const permissions = await signaturePermissionsService.getOrganizationPermissions(
      req.user!.organizationId,
      {
        includeInactive: includeInactive === 'true',
        permissionLevel: permissionLevel as PermissionLevel | undefined,
      }
    );

    return res.json({
      success: true,
      data: permissions,
    });
  } catch (error: any) {
    logger.error('Error getting organization permissions', {
      organizationId: req.user?.organizationId,
      error: error.message,
    });
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get permissions',
    });
  }
});

/**
 * GET /api/signatures/permissions/stats
 * Get permission statistics
 */
router.get('/stats', requireAdmin, async (req: Request, res: Response) => {
  try {
    const stats = await signaturePermissionsService.getPermissionStats(
      req.user!.organizationId
    );

    return res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    logger.error('Error getting permission stats', {
      organizationId: req.user?.organizationId,
      error: error.message,
    });
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get permission stats',
    });
  }
});

/**
 * GET /api/signatures/permissions/users/:userId
 * Get a specific user's permission
 */
router.get('/users/:userId', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const permission = await signaturePermissionsService.getUserPermission(
      userId,
      req.user!.organizationId
    );

    if (!permission) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    return res.json({
      success: true,
      data: permission,
    });
  } catch (error: any) {
    logger.error('Error getting user permission', {
      userId: req.params.userId,
      error: error.message,
    });
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get user permission',
    });
  }
});

/**
 * POST /api/signatures/permissions
 * Grant or update permission for a user
 */
router.post('/', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { userId, permissionLevel, expiresAt, notes } = req.body;

    if (!userId || !permissionLevel) {
      return res.status(400).json({
        success: false,
        error: 'userId and permissionLevel are required',
      });
    }

    const validLevels: PermissionLevel[] = [
      'admin', 'designer', 'campaign_manager', 'helpdesk', 'viewer'
    ];
    if (!validLevels.includes(permissionLevel)) {
      return res.status(400).json({
        success: false,
        error: `Invalid permission level. Valid levels: ${validLevels.join(', ')}`,
      });
    }

    const permission = await signaturePermissionsService.grantPermission(
      req.user!.organizationId,
      {
        userId,
        permissionLevel,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        notes,
      },
      req.user!.userId
    );

    return res.json({
      success: true,
      data: permission,
      message: `Permission granted: ${permissionLevel}`,
    });
  } catch (error: any) {
    logger.error('Error granting permission', {
      userId: req.body.userId,
      error: error.message,
    });

    if (error.message === 'User not found in organization') {
      return res.status(404).json({
        success: false,
        error: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to grant permission',
    });
  }
});

/**
 * PUT /api/signatures/permissions/users/:userId
 * Update a user's permission
 */
router.put('/users/:userId', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { permissionLevel, expiresAt, notes } = req.body;

    if (!permissionLevel) {
      return res.status(400).json({
        success: false,
        error: 'permissionLevel is required',
      });
    }

    const validLevels: PermissionLevel[] = [
      'admin', 'designer', 'campaign_manager', 'helpdesk', 'viewer'
    ];
    if (!validLevels.includes(permissionLevel)) {
      return res.status(400).json({
        success: false,
        error: `Invalid permission level. Valid levels: ${validLevels.join(', ')}`,
      });
    }

    const permission = await signaturePermissionsService.grantPermission(
      req.user!.organizationId,
      {
        userId,
        permissionLevel,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        notes,
      },
      req.user!.userId
    );

    return res.json({
      success: true,
      data: permission,
      message: `Permission updated: ${permissionLevel}`,
    });
  } catch (error: any) {
    logger.error('Error updating permission', {
      userId: req.params.userId,
      error: error.message,
    });

    if (error.message === 'User not found in organization') {
      return res.status(404).json({
        success: false,
        error: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to update permission',
    });
  }
});

/**
 * DELETE /api/signatures/permissions/users/:userId
 * Revoke a user's explicit permission (falls back to 'viewer')
 */
router.delete('/users/:userId', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const revoked = await signaturePermissionsService.revokePermission(
      req.user!.organizationId,
      userId
    );

    if (!revoked) {
      return res.status(404).json({
        success: false,
        error: 'No permission found to revoke',
      });
    }

    return res.json({
      success: true,
      message: 'Permission revoked. User now has viewer access.',
    });
  } catch (error: any) {
    logger.error('Error revoking permission', {
      userId: req.params.userId,
      error: error.message,
    });
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to revoke permission',
    });
  }
});

/**
 * POST /api/signatures/permissions/bulk
 * Bulk grant permissions
 */
router.post('/bulk', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { permissions } = req.body;

    if (!Array.isArray(permissions) || permissions.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'permissions array is required',
      });
    }

    const result = await signaturePermissionsService.bulkGrantPermissions(
      req.user!.organizationId,
      permissions,
      req.user!.userId
    );

    return res.json({
      success: true,
      data: result,
      message: `Granted ${result.granted} permissions, ${result.failed.length} failed`,
    });
  } catch (error: any) {
    logger.error('Error bulk granting permissions', { error: error.message });
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to bulk grant permissions',
    });
  }
});

// =====================================================
// AUDIT LOG
// =====================================================

/**
 * GET /api/signatures/permissions/audit
 * Get permission audit log
 */
router.get('/audit', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { userId, limit, offset } = req.query;

    const result = await signaturePermissionsService.getAuditLog(
      req.user!.organizationId,
      {
        userId: userId as string | undefined,
        limit: limit ? parseInt(limit as string, 10) : 50,
        offset: offset ? parseInt(offset as string, 10) : 0,
      }
    );

    return res.json({
      success: true,
      data: result.entries,
      total: result.total,
    });
  } catch (error: any) {
    logger.error('Error getting audit log', {
      organizationId: req.user?.organizationId,
      error: error.message,
    });
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get audit log',
    });
  }
});

export default router;
