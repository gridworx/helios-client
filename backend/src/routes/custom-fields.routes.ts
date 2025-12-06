import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { customFieldsService } from '../services/custom-fields.service';
import { logger } from '../utils/logger';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/organization/custom-fields/definitions
 * Get all custom field definitions for the organization
 */
router.get('/definitions', async (req: Request, res: Response): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      res.status(400).json({
        success: false,
        error: 'Organization ID not found'
      });
      return;
    }

    const fields = await customFieldsService.getFieldDefinitions(organizationId);

    res.json({
      success: true,
      data: fields
    });
  } catch (error: any) {
    logger.error('Failed to get custom field definitions', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get custom field definitions'
    });
  }
});

/**
 * GET /api/organization/custom-fields/definitions/category/:category
 * Get custom field definitions by category
 */
router.get('/definitions/category/:category', async (req: Request, res: Response): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId;
    const { category } = req.params;

    if (!organizationId) {
      res.status(400).json({
        success: false,
        error: 'Organization ID not found'
      });
      return;
    }

    const fields = await customFieldsService.getFieldsByCategory(organizationId, category);

    res.json({
      success: true,
      data: fields
    });
  } catch (error: any) {
    logger.error('Failed to get fields by category', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get fields by category'
    });
  }
});

/**
 * GET /api/organization/custom-fields/signature-fields
 * Get fields that can be used in signatures
 */
router.get('/signature-fields', async (req: Request, res: Response): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      res.status(400).json({
        success: false,
        error: 'Organization ID not found'
      });
      return;
    }

    const fields = await customFieldsService.getSignatureFields(organizationId);

    res.json({
      success: true,
      data: fields
    });
  } catch (error: any) {
    logger.error('Failed to get signature fields', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get signature fields'
    });
  }
});

/**
 * GET /api/organization/custom-fields/available-defaults
 * Get available default fields that can be enabled
 */
router.get('/available-defaults', async (req: Request, res: Response): Promise<void> => {
  try {
    const fields = await customFieldsService.getAvailableDefaultFields();

    res.json({
      success: true,
      data: fields
    });
  } catch (error: any) {
    logger.error('Failed to get available default fields', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get available default fields'
    });
  }
});

/**
 * POST /api/organization/custom-fields/definitions
 * Create or update a custom field definition (admin only)
 */
router.post('/definitions', async (req: Request, res: Response): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId;
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!organizationId || !userId) {
      res.status(400).json({
        success: false,
        error: 'Organization or user ID not found'
      });
      return;
    }

    // Only admins can create/modify field definitions
    if (userRole !== 'admin') {
      res.status(403).json({
        success: false,
        error: 'Only administrators can manage custom field definitions'
      });
      return;
    }

    const fieldData = req.body;

    if (!fieldData.fieldKey || !fieldData.fieldLabel) {
      res.status(400).json({
        success: false,
        error: 'Field key and label are required'
      });
      return;
    }

    const field = await customFieldsService.upsertFieldDefinition(
      organizationId,
      fieldData,
      userId
    );

    res.json({
      success: true,
      data: field,
      message: 'Custom field definition saved successfully'
    });
  } catch (error: any) {
    logger.error('Failed to save custom field definition', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to save custom field definition'
    });
  }
});

/**
 * DELETE /api/organization/custom-fields/definitions/:fieldKey
 * Delete (deactivate) a custom field definition (admin only)
 */
router.delete('/definitions/:fieldKey', async (req: Request, res: Response): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId;
    const userRole = req.user?.role;
    const { fieldKey } = req.params;

    if (!organizationId) {
      res.status(400).json({
        success: false,
        error: 'Organization ID not found'
      });
      return;
    }

    // Only admins can delete field definitions
    if (userRole !== 'admin') {
      res.status(403).json({
        success: false,
        error: 'Only administrators can delete custom field definitions'
      });
      return;
    }

    const deleted = await customFieldsService.deleteFieldDefinition(organizationId, fieldKey);

    if (!deleted) {
      res.status(404).json({
        success: false,
        error: 'Custom field definition not found'
      });
      return;
    }

    res.json({
      success: true,
      message: 'Custom field definition deleted successfully'
    });
  } catch (error: any) {
    logger.error('Failed to delete custom field definition', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to delete custom field definition'
    });
  }
});

/**
 * GET /api/organization/custom-fields/user/:userId
 * Get a user's custom field values
 */
router.get('/user/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const requestingUserId = req.user?.userId;
    const userRole = req.user?.role;

    // Users can only view their own fields unless they're admin
    if (userId !== requestingUserId && userRole !== 'admin' && userRole !== 'manager') {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions to view user custom fields'
      });
      return;
    }

    const fieldValues = await customFieldsService.getUserFieldValues(userId);

    res.json({
      success: true,
      data: fieldValues
    });
  } catch (error: any) {
    logger.error('Failed to get user custom field values', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get user custom field values'
    });
  }
});

/**
 * PUT /api/organization/custom-fields/user/:userId
 * Update a user's custom field values
 */
router.put('/user/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const requestingUserId = req.user?.userId;
    const userRole = req.user?.role;
    const fieldValues = req.body;

    // Users can only update their own fields unless they're admin
    if (userId !== requestingUserId && userRole !== 'admin') {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions to update user custom fields'
      });
      return;
    }

    await customFieldsService.updateUserFieldValues(userId, fieldValues);

    res.json({
      success: true,
      message: 'Custom field values updated successfully'
    });
  } catch (error: any) {
    logger.error('Failed to update user custom field values', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to update custom field values'
    });
  }
});

/**
 * POST /api/organization/custom-fields/initialize-defaults
 * Initialize default custom fields for the organization (admin only)
 */
router.post('/initialize-defaults', async (req: Request, res: Response): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId;
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!organizationId || !userId) {
      res.status(400).json({
        success: false,
        error: 'Organization or user ID not found'
      });
      return;
    }

    // Only admins can initialize defaults
    if (userRole !== 'admin') {
      res.status(403).json({
        success: false,
        error: 'Only administrators can initialize default fields'
      });
      return;
    }

    await customFieldsService.initializeDefaultFields(organizationId, userId);

    res.json({
      success: true,
      message: 'Default custom fields initialized successfully'
    });
  } catch (error: any) {
    logger.error('Failed to initialize default fields', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to initialize default fields'
    });
  }
});

export default router;