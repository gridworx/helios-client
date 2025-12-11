import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { db } from '../database/connection';
import { logger } from '../utils/logger';
import { authenticateToken } from '../middleware/auth';

const router = Router();

/**
 * @openapi
 * /departments:
 *   get:
 *     summary: List all departments
 *     description: Get all departments for the organization including user counts.
 *     tags: [Departments]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of departments
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Department'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        error: 'Organization ID not found'
      });
    }

    const result = await db.query(`
      SELECT
        d.id,
        d.name,
        d.description,
        d.parent_department_id as "parentDepartmentId",
        d.org_unit_id as "orgUnitId",
        d.org_unit_path as "orgUnitPath",
        d.auto_sync_to_ou as "autoSyncToOu",
        d.is_active as "isActive",
        d.created_at as "createdAt",
        d.updated_at as "updatedAt",
        parent.name as "parentDepartmentName",
        (SELECT COUNT(*) FROM organization_users WHERE department_id = d.id) as "userCount"
      FROM departments d
      LEFT JOIN departments parent ON d.parent_department_id = parent.id
      WHERE d.organization_id = $1
      ORDER BY d.name
    `, [organizationId]);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error: any) {
    logger.error('Failed to fetch departments', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch departments'
    });
  }
});

/**
 * @openapi
 * /departments/{id}:
 *   get:
 *     summary: Get a department
 *     description: Get details of a specific department including user count.
 *     tags: [Departments]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Department ID
 *     responses:
 *       200:
 *         description: Department details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Department'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const organizationId = req.user?.organizationId;

    const result = await db.query(`
      SELECT
        d.id,
        d.name,
        d.description,
        d.parent_department_id as "parentDepartmentId",
        d.org_unit_id as "orgUnitId",
        d.org_unit_path as "orgUnitPath",
        d.auto_sync_to_ou as "autoSyncToOu",
        d.is_active as "isActive",
        d.created_at as "createdAt",
        d.updated_at as "updatedAt",
        parent.name as "parentDepartmentName",
        (SELECT COUNT(*) FROM organization_users WHERE department_id = d.id) as "userCount"
      FROM departments d
      LEFT JOIN departments parent ON d.parent_department_id = parent.id
      WHERE d.id = $1 AND d.organization_id = $2
    `, [id, organizationId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Department not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error: any) {
    logger.error('Failed to fetch department', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch department'
    });
  }
});

/**
 * @openapi
 * /departments:
 *   post:
 *     summary: Create a department
 *     description: Create a new department in the organization.
 *     tags: [Departments]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 description: Department name
 *                 example: Engineering
 *               description:
 *                 type: string
 *               parentDepartmentId:
 *                 type: string
 *                 format: uuid
 *                 description: Parent department for hierarchy
 *               orgUnitId:
 *                 type: string
 *                 description: Google Workspace Org Unit ID
 *               orgUnitPath:
 *                 type: string
 *                 description: Google Workspace Org Unit Path
 *               autoSyncToOu:
 *                 type: boolean
 *                 description: Auto-sync users to Google OU
 *     responses:
 *       201:
 *         description: Department created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Department'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       409:
 *         description: Department name already exists
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.post('/',
  authenticateToken,
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('description').optional().trim(),
    body('parentDepartmentId').optional().isUUID(),
    body('orgUnitId').optional().trim(),
    body('orgUnitPath').optional().trim(),
    body('autoSyncToOu').optional().isBoolean(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    try {
      const organizationId = req.user?.organizationId;
      const userId = req.user?.userId;
      const {
        name,
        description,
        parentDepartmentId,
        orgUnitId,
        orgUnitPath,
        autoSyncToOu
      } = req.body;

      // Check if department name already exists
      const existing = await db.query(
        'SELECT id FROM departments WHERE organization_id = $1 AND LOWER(name) = LOWER($2)',
        [organizationId, name]
      );

      if (existing.rows.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'Department with this name already exists'
        });
      }

      const result = await db.query(`
        INSERT INTO departments (
          organization_id,
          name,
          description,
          parent_department_id,
          org_unit_id,
          org_unit_path,
          auto_sync_to_ou,
          created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING
          id,
          name,
          description,
          parent_department_id as "parentDepartmentId",
          org_unit_id as "orgUnitId",
          org_unit_path as "orgUnitPath",
          auto_sync_to_ou as "autoSyncToOu",
          is_active as "isActive",
          created_at as "createdAt"
      `, [
        organizationId,
        name,
        description || null,
        parentDepartmentId || null,
        orgUnitId || null,
        orgUnitPath || null,
        autoSyncToOu || false,
        userId
      ]);

      logger.info('Department created', {
        departmentId: result.rows[0].id,
        name,
        createdBy: userId
      });

      res.status(201).json({
        success: true,
        message: 'Department created successfully',
        data: result.rows[0]
      });
    } catch (error: any) {
      logger.error('Failed to create department', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to create department'
      });
    }
  }
);

/**
 * @openapi
 * /departments/{id}:
 *   put:
 *     summary: Update a department
 *     description: Update an existing department.
 *     tags: [Departments]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Department ID
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
 *               parentDepartmentId:
 *                 type: string
 *                 format: uuid
 *               orgUnitId:
 *                 type: string
 *               orgUnitPath:
 *                 type: string
 *               autoSyncToOu:
 *                 type: boolean
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Department updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Department'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.put('/:id',
  authenticateToken,
  [
    body('name').optional().trim().notEmpty(),
    body('description').optional().trim(),
    body('parentDepartmentId').optional().isUUID(),
    body('orgUnitId').optional().trim(),
    body('orgUnitPath').optional().trim(),
    body('autoSyncToOu').optional().isBoolean(),
    body('isActive').optional().isBoolean(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    try {
      const { id } = req.params;
      const organizationId = req.user?.organizationId;
      const {
        name,
        description,
        parentDepartmentId,
        orgUnitId,
        orgUnitPath,
        autoSyncToOu,
        isActive
      } = req.body;

      // Check if department exists
      const existing = await db.query(
        'SELECT id FROM departments WHERE id = $1 AND organization_id = $2',
        [id, organizationId]
      );

      if (existing.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Department not found'
        });
      }

      const result = await db.query(`
        UPDATE departments SET
          name = COALESCE($1, name),
          description = COALESCE($2, description),
          parent_department_id = COALESCE($3, parent_department_id),
          org_unit_id = COALESCE($4, org_unit_id),
          org_unit_path = COALESCE($5, org_unit_path),
          auto_sync_to_ou = COALESCE($6, auto_sync_to_ou),
          is_active = COALESCE($7, is_active),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $8 AND organization_id = $9
        RETURNING
          id,
          name,
          description,
          parent_department_id as "parentDepartmentId",
          org_unit_id as "orgUnitId",
          org_unit_path as "orgUnitPath",
          auto_sync_to_ou as "autoSyncToOu",
          is_active as "isActive",
          updated_at as "updatedAt"
      `, [
        name,
        description,
        parentDepartmentId,
        orgUnitId,
        orgUnitPath,
        autoSyncToOu,
        isActive,
        id,
        organizationId
      ]);

      logger.info('Department updated', {
        departmentId: id,
        updatedBy: req.user?.userId
      });

      res.json({
        success: true,
        message: 'Department updated successfully',
        data: result.rows[0]
      });
    } catch (error: any) {
      logger.error('Failed to update department', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to update department'
      });
    }
  }
);

/**
 * @openapi
 * /departments/{id}:
 *   delete:
 *     summary: Delete a department
 *     description: |
 *       Delete a department. Only allowed if no users are assigned to it.
 *       Users must be reassigned before deleting.
 *     tags: [Departments]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Department ID
 *     responses:
 *       200:
 *         description: Department deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *       400:
 *         description: Cannot delete - users still assigned
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const organizationId = req.user?.organizationId;

    // Check if department exists
    const deptResult = await db.query(
      'SELECT id, name FROM departments WHERE id = $1 AND organization_id = $2',
      [id, organizationId]
    );

    if (deptResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Department not found'
      });
    }

    // Check if any users are assigned
    const userCount = await db.query(
      'SELECT COUNT(*) as count FROM organization_users WHERE department_id = $1',
      [id]
    );

    if (parseInt(userCount.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete department with assigned users. Please reassign users first.'
      });
    }

    await db.query(
      'DELETE FROM departments WHERE id = $1 AND organization_id = $2',
      [id, organizationId]
    );

    logger.info('Department deleted', {
      departmentId: id,
      departmentName: deptResult.rows[0].name,
      deletedBy: req.user?.userId
    });

    res.json({
      success: true,
      message: 'Department deleted successfully'
    });
  } catch (error: any) {
    logger.error('Failed to delete department', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to delete department'
    });
  }
});

export default router;
