/**
 * Lifecycle Routes
 *
 * API endpoints for user lifecycle management:
 * - Onboarding templates
 * - Offboarding templates
 * - Scheduled actions
 * - Lifecycle logs
 */

import { Router, Request, Response } from 'express';
import { userOnboardingService } from '../services/user-onboarding.service';
import { userOffboardingService } from '../services/user-offboarding.service';
import { scheduledActionService } from '../services/scheduled-action.service';
import { lifecycleLogService } from '../services/lifecycle-log.service';
import { authenticateToken } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

/**
 * @openapi
 * tags:
 *   - name: Lifecycle
 *     description: User lifecycle management (onboarding, offboarding, scheduled actions)
 */

// All routes require authentication
router.use(authenticateToken);

// ==========================================
// ONBOARDING TEMPLATES
// ==========================================

/**
 * @openapi
 * /api/v1/lifecycle/onboarding-templates:
 *   get:
 *     summary: List onboarding templates
 *     tags: [Lifecycle]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: departmentId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Onboarding templates
 */
router.get('/onboarding-templates', async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ success: false, error: 'Organization ID required' });
    }

    const { isActive, departmentId } = req.query;

    const templates = await userOnboardingService.getTemplates(organizationId, {
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      departmentId: departmentId as string | undefined,
    });

    res.json({ success: true, data: templates });
  } catch (error: any) {
    logger.error('Error listing onboarding templates', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @openapi
 * /api/v1/lifecycle/onboarding-templates/{id}:
 *   get:
 *     summary: Get onboarding template
 *     tags: [Lifecycle]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Template details
 *       404:
 *         description: Template not found
 */
router.get('/onboarding-templates/:id', async (req: Request, res: Response) => {
  try {
    const template = await userOnboardingService.getTemplate(req.params.id);

    if (!template) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

    res.json({ success: true, data: template });
  } catch (error: any) {
    logger.error('Error getting onboarding template', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @openapi
 * /api/v1/lifecycle/onboarding-templates:
 *   post:
 *     summary: Create onboarding template
 *     tags: [Lifecycle]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Template created
 */
router.post('/onboarding-templates', async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ success: false, error: 'Organization ID required' });
    }

    const template = await userOnboardingService.createTemplate(
      organizationId,
      req.body,
      req.user?.userId
    );

    res.status(201).json({ success: true, data: template });
  } catch (error: any) {
    logger.error('Error creating onboarding template', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @openapi
 * /api/v1/lifecycle/onboarding-templates/{id}:
 *   put:
 *     summary: Update onboarding template
 *     tags: [Lifecycle]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Template updated
 *       404:
 *         description: Template not found
 */
router.put('/onboarding-templates/:id', async (req: Request, res: Response) => {
  try {
    const template = await userOnboardingService.updateTemplate(req.params.id, req.body);

    if (!template) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

    res.json({ success: true, data: template });
  } catch (error: any) {
    logger.error('Error updating onboarding template', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @openapi
 * /api/v1/lifecycle/onboarding-templates/{id}:
 *   delete:
 *     summary: Delete onboarding template
 *     tags: [Lifecycle]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Template deleted
 *       404:
 *         description: Template not found
 */
router.delete('/onboarding-templates/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await userOnboardingService.deleteTemplate(req.params.id);

    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

    res.json({ success: true, message: 'Template deleted' });
  } catch (error: any) {
    logger.error('Error deleting onboarding template', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// OFFBOARDING TEMPLATES
// ==========================================

/**
 * @openapi
 * /api/v1/lifecycle/offboarding-templates:
 *   get:
 *     summary: List offboarding templates
 *     tags: [Lifecycle]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Offboarding templates
 */
router.get('/offboarding-templates', async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ success: false, error: 'Organization ID required' });
    }

    const { isActive } = req.query;

    const templates = await userOffboardingService.getTemplates(organizationId, {
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });

    res.json({ success: true, data: templates });
  } catch (error: any) {
    logger.error('Error listing offboarding templates', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @openapi
 * /api/v1/lifecycle/offboarding-templates/{id}:
 *   get:
 *     summary: Get offboarding template
 *     tags: [Lifecycle]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Template details
 *       404:
 *         description: Template not found
 */
router.get('/offboarding-templates/:id', async (req: Request, res: Response) => {
  try {
    const template = await userOffboardingService.getTemplate(req.params.id);

    if (!template) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

    res.json({ success: true, data: template });
  } catch (error: any) {
    logger.error('Error getting offboarding template', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @openapi
 * /api/v1/lifecycle/offboarding-templates:
 *   post:
 *     summary: Create offboarding template
 *     tags: [Lifecycle]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       201:
 *         description: Template created
 */
router.post('/offboarding-templates', async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ success: false, error: 'Organization ID required' });
    }

    const template = await userOffboardingService.createTemplate(
      organizationId,
      req.body,
      req.user?.userId
    );

    res.status(201).json({ success: true, data: template });
  } catch (error: any) {
    logger.error('Error creating offboarding template', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @openapi
 * /api/v1/lifecycle/offboarding-templates/{id}:
 *   put:
 *     summary: Update offboarding template
 *     tags: [Lifecycle]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Template updated
 *       404:
 *         description: Template not found
 */
router.put('/offboarding-templates/:id', async (req: Request, res: Response) => {
  try {
    const template = await userOffboardingService.updateTemplate(req.params.id, req.body);

    if (!template) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

    res.json({ success: true, data: template });
  } catch (error: any) {
    logger.error('Error updating offboarding template', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @openapi
 * /api/v1/lifecycle/offboarding-templates/{id}:
 *   delete:
 *     summary: Delete offboarding template
 *     tags: [Lifecycle]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Template deleted
 *       404:
 *         description: Template not found
 */
router.delete('/offboarding-templates/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await userOffboardingService.deleteTemplate(req.params.id);

    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

    res.json({ success: true, message: 'Template deleted' });
  } catch (error: any) {
    logger.error('Error deleting offboarding template', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// ONBOARDING ACTIONS
// ==========================================

/**
 * @openapi
 * /api/v1/lifecycle/onboard:
 *   post:
 *     summary: Onboard a new user
 *     description: Onboard a new user immediately or schedule for later.
 *     tags: [Lifecycle]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - firstName
 *               - lastName
 *             properties:
 *               email:
 *                 type: string
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               templateId:
 *                 type: string
 *               scheduledFor:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: User onboarded or scheduled
 *       207:
 *         description: Partial success
 *       400:
 *         description: Missing required fields
 */
router.post('/onboard', async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ success: false, error: 'Organization ID required' });
    }

    const {
      templateId,
      email,
      firstName,
      lastName,
      personalEmail,
      jobTitle,
      managerId,
      departmentId,
      scheduledFor,
      configOverrides,
    } = req.body;

    // Validate required fields
    if (!email || !firstName || !lastName) {
      return res.status(400).json({
        success: false,
        error: 'Email, firstName, and lastName are required',
      });
    }

    // If scheduledFor is provided, schedule the action
    if (scheduledFor) {
      const action = await scheduledActionService.scheduleAction(
        organizationId,
        {
          actionType: 'onboard',
          targetEmail: email,
          targetFirstName: firstName,
          targetLastName: lastName,
          targetPersonalEmail: personalEmail,
          onboardingTemplateId: templateId,
          scheduledFor,
          configOverrides,
        },
        req.user?.userId
      );

      return res.status(201).json({
        success: true,
        data: action,
        message: `Onboarding scheduled for ${scheduledFor}`,
      });
    }

    // Execute immediately
    let result;
    if (templateId) {
      result = await userOnboardingService.executeFromTemplate(
        organizationId,
        templateId,
        {
          email,
          firstName,
          lastName,
          personalEmail,
          jobTitle,
          managerId,
          departmentId,
        },
        {
          triggeredBy: 'user',
          triggeredByUserId: req.user?.userId,
          configOverrides,
        }
      );
    } else {
      result = await userOnboardingService.executeOnboarding(
        organizationId,
        {
          email,
          firstName,
          lastName,
          personalEmail,
          jobTitle,
          managerId,
          departmentId,
          groupIds: [],
          sharedDriveAccess: [],
          calendarSubscriptions: [],
          sendWelcomeEmail: true,
          ...configOverrides,
        },
        {
          triggeredBy: 'user',
          triggeredByUserId: req.user?.userId,
        }
      );
    }

    res.status(result.success ? 201 : 207).json({
      success: result.success,
      data: {
        userId: result.userId,
        googleUserId: result.googleUserId,
        stepsCompleted: result.stepsCompleted,
        stepsFailed: result.stepsFailed,
        stepsSkipped: result.stepsSkipped,
      },
      errors: result.errors.length > 0 ? result.errors : undefined,
    });
  } catch (error: any) {
    logger.error('Error onboarding user', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// OFFBOARDING ACTIONS
// ==========================================

/**
 * @openapi
 * /api/v1/lifecycle/offboard:
 *   post:
 *     summary: Offboard a user
 *     description: Offboard a user immediately or schedule for later.
 *     tags: [Lifecycle]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *               templateId:
 *                 type: string
 *               scheduledFor:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: User offboarded
 *       201:
 *         description: Offboarding scheduled
 *       207:
 *         description: Partial success
 */
router.post('/offboard', async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ success: false, error: 'Organization ID required' });
    }

    const {
      userId,
      templateId,
      scheduledFor,
      lastDay,
      configOverrides,
    } = req.body;

    // Validate required fields
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required',
      });
    }

    // If scheduledFor is provided, schedule the action
    if (scheduledFor) {
      const action = await scheduledActionService.scheduleAction(
        organizationId,
        {
          actionType: 'offboard',
          userId,
          offboardingTemplateId: templateId,
          scheduledFor,
          configOverrides,
        },
        req.user?.userId
      );

      return res.status(201).json({
        success: true,
        data: action,
        message: `Offboarding scheduled for ${scheduledFor}`,
      });
    }

    // Execute immediately
    let result;
    if (templateId) {
      result = await userOffboardingService.executeFromTemplate(
        organizationId,
        templateId,
        userId,
        {
          triggeredBy: 'user',
          triggeredByUserId: req.user?.userId,
          lastDay: lastDay ? new Date(lastDay) : undefined,
          configOverrides,
        }
      );
    } else {
      return res.status(400).json({
        success: false,
        error: 'Template ID is required for offboarding',
      });
    }

    res.status(result.success ? 200 : 207).json({
      success: result.success,
      data: {
        stepsCompleted: result.stepsCompleted,
        stepsFailed: result.stepsFailed,
        stepsSkipped: result.stepsSkipped,
      },
      errors: result.errors.length > 0 ? result.errors : undefined,
    });
  } catch (error: any) {
    logger.error('Error offboarding user', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// SCHEDULED ACTIONS
// ==========================================

/**
 * @openapi
 * /api/v1/lifecycle/scheduled-actions:
 *   get:
 *     summary: List scheduled actions
 *     tags: [Lifecycle]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: actionType
 *         schema:
 *           type: string
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Scheduled actions
 */
router.get('/scheduled-actions', async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ success: false, error: 'Organization ID required' });
    }

    const { status, actionType, userId, fromDate, toDate, limit, offset } = req.query;

    const result = await scheduledActionService.getActions(organizationId, {
      status: status as any,
      actionType: actionType as any,
      userId: userId as string,
      fromDate: fromDate ? new Date(fromDate as string) : undefined,
      toDate: toDate ? new Date(toDate as string) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    });

    res.json({ success: true, data: result.actions, total: result.total });
  } catch (error: any) {
    logger.error('Error listing scheduled actions', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @openapi
 * /api/v1/lifecycle/scheduled-actions/pending-approval:
 *   get:
 *     summary: Get actions pending approval
 *     tags: [Lifecycle]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Actions pending approval
 */
router.get('/scheduled-actions/pending-approval', async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ success: false, error: 'Organization ID required' });
    }

    const actions = await scheduledActionService.getActionsPendingApproval(organizationId);

    res.json({ success: true, data: actions });
  } catch (error: any) {
    logger.error('Error getting actions pending approval', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @openapi
 * /api/v1/lifecycle/scheduled-actions/{id}:
 *   get:
 *     summary: Get scheduled action
 *     tags: [Lifecycle]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Action details
 *       404:
 *         description: Action not found
 */
router.get('/scheduled-actions/:id', async (req: Request, res: Response) => {
  try {
    const action = await scheduledActionService.getAction(req.params.id);

    if (!action) {
      return res.status(404).json({ success: false, error: 'Action not found' });
    }

    res.json({ success: true, data: action });
  } catch (error: any) {
    logger.error('Error getting scheduled action', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @openapi
 * /api/v1/lifecycle/scheduled-actions/{id}:
 *   put:
 *     summary: Update scheduled action
 *     tags: [Lifecycle]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Action updated
 *       404:
 *         description: Action not found
 */
router.put('/scheduled-actions/:id', async (req: Request, res: Response) => {
  try {
    const action = await scheduledActionService.updateAction(req.params.id, req.body);

    if (!action) {
      return res.status(404).json({ success: false, error: 'Action not found' });
    }

    res.json({ success: true, data: action });
  } catch (error: any) {
    logger.error('Error updating scheduled action', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @openapi
 * /api/v1/lifecycle/scheduled-actions/{id}/approve:
 *   post:
 *     summary: Approve scheduled action
 *     tags: [Lifecycle]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Action approved
 *       404:
 *         description: Action not found
 */
router.post('/scheduled-actions/:id/approve', async (req: Request, res: Response) => {
  try {
    const { notes } = req.body;

    const action = await scheduledActionService.approveAction(
      req.params.id,
      req.user?.userId!,
      notes
    );

    if (!action) {
      return res.status(404).json({ success: false, error: 'Action not found' });
    }

    res.json({ success: true, data: action, message: 'Action approved' });
  } catch (error: any) {
    logger.error('Error approving scheduled action', { error: error.message });
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * @openapi
 * /api/v1/lifecycle/scheduled-actions/{id}/reject:
 *   post:
 *     summary: Reject scheduled action
 *     tags: [Lifecycle]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Action rejected
 *       400:
 *         description: Reason required
 *       404:
 *         description: Action not found
 */
router.post('/scheduled-actions/:id/reject', async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ success: false, error: 'Rejection reason is required' });
    }

    const action = await scheduledActionService.rejectAction(
      req.params.id,
      req.user?.userId!,
      reason
    );

    if (!action) {
      return res.status(404).json({ success: false, error: 'Action not found' });
    }

    res.json({ success: true, data: action, message: 'Action rejected' });
  } catch (error: any) {
    logger.error('Error rejecting scheduled action', { error: error.message });
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * @openapi
 * /api/v1/lifecycle/scheduled-actions/{id}:
 *   delete:
 *     summary: Cancel scheduled action
 *     tags: [Lifecycle]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Action cancelled
 *       404:
 *         description: Action not found
 */
router.delete('/scheduled-actions/:id', async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;

    const action = await scheduledActionService.cancelAction(
      req.params.id,
      req.user?.userId!,
      reason
    );

    if (!action) {
      return res.status(404).json({ success: false, error: 'Action not found' });
    }

    res.json({ success: true, data: action, message: 'Action cancelled' });
  } catch (error: any) {
    logger.error('Error cancelling scheduled action', { error: error.message });
    res.status(400).json({ success: false, error: error.message });
  }
});

// ==========================================
// LIFECYCLE LOGS
// ==========================================

/**
 * @openapi
 * /api/v1/lifecycle/logs:
 *   get:
 *     summary: Get lifecycle logs
 *     tags: [Lifecycle]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *       - in: query
 *         name: actionId
 *         schema:
 *           type: string
 *       - in: query
 *         name: actionType
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lifecycle logs
 */
router.get('/logs', async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ success: false, error: 'Organization ID required' });
    }

    const { userId, actionId, actionType, limit, offset } = req.query;

    // If actionId provided, get logs for that action
    if (actionId) {
      const logs = await lifecycleLogService.getLogsForAction(actionId as string);
      return res.json({ success: true, data: logs });
    }

    // If userId provided, get logs for that user
    if (userId) {
      const result = await lifecycleLogService.getLogsForUser(organizationId, userId as string, {
        actionType: actionType as any,
        limit: limit ? parseInt(limit as string, 10) : undefined,
        offset: offset ? parseInt(offset as string, 10) : undefined,
      });
      return res.json({ success: true, data: result.logs, total: result.total });
    }

    // Otherwise, return activity feed
    const result = await lifecycleLogService.getActivityFeed(organizationId, {
      actionType: actionType as any,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    });

    res.json({ success: true, data: result.items, total: result.total });
  } catch (error: any) {
    logger.error('Error getting lifecycle logs', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @openapi
 * /api/v1/lifecycle/logs/errors:
 *   get:
 *     summary: Get recent errors
 *     tags: [Lifecycle]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Recent errors
 */
router.get('/logs/errors', async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ success: false, error: 'Organization ID required' });
    }

    const { limit } = req.query;

    const errors = await lifecycleLogService.getRecentErrors(
      organizationId,
      limit ? parseInt(limit as string, 10) : 10
    );

    res.json({ success: true, data: errors });
  } catch (error: any) {
    logger.error('Error getting lifecycle errors', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @openapi
 * /api/v1/lifecycle/actions/{id}/summary:
 *   get:
 *     summary: Get action summary
 *     tags: [Lifecycle]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Action summary
 *       404:
 *         description: Action not found
 */
router.get('/actions/:id/summary', async (req: Request, res: Response) => {
  try {
    const summary = await lifecycleLogService.getActionSummary(req.params.id);

    if (!summary) {
      return res.status(404).json({ success: false, error: 'Action not found' });
    }

    res.json({ success: true, data: summary });
  } catch (error: any) {
    logger.error('Error getting action summary', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
