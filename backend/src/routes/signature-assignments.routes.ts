/**
 * Signature Assignment Routes
 *
 * Routes for managing signature template assignments to users, groups, departments, etc.
 * Uses the signature_assignments table (migration 044).
 */

import { Router, Request, Response } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth';
import { signatureAssignmentService } from '../services/signature-assignment.service';
import { AssignmentType } from '../types/signatures';

const router = Router();

// =====================================================
// SIGNATURE ASSIGNMENTS CRUD
// =====================================================

/**
 * GET /api/signatures/v2/assignments
 * List all signature assignments for the organization
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const {
      template_id,
      assignment_type,
      is_active,
      include_details,
    } = req.query;

    const assignments = await signatureAssignmentService.getAssignments(
      organizationId,
      {
        templateId: template_id as string,
        assignmentType: assignment_type as AssignmentType,
        isActive: is_active === undefined ? undefined : is_active === 'true',
        includeDetails: include_details === 'true',
      }
    );

    return res.json({
      success: true,
      data: assignments,
    });
  } catch (error: any) {
    console.error('Error listing assignments:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to list assignments',
    });
  }
});

/**
 * GET /api/signatures/v2/assignments/:id
 * Get a single assignment by ID
 */
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const assignment = await signatureAssignmentService.getAssignment(id);

    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: 'Assignment not found',
      });
    }

    // Verify organization ownership
    if (assignment.organizationId !== req.user?.organizationId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    return res.json({
      success: true,
      data: assignment,
    });
  } catch (error: any) {
    console.error('Error getting assignment:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get assignment',
    });
  }
});

/**
 * POST /api/signatures/v2/assignments
 * Create a new signature assignment
 */
router.post('/', requireAuth, requirePermission('admin'), async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    const userId = req.user?.userId;

    if (!organizationId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const {
      template_id,
      assignment_type,
      target_id,
      target_value,
      priority,
      is_active,
    } = req.body;

    // Validate required fields
    if (!template_id || !assignment_type) {
      return res.status(400).json({
        success: false,
        error: 'template_id and assignment_type are required',
      });
    }

    // Validate assignment_type
    const validTypes: AssignmentType[] = ['user', 'group', 'dynamic_group', 'department', 'ou', 'organization'];
    if (!validTypes.includes(assignment_type)) {
      return res.status(400).json({
        success: false,
        error: `Invalid assignment_type. Must be one of: ${validTypes.join(', ')}`,
      });
    }

    const assignment = await signatureAssignmentService.createAssignment(
      organizationId,
      {
        templateId: template_id,
        assignmentType: assignment_type,
        targetId: target_id,
        targetValue: target_value,
        priority,
        isActive: is_active,
      },
      userId
    );

    return res.status(201).json({
      success: true,
      message: 'Assignment created successfully',
      data: assignment,
    });
  } catch (error: any) {
    console.error('Error creating assignment:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to create assignment',
    });
  }
});

/**
 * PUT /api/signatures/v2/assignments/:id
 * Update an existing assignment
 */
router.put('/:id', requireAuth, requirePermission('admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { priority, is_active } = req.body;

    // Verify ownership before update
    const existing = await signatureAssignmentService.getAssignment(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Assignment not found',
      });
    }

    if (existing.organizationId !== req.user?.organizationId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    const assignment = await signatureAssignmentService.updateAssignment(id, {
      priority,
      isActive: is_active,
    });

    return res.json({
      success: true,
      message: 'Assignment updated successfully',
      data: assignment,
    });
  } catch (error: any) {
    console.error('Error updating assignment:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to update assignment',
    });
  }
});

/**
 * DELETE /api/signatures/v2/assignments/:id
 * Delete an assignment
 */
router.delete('/:id', requireAuth, requirePermission('admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Verify ownership before delete
    const existing = await signatureAssignmentService.getAssignment(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Assignment not found',
      });
    }

    if (existing.organizationId !== req.user?.organizationId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    const deleted = await signatureAssignmentService.deleteAssignment(id);

    if (!deleted) {
      return res.status(500).json({
        success: false,
        error: 'Failed to delete assignment',
      });
    }

    return res.json({
      success: true,
      message: 'Assignment deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting assignment:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete assignment',
    });
  }
});

// =====================================================
// EFFECTIVE SIGNATURE RESOLUTION
// =====================================================

/**
 * GET /api/signatures/v2/assignments/user/:userId/effective
 * Get the effective signature assignment for a specific user
 */
router.get('/user/:userId/effective', requireAuth, async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    const { userId } = req.params;

    if (!organizationId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const effective = await signatureAssignmentService.getEffectiveSignature(userId);

    if (!effective) {
      return res.json({
        success: true,
        data: null,
        message: 'No signature assignment for this user',
      });
    }

    // Verify user is in the same organization
    if (effective.organizationId !== organizationId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    return res.json({
      success: true,
      data: effective,
    });
  } catch (error: any) {
    console.error('Error getting effective signature:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get effective signature',
    });
  }
});

/**
 * GET /api/signatures/v2/assignments/effective
 * Get effective signatures for all users in the organization
 */
router.get('/effective/all', requireAuth, async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const effectiveSignatures = await signatureAssignmentService.getAllEffectiveSignatures(
      organizationId
    );

    return res.json({
      success: true,
      data: effectiveSignatures,
    });
  } catch (error: any) {
    console.error('Error getting effective signatures:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get effective signatures',
    });
  }
});

// =====================================================
// ASSIGNMENT PREVIEW
// =====================================================

/**
 * POST /api/signatures/v2/assignments/preview
 * Preview which users would be affected by an assignment (without creating it)
 */
router.post('/preview', requireAuth, async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { assignment_type, target_id, target_value } = req.body;

    if (!assignment_type) {
      return res.status(400).json({
        success: false,
        error: 'assignment_type is required',
      });
    }

    const affectedUsers = await signatureAssignmentService.previewAffectedUsers(
      organizationId,
      assignment_type as AssignmentType,
      target_id,
      target_value
    );

    return res.json({
      success: true,
      data: {
        users: affectedUsers,
        count: affectedUsers.length,
      },
    });
  } catch (error: any) {
    console.error('Error previewing assignment:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to preview assignment',
    });
  }
});

// =====================================================
// AVAILABLE TARGETS
// =====================================================

/**
 * GET /api/signatures/v2/assignments/targets/:type
 * Get available assignment targets (users, groups, departments, etc.)
 */
router.get('/targets/:type', requireAuth, async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    const { type } = req.params;

    if (!organizationId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const validTypes: AssignmentType[] = ['user', 'group', 'dynamic_group', 'department', 'ou', 'organization'];
    if (!validTypes.includes(type as AssignmentType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid target type. Must be one of: ${validTypes.join(', ')}`,
      });
    }

    const targets = await signatureAssignmentService.getAvailableTargets(
      organizationId,
      type as AssignmentType
    );

    return res.json({
      success: true,
      data: targets,
    });
  } catch (error: any) {
    console.error('Error getting targets:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get targets',
    });
  }
});

/**
 * GET /api/signatures/v2/assignments/targets
 * Get all available target types with counts
 */
router.get('/targets', requireAuth, async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Get counts for each type
    const types: { type: AssignmentType; label: string; description: string }[] = [
      { type: 'user', label: 'Individual Users', description: 'Assign to specific users (highest priority)' },
      { type: 'dynamic_group', label: 'Dynamic Groups', description: 'Assign based on rule-based group membership' },
      { type: 'group', label: 'Static Groups', description: 'Assign to static access groups' },
      { type: 'department', label: 'Departments', description: 'Assign to all users in a department' },
      { type: 'ou', label: 'Organizational Units', description: 'Assign based on Google Workspace OU' },
      { type: 'organization', label: 'Organization Default', description: 'Apply to all users (lowest priority)' },
    ];

    const result = await Promise.all(
      types.map(async (t) => {
        const targets = await signatureAssignmentService.getAvailableTargets(organizationId, t.type);
        return {
          ...t,
          availableTargets: targets.length,
        };
      })
    );

    return res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Error getting target types:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get target types',
    });
  }
});

export default router;
