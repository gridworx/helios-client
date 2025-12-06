import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { authenticateToken } from '../middleware/auth';
import {
  getLabels,
  updateLabels,
  resetLabelsToDefaults,
  getLabelsWithAvailability,
} from '../services/label.service';
import {
  getAvailableEntities,
  getAvailableEntitiesDetailed,
} from '../services/entity-availability.service';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/organization/labels
 * Get all custom labels for the organization
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      res.status(400).json({
        success: false,
        error: 'Organization ID not found',
      });
      return;
    }

    const labels = await getLabels(organizationId);

    res.json({
      success: true,
      data: labels,
    });
  } catch (error: any) {
    logger.error('Failed to get labels', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get labels',
      message: error.message,
    });
  }
});

/**
 * GET /api/organization/labels/with-availability
 * Get labels with entity availability information
 */
router.get('/with-availability', async (req: Request, res: Response): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      res.status(400).json({
        success: false,
        error: 'Organization ID not found',
      });
      return;
    }

    const result = await getLabelsWithAvailability(organizationId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error('Failed to get labels with availability', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get labels with availability',
      message: error.message,
    });
  }
});

/**
 * PATCH /api/organization/labels
 * Update custom labels (admin only)
 */
router.patch('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId;
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!organizationId || !userId) {
      res.status(400).json({
        success: false,
        error: 'Organization ID or User ID not found',
      });
      return;
    }

    // Check admin role
    if (userRole !== 'admin') {
      res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Only administrators can update custom labels',
      });
      return;
    }

    const { labels } = req.body;

    if (!labels || typeof labels !== 'object') {
      res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: 'Labels object is required',
      });
      return;
    }

    // Update labels
    const updatedLabels = await updateLabels(organizationId, labels, userId);

    res.json({
      success: true,
      data: updatedLabels,
      message: 'Labels updated successfully',
    });
  } catch (error: any) {
    logger.error('Failed to update labels', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to update labels',
      message: error.message,
    });
  }
});

/**
 * POST /api/organization/labels/reset
 * Reset all labels to defaults (admin only)
 */
router.post('/reset', async (req: Request, res: Response): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId;
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!organizationId || !userId) {
      res.status(400).json({
        success: false,
        error: 'Organization ID or User ID not found',
      });
      return;
    }

    // Check admin role
    if (userRole !== 'admin') {
      res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Only administrators can reset labels',
      });
      return;
    }

    const defaultLabels = await resetLabelsToDefaults(organizationId, userId);

    res.json({
      success: true,
      data: defaultLabels,
      message: 'Labels reset to defaults successfully',
    });
  } catch (error: any) {
    logger.error('Failed to reset labels', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to reset labels',
      message: error.message,
    });
  }
});

/**
 * GET /api/organization/available-entities
 * Get list of available canonical entities based on enabled modules
 */
router.get('/available-entities', async (req: Request, res: Response): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      res.status(400).json({
        success: false,
        error: 'Organization ID not found',
      });
      return;
    }

    const entities = await getAvailableEntities(organizationId);

    res.json({
      success: true,
      data: entities,
    });
  } catch (error: any) {
    logger.error('Failed to get available entities', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get available entities',
      message: error.message,
    });
  }
});

/**
 * GET /api/organization/available-entities/detailed
 * Get detailed availability info (which modules provide which entities)
 */
router.get('/available-entities/detailed', async (req: Request, res: Response): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      res.status(400).json({
        success: false,
        error: 'Organization ID not found',
      });
      return;
    }

    const availability = await getAvailableEntitiesDetailed(organizationId);

    res.json({
      success: true,
      data: availability,
    });
  } catch (error: any) {
    logger.error('Failed to get detailed entity availability', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get detailed entity availability',
      message: error.message,
    });
  }
});

export default router;
