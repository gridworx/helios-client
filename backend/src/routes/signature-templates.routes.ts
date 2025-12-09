/**
 * Signature Templates Routes
 *
 * API endpoints for email signature template management:
 * - Template CRUD operations
 * - Template preview and rendering
 * - Merge field information
 */

import { Router, Request, Response } from 'express';
import { signatureTemplateService } from '../services/signature-template.service';
import { authenticateToken } from '../middleware/auth';
import { logger } from '../utils/logger';
import {
  CreateSignatureTemplateDTO,
  UpdateSignatureTemplateDTO,
  SignatureTemplateStatus,
  MERGE_FIELDS,
} from '../types/signatures';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// ==========================================
// MERGE FIELDS
// ==========================================

/**
 * GET /api/signatures/templates/merge-fields
 * Get available merge fields grouped by category
 */
router.get('/merge-fields', async (req: Request, res: Response) => {
  try {
    const grouped = signatureTemplateService.getAvailableMergeFields();
    res.json({ success: true, data: grouped });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error getting merge fields', { error: message });
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /api/signatures/templates/merge-fields/list
 * Get flat list of all merge fields
 */
router.get('/merge-fields/list', async (req: Request, res: Response) => {
  try {
    res.json({ success: true, data: MERGE_FIELDS });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error getting merge fields list', { error: message });
    res.status(500).json({ success: false, error: message });
  }
});

// ==========================================
// TEMPLATE CRUD
// ==========================================

/**
 * GET /api/signatures/templates
 * List signature templates
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ success: false, error: 'Organization ID required' });
    }

    const { status, isCampaignTemplate, includeAssignments } = req.query;

    const templates = await signatureTemplateService.getTemplates(organizationId, {
      status: status as SignatureTemplateStatus | undefined,
      isCampaignTemplate: isCampaignTemplate === 'true' ? true : isCampaignTemplate === 'false' ? false : undefined,
      includeAssignmentCounts: includeAssignments === 'true',
    });

    res.json({ success: true, data: templates });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error listing signature templates', { error: message });
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /api/signatures/templates/:id
 * Get single signature template
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const template = await signatureTemplateService.getTemplate(req.params.id);

    if (!template) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

    // Verify organization access
    if (template.organizationId !== req.user?.organizationId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    res.json({ success: true, data: template });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error getting signature template', { error: message, templateId: req.params.id });
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * POST /api/signatures/templates
 * Create signature template
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    const userId = req.user?.userId;

    if (!organizationId) {
      return res.status(401).json({ success: false, error: 'Organization ID required' });
    }

    const data: CreateSignatureTemplateDTO = req.body;

    // Validation
    if (!data.name || !data.name.trim()) {
      return res.status(400).json({ success: false, error: 'Template name is required' });
    }

    if (!data.htmlContent || !data.htmlContent.trim()) {
      return res.status(400).json({ success: false, error: 'HTML content is required' });
    }

    const template = await signatureTemplateService.createTemplate(
      organizationId,
      data,
      userId
    );

    res.status(201).json({ success: true, data: template });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error creating signature template', { error: message });
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * PUT /api/signatures/templates/:id
 * Update signature template
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;

    // Verify template exists and belongs to organization
    const existing = await signatureTemplateService.getTemplate(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

    if (existing.organizationId !== organizationId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const data: UpdateSignatureTemplateDTO = req.body;
    const template = await signatureTemplateService.updateTemplate(req.params.id, data);

    res.json({ success: true, data: template });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error updating signature template', { error: message, templateId: req.params.id });
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * DELETE /api/signatures/templates/:id
 * Delete signature template
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;

    // Verify template exists and belongs to organization
    const existing = await signatureTemplateService.getTemplate(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

    if (existing.organizationId !== organizationId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const deleted = await signatureTemplateService.deleteTemplate(req.params.id);

    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

    res.json({ success: true, message: 'Template deleted' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error deleting signature template', { error: message, templateId: req.params.id });

    // Handle specific error for templates with assignments
    if (message.includes('active assignments')) {
      return res.status(400).json({ success: false, error: message });
    }

    res.status(500).json({ success: false, error: message });
  }
});

// ==========================================
// TEMPLATE ACTIONS
// ==========================================

/**
 * POST /api/signatures/templates/:id/clone
 * Clone a signature template
 */
router.post('/:id/clone', async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    const userId = req.user?.userId;

    // Verify template exists and belongs to organization
    const existing = await signatureTemplateService.getTemplate(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

    if (existing.organizationId !== organizationId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'New template name is required' });
    }

    const template = await signatureTemplateService.cloneTemplate(req.params.id, name, userId);

    res.status(201).json({ success: true, data: template });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error cloning signature template', { error: message, templateId: req.params.id });
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * POST /api/signatures/templates/:id/preview
 * Preview template rendered with user data
 */
router.post('/:id/preview', async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;

    // Verify template exists and belongs to organization
    const existing = await signatureTemplateService.getTemplate(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

    if (existing.organizationId !== organizationId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const { userId } = req.body;

    // If userId provided, render with that user's data
    // Otherwise render with sample data
    const rendered = await signatureTemplateService.previewTemplate(
      existing.htmlContent,
      userId
    );

    res.json({
      success: true,
      data: {
        template: existing,
        rendered,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error previewing signature template', { error: message, templateId: req.params.id });
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * POST /api/signatures/templates/preview-raw
 * Preview raw HTML content (for editor live preview)
 */
router.post('/preview-raw', async (req: Request, res: Response) => {
  try {
    const { htmlContent, userId } = req.body;

    if (!htmlContent) {
      return res.status(400).json({ success: false, error: 'HTML content is required' });
    }

    const rendered = await signatureTemplateService.previewTemplate(htmlContent, userId);

    res.json({ success: true, data: rendered });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error previewing raw signature content', { error: message });
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * POST /api/signatures/templates/validate
 * Validate merge fields in content
 */
router.post('/validate', async (req: Request, res: Response) => {
  try {
    const { htmlContent } = req.body;

    if (!htmlContent) {
      return res.status(400).json({ success: false, error: 'HTML content is required' });
    }

    const mergeFields = signatureTemplateService.extractMergeFields(htmlContent);
    const invalidFields = signatureTemplateService.validateMergeFields(mergeFields);

    res.json({
      success: true,
      data: {
        mergeFields,
        invalidFields,
        isValid: invalidFields.length === 0,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error validating signature template', { error: message });
    res.status(500).json({ success: false, error: message });
  }
});

// ==========================================
// BATCH OPERATIONS
// ==========================================

/**
 * POST /api/signatures/templates/bulk-status
 * Update status for multiple templates
 */
router.post('/bulk-status', async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    const { templateIds, status } = req.body;

    if (!Array.isArray(templateIds) || templateIds.length === 0) {
      return res.status(400).json({ success: false, error: 'Template IDs are required' });
    }

    if (!['draft', 'active', 'archived'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    const results: { id: string; success: boolean; error?: string }[] = [];

    for (const id of templateIds) {
      try {
        // Verify access
        const template = await signatureTemplateService.getTemplate(id);
        if (!template || template.organizationId !== organizationId) {
          results.push({ id, success: false, error: 'Not found or access denied' });
          continue;
        }

        await signatureTemplateService.updateTemplate(id, { status });
        results.push({ id, success: true });
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Unknown error';
        results.push({ id, success: false, error: errMsg });
      }
    }

    const successCount = results.filter(r => r.success).length;

    res.json({
      success: true,
      data: {
        total: templateIds.length,
        updated: successCount,
        failed: templateIds.length - successCount,
        results,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error bulk updating signature templates', { error: message });
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
