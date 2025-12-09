/**
 * Signature Sync Routes
 *
 * Routes for deploying and syncing signatures to Google Workspace Gmail.
 */

import { Router, Request, Response } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth';
import { signatureSyncService } from '../services/signature-sync.service';

const router = Router();

/**
 * GET /api/signatures/sync/status
 * Get sync status summary for the organization
 */
router.get('/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const summary = await signatureSyncService.getOrganizationSyncSummary(organizationId);

    return res.json({
      success: true,
      data: summary,
    });
  } catch (error: any) {
    console.error('Error getting sync status:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get sync status',
    });
  }
});

/**
 * GET /api/signatures/sync/users
 * Get detailed sync status for all users
 */
router.get('/users', requireAuth, async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { status, search, page, limit } = req.query;

    const result = await signatureSyncService.getUserSyncStatuses(organizationId, {
      status: status as any,
      search: search as string,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    return res.json({
      success: true,
      data: result.users,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      },
    });
  } catch (error: any) {
    console.error('Error getting user sync statuses:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get user sync statuses',
    });
  }
});

/**
 * GET /api/signatures/sync/users/:userId
 * Get sync status for a specific user
 */
router.get('/users/:userId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const status = await signatureSyncService.getUserSyncStatus(userId);

    if (!status) {
      return res.json({
        success: true,
        data: null,
        message: 'No sync status found for this user',
      });
    }

    // Verify organization ownership
    if (status.organizationId !== req.user?.organizationId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    return res.json({
      success: true,
      data: status,
    });
  } catch (error: any) {
    console.error('Error getting user sync status:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get user sync status',
    });
  }
});

/**
 * POST /api/signatures/sync/deploy
 * Deploy signatures to all pending users
 */
router.post('/deploy', requireAuth, requirePermission('admin'), async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const result = await signatureSyncService.syncOrganizationSignatures(organizationId);

    return res.json({
      success: true,
      message: `Deployed signatures to ${result.successCount} users`,
      data: {
        totalUsers: result.totalUsers,
        successCount: result.successCount,
        failureCount: result.failureCount,
        skippedCount: result.skippedCount,
      },
    });
  } catch (error: any) {
    console.error('Error deploying signatures:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to deploy signatures',
    });
  }
});

/**
 * POST /api/signatures/sync/deploy/all
 * Force deploy signatures to ALL users (regardless of current status)
 */
router.post('/deploy/all', requireAuth, requirePermission('admin'), async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const result = await signatureSyncService.forceSyncAllUsers(organizationId);

    return res.json({
      success: true,
      message: `Force deployed signatures to ${result.successCount} users`,
      data: {
        totalUsers: result.totalUsers,
        successCount: result.successCount,
        failureCount: result.failureCount,
        skippedCount: result.skippedCount,
      },
    });
  } catch (error: any) {
    console.error('Error force deploying signatures:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to force deploy signatures',
    });
  }
});

/**
 * POST /api/signatures/sync/users/:userId
 * Sync signature for a specific user
 */
router.post('/users/:userId', requireAuth, requirePermission('admin'), async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const result = await signatureSyncService.syncUserSignature(userId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error || 'Sync failed',
        data: result,
      });
    }

    return res.json({
      success: true,
      message: `Signature synced for ${result.userEmail}`,
      data: result,
    });
  } catch (error: any) {
    console.error('Error syncing user signature:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to sync signature',
    });
  }
});

/**
 * POST /api/signatures/sync/retry
 * Retry failed syncs
 */
router.post('/retry', requireAuth, requirePermission('admin'), async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Get failed users and reset them to pending
    const failedResult = await signatureSyncService.getUserSyncStatuses(organizationId, {
      status: 'failed',
      limit: 1000,
    });

    if (failedResult.users.length === 0) {
      return res.json({
        success: true,
        message: 'No failed syncs to retry',
        data: { retried: 0 },
      });
    }

    // Mark them as pending
    const userIds = failedResult.users.map(u => u.id);
    await signatureSyncService.markUsersPending(userIds);

    // Run sync
    const result = await signatureSyncService.syncOrganizationSignatures(organizationId);

    return res.json({
      success: true,
      message: `Retried ${failedResult.users.length} failed syncs`,
      data: {
        retried: failedResult.users.length,
        successCount: result.successCount,
        failureCount: result.failureCount,
      },
    });
  } catch (error: any) {
    console.error('Error retrying failed syncs:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to retry syncs',
    });
  }
});

export default router;
