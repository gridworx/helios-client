import express from 'express';
import { workflowService } from '../services/workflow.service.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Workflows
 *   description: Workflow management endpoints
 */

/**
 * @swagger
 * /api/v1/workflows:
 *   get:
 *     summary: List all workflows
 *     tags: [Workflows]
 *     responses:
 *       200:
 *         description: List of workflows
 */
router.get('/', async (req, res) => {
    try {
        const organizationId = req.user?.organizationId;

        if (!organizationId) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized'
            });
        }

        const workflows = await workflowService.listWorkflows(organizationId);

        res.json({
            success: true,
            data: workflows
        });
    } catch (error: any) {
        logger.error('List workflows failed', error);
        res.status(500).json({
            success: false,
            error: 'Failed to list workflows'
        });
    }
});

/**
 * @swagger
 * /api/v1/workflows/{id}:
 *   get:
 *     summary: Get a workflow by IDs
 *     tags: [Workflows]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Workflow details
 *       404:
 *         description: Workflow not found
 */
router.get('/:id', async (req, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const { id } = req.params;

        if (!organizationId) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized'
            });
        }

        const workflow = await workflowService.getWorkflow(organizationId, id);

        if (!workflow) {
            return res.status(404).json({
                success: false,
                error: 'Workflow not found'
            });
        }

        res.json({
            success: true,
            data: workflow
        });
    } catch (error: any) {
        logger.error('Get workflow failed', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get workflow'
        });
    }
});

/**
 * @swagger
 * /api/v1/workflows:
 *   post:
 *     summary: Create a new workflow
 *     tags: [Workflows]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, definition]
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               definition:
 *                 type: object
 *               trigger_type:
 *                 type: string
 *               is_active:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Workflow created
 */
router.post('/', async (req, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const { name, description, definition, trigger_type, is_active } = req.body;

        if (!organizationId) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized'
            });
        }

        if (!name || !definition) {
            return res.status(400).json({
                success: false,
                error: 'Name and definition are required'
            });
        }

        const workflow = await workflowService.createWorkflow(organizationId, {
            name,
            description,
            definition,
            trigger_type,
            is_active
        });

        res.status(201).json({
            success: true,
            data: workflow
        });
    } catch (error: any) {
        logger.error('Create workflow failed', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create workflow'
        });
    }
});

/**
 * @swagger
 * /api/v1/workflows/{id}:
 *   put:
 *     summary: Update a workflow
 *     tags: [Workflows]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               definition:
 *                 type: object
 *               trigger_type:
 *                 type: string
 *               is_active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Workflow updated
 */
router.put('/:id', async (req, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const { id } = req.params;
        const data = req.body;

        if (!organizationId) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized'
            });
        }

        const workflow = await workflowService.updateWorkflow(organizationId, id, data);

        if (!workflow) {
            return res.status(404).json({
                success: false,
                error: 'Workflow not found'
            });
        }

        res.json({
            success: true,
            data: workflow
        });
    } catch (error: any) {
        logger.error('Update workflow failed', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update workflow'
        });
    }
});

/**
 * @swagger
 * /api/v1/workflows/{id}:
 *   delete:
 *     summary: Delete a workflow
 *     tags: [Workflows]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Workflow deleted
 */
router.delete('/:id', async (req, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const { id } = req.params;

        if (!organizationId) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized'
            });
        }

        const success = await workflowService.deleteWorkflow(organizationId, id);

        if (!success) {
            return res.status(404).json({
                success: false,
                error: 'Workflow not found'
            });
        }

        res.json({
            success: true,
            message: 'Workflow deleted'
        });
    } catch (error: any) {
        logger.error('Delete workflow failed', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete workflow'
        });
    }
});

export default router;
