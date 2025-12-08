import { Router, Request, Response } from 'express';
import multer from 'multer';
import { bulkOperationsService } from '../services/bulk-operations.service';
import { csvParserService, ValidationRule } from '../services/csv-parser.service';
import { authenticateToken } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== 'text/csv' && !file.originalname.endsWith('.csv')) {
      cb(new Error('Only CSV files are allowed'));
      return;
    }
    cb(null, true);
  },
});

/**
 * POST /api/bulk/upload
 * Upload and validate CSV file
 */
router.post('/upload', authenticateToken, upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
      });
    }

    const { operationType } = req.body;
    if (!operationType) {
      return res.status(400).json({
        success: false,
        error: 'Operation type is required',
      });
    }

    // Parse CSV
    const csvContent = req.file.buffer.toString('utf-8');
    const parseResult = csvParserService.parseCSV(csvContent);

    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Failed to parse CSV',
        errors: parseResult.errors,
      });
    }

    // Define validation rules based on operation type
    const validationRules = getValidationRules(operationType);

    // Validate data
    const validationResult = csvParserService.validateData(
      parseResult.data || [],
      validationRules
    );

    // Transform to system format
    const transformedData = csvParserService.transformToSystemFormat(
      validationResult.data || [],
      operationType
    );

    res.json({
      success: validationResult.success,
      data: transformedData,
      errors: validationResult.errors,
      meta: validationResult.meta,
      headers: parseResult.headers,
    });
  } catch (error: any) {
    logger.error('CSV upload error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process CSV file',
    });
  }
});

/**
 * POST /api/bulk/preview
 * Preview changes before execution
 */
router.post('/preview', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { operationType, items } = req.body;

    if (!operationType || !items || !Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body',
      });
    }

    // Generate preview summary
    const preview = {
      operationType,
      totalItems: items.length,
      sampleItems: items.slice(0, 5), // Show first 5 items
      estimatedTime: Math.ceil(items.length / 10) * 2, // Rough estimate: 10 items per 2 seconds
    };

    res.json({
      success: true,
      data: preview,
    });
  } catch (error: any) {
    logger.error('Preview error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate preview',
    });
  }
});

/**
 * POST /api/bulk/execute
 * Execute bulk operation
 */
router.post('/execute', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { operationType, operationName, items } = req.body;
    const organizationId = req.user?.organizationId;
    const userId = req.user?.userId;

    if (!organizationId || !userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    if (!operationType || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body',
      });
    }

    // Create bulk operation
    const operation = await bulkOperationsService.createBulkOperation({
      organizationId,
      operationType,
      operationName,
      items,
      createdBy: userId,
    });

    // Queue for processing
    await bulkOperationsService.queueBulkOperation(operation.id);

    res.json({
      success: true,
      data: {
        bulkOperationId: operation.id,
        status: operation.status,
        totalItems: operation.totalItems,
      },
      message: 'Bulk operation queued for processing',
    });
  } catch (error: any) {
    logger.error('Execute error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to execute bulk operation',
    });
  }
});

/**
 * GET /api/bulk/status/:id
 * Get bulk operation status
 */
router.get('/status/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const operation = await bulkOperationsService.getBulkOperation(id);

    if (!operation) {
      return res.status(404).json({
        success: false,
        error: 'Bulk operation not found',
      });
    }

    // Calculate progress percentage
    const progress = operation.totalItems > 0
      ? Math.floor((operation.processedItems / operation.totalItems) * 100)
      : 0;

    res.json({
      success: true,
      data: {
        ...operation,
        progress,
      },
    });
  } catch (error: any) {
    logger.error('Status error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get bulk operation status',
    });
  }
});

/**
 * GET /api/bulk/history
 * Get bulk operation history
 */
router.get('/history', authenticateToken, async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const operations = await bulkOperationsService.getBulkOperations(organizationId, limit);

    res.json({
      success: true,
      data: operations,
    });
  } catch (error: any) {
    logger.error('History error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get bulk operation history',
    });
  }
});

/**
 * GET /api/bulk/template/:operationType
 * Download CSV template for operation type
 */
router.get('/template/:operationType', authenticateToken, (req: Request, res: Response) => {
  try {
    const { operationType } = req.params;
    const template = csvParserService.generateTemplate(operationType);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found for this operation type',
      });
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${operationType}_template.csv"`);
    res.send(template);
  } catch (error: any) {
    logger.error('Template error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate template',
    });
  }
});

/**
 * POST /api/bulk/export
 * Export data to CSV
 */
router.post('/export', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { data, headers, filename } = req.body;

    if (!data || !Array.isArray(data)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid data',
      });
    }

    const csv = csvParserService.exportToCSV(data, headers);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename || 'export.csv'}"`);
    res.send(csv);
  } catch (error: any) {
    logger.error('Export error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to export data',
    });
  }
});

// ===== TEMPLATE MANAGEMENT ROUTES =====

/**
 * POST /api/bulk/templates
 * Create a new template
 */
router.post('/templates', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { name, description, operationType, templateData } = req.body;
    const organizationId = req.user?.organizationId;
    const userId = req.user?.userId;

    if (!organizationId || !userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    if (!name || !operationType || !templateData) {
      return res.status(400).json({
        success: false,
        error: 'Name, operationType, and templateData are required',
      });
    }

    const template = await bulkOperationsService.createTemplate({
      organizationId,
      name,
      description,
      operationType,
      templateData,
      createdBy: userId,
    });

    res.json({
      success: true,
      data: template,
      message: 'Template created successfully',
    });
  } catch (error: any) {
    logger.error('Create template error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create template',
    });
  }
});

/**
 * GET /api/bulk/templates
 * Get all templates for organization
 */
router.get('/templates', authenticateToken, async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const templates = await bulkOperationsService.getTemplates(organizationId);

    res.json({
      success: true,
      data: templates,
    });
  } catch (error: any) {
    logger.error('Get templates error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get templates',
    });
  }
});

/**
 * GET /api/bulk/templates/:id
 * Get a single template
 */
router.get('/templates/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const template = await bulkOperationsService.getTemplate(id);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found',
      });
    }

    res.json({
      success: true,
      data: template,
    });
  } catch (error: any) {
    logger.error('Get template error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get template',
    });
  }
});

/**
 * PUT /api/bulk/templates/:id
 * Update a template
 */
router.put('/templates/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, templateData } = req.body;

    const template = await bulkOperationsService.updateTemplate(id, {
      name,
      description,
      templateData,
    });

    res.json({
      success: true,
      data: template,
      message: 'Template updated successfully',
    });
  } catch (error: any) {
    logger.error('Update template error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update template',
    });
  }
});

/**
 * DELETE /api/bulk/templates/:id
 * Delete a template
 */
router.delete('/templates/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await bulkOperationsService.deleteTemplate(id);

    res.json({
      success: true,
      message: 'Template deleted successfully',
    });
  } catch (error: any) {
    logger.error('Delete template error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete template',
    });
  }
});

// ===== GOOGLE WORKSPACE SYNC ROUTES =====

/**
 * POST /api/bulk/sync/users
 * Bulk update users with Google Workspace sync
 */
router.post('/sync/users', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { items, syncToGoogleWorkspace = true } = req.body;
    const organizationId = req.user?.organizationId;
    const userId = req.user?.userId;

    if (!organizationId || !userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Items array is required and must not be empty',
      });
    }

    // Get estimated time
    const estimate = bulkOperationsService.estimateBulkOperationTime(
      items.length,
      syncToGoogleWorkspace
    );

    // Process with sync
    const result = await bulkOperationsService.processBulkUserUpdatesWithSync(
      organizationId,
      items,
      userId
    );

    res.json({
      success: result.failureCount === 0,
      data: {
        totalItems: items.length,
        localResults: {
          successCount: result.localResults.filter(r => r.success).length,
          failureCount: result.localResults.filter(r => !r.success).length,
        },
        googleWorkspaceResults: {
          successCount: result.gwResults.filter(r => r.success).length,
          failureCount: result.gwResults.filter(r => !r.success).length,
          synced: result.gwResults.length > 0,
        },
        estimatedTime: estimate,
      },
      message: result.failureCount === 0
        ? 'Bulk update completed successfully'
        : `Completed with ${result.failureCount} failures`,
    });
  } catch (error: any) {
    logger.error('Bulk sync users error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process bulk user updates',
    });
  }
});

/**
 * POST /api/bulk/sync/suspend
 * Bulk suspend users with Google Workspace sync
 */
router.post('/sync/suspend', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { userEmails } = req.body;
    const organizationId = req.user?.organizationId;
    const userId = req.user?.userId;

    if (!organizationId || !userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    if (!userEmails || !Array.isArray(userEmails) || userEmails.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'userEmails array is required and must not be empty',
      });
    }

    const result = await bulkOperationsService.processBulkSuspendWithSync(
      organizationId,
      userEmails,
      userId
    );

    res.json({
      success: result.failureCount === 0,
      data: {
        totalItems: userEmails.length,
        localResults: {
          successCount: result.localResults.filter(r => r.success).length,
          failureCount: result.localResults.filter(r => !r.success).length,
        },
        googleWorkspaceResults: {
          successCount: result.gwResults.filter(r => r.success).length,
          failureCount: result.gwResults.filter(r => !r.success).length,
          synced: result.gwResults.length > 0,
        },
      },
      message: result.failureCount === 0
        ? 'Bulk suspend completed successfully'
        : `Completed with ${result.failureCount} failures`,
    });
  } catch (error: any) {
    logger.error('Bulk sync suspend error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process bulk suspend',
    });
  }
});

/**
 * POST /api/bulk/sync/move-ou
 * Bulk move users to OU with Google Workspace sync
 */
router.post('/sync/move-ou', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { userEmails, targetOU } = req.body;
    const organizationId = req.user?.organizationId;
    const userId = req.user?.userId;

    if (!organizationId || !userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    if (!userEmails || !Array.isArray(userEmails) || userEmails.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'userEmails array is required and must not be empty',
      });
    }

    if (!targetOU) {
      return res.status(400).json({
        success: false,
        error: 'targetOU is required',
      });
    }

    const result = await bulkOperationsService.processBulkMoveOUWithSync(
      organizationId,
      userEmails,
      targetOU,
      userId
    );

    res.json({
      success: result.failureCount === 0,
      data: {
        totalItems: userEmails.length,
        targetOU,
        localResults: {
          successCount: result.localResults.filter(r => r.success).length,
          failureCount: result.localResults.filter(r => !r.success).length,
        },
        googleWorkspaceResults: {
          successCount: result.gwResults.filter(r => r.success).length,
          failureCount: result.gwResults.filter(r => !r.success).length,
          synced: result.gwResults.length > 0,
        },
      },
      message: result.failureCount === 0
        ? 'Bulk OU move completed successfully'
        : `Completed with ${result.failureCount} failures`,
    });
  } catch (error: any) {
    logger.error('Bulk sync move OU error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process bulk OU move',
    });
  }
});

/**
 * POST /api/bulk/sync/group-members
 * Bulk add/remove group members with Google Workspace sync
 */
router.post('/sync/group-members', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { operations } = req.body;
    const organizationId = req.user?.organizationId;
    const userId = req.user?.userId;

    if (!organizationId || !userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    if (!operations || !Array.isArray(operations) || operations.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'operations array is required and must not be empty',
      });
    }

    // Validate each operation
    for (const op of operations) {
      if (!op.userEmail || !op.groupId || !['add', 'remove'].includes(op.operation)) {
        return res.status(400).json({
          success: false,
          error: 'Each operation must have userEmail, groupId, and operation (add/remove)',
        });
      }
    }

    const result = await bulkOperationsService.processBulkGroupMembershipWithSync(
      organizationId,
      operations,
      userId
    );

    res.json({
      success: result.failureCount === 0,
      data: {
        totalOperations: operations.length,
        localResults: {
          successCount: result.localResults.filter(r => r.success).length,
          failureCount: result.localResults.filter(r => !r.success).length,
        },
        googleWorkspaceResults: {
          successCount: result.gwResults.filter(r => r.success).length,
          failureCount: result.gwResults.filter(r => !r.success).length,
          synced: result.gwResults.length > 0,
        },
      },
      message: result.failureCount === 0
        ? 'Bulk group membership operations completed successfully'
        : `Completed with ${result.failureCount} failures`,
    });
  } catch (error: any) {
    logger.error('Bulk sync group members error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process bulk group membership operations',
    });
  }
});

/**
 * GET /api/bulk/sync/estimate
 * Get estimated time for a bulk operation
 */
router.get('/sync/estimate', authenticateToken, (req: Request, res: Response) => {
  try {
    const itemCount = parseInt(req.query.itemCount as string) || 0;
    const includeGoogleWorkspace = req.query.syncToGoogleWorkspace === 'true';

    if (itemCount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'itemCount must be a positive number',
      });
    }

    const estimate = bulkOperationsService.estimateBulkOperationTime(
      itemCount,
      includeGoogleWorkspace
    );

    res.json({
      success: true,
      data: estimate,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to calculate estimate',
    });
  }
});

/**
 * Helper function to get validation rules based on operation type
 */
function getValidationRules(operationType: string): ValidationRule[] {
  switch (operationType) {
    case 'user_update':
    case 'user_create':
      return [
        { field: 'email', required: true, type: 'email' },
        { field: 'firstName', required: operationType === 'user_create' },
        { field: 'lastName', required: operationType === 'user_create' },
        { field: 'department', required: false },
        { field: 'jobTitle', required: false },
        { field: 'organizationalUnit', required: false },
      ];

    case 'group_membership_add':
    case 'group_membership_remove':
      return [
        { field: 'groupEmail', required: true, type: 'email' },
        { field: 'userEmail', required: true, type: 'email' },
      ];

    case 'user_suspend':
    case 'user_delete':
      return [
        { field: 'email', required: true, type: 'email' },
      ];

    default:
      return [];
  }
}

export default router;
