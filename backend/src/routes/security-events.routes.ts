import { Router, Request, Response } from 'express';
import { db } from '../database/connection.js';
import { logger } from '../utils/logger.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @openapi
 * /api/v1/organization/security-events:
 *   get:
 *     summary: List security events
 *     description: Get security events for the organization with optional filtering.
 *     tags: [Security Events]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *           enum: [low, medium, high, critical]
 *         description: Filter by severity level
 *       - in: query
 *         name: acknowledged
 *         schema:
 *           type: boolean
 *         description: Filter by acknowledgment status
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Security events list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       eventType:
 *                         type: string
 *                       severity:
 *                         type: string
 *                       title:
 *                         type: string
 *                       acknowledged:
 *                         type: boolean
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                 unacknowledgedCount:
 *                   type: integer
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    const { severity, acknowledged, limit = 100, offset = 0 } = req.query;

    let query = `
      SELECT
        se.id,
        se.event_type,
        se.severity,
        se.user_id,
        u.email as user_email,
        se.event_type as title,
        se.description,
        se.metadata as details,
        se.source,
        se.is_resolved as acknowledged,
        se.resolved_by as acknowledged_by,
        se.resolved_at as acknowledged_at,
        se.created_at
      FROM security_events se
      LEFT JOIN organization_users u ON u.id = se.user_id
      WHERE se.organization_id = $1
    `;

    const params: any[] = [organizationId];

    if (severity) {
      params.push(severity);
      query += ` AND se.severity = $${params.length}`;
    }

    if (acknowledged === 'true') {
      query += ` AND se.is_resolved = true`;
    } else if (acknowledged === 'false') {
      query += ` AND se.is_resolved = false`;
    }

    query += ` ORDER BY se.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    // Get unacknowledged count
    const countResult = await db.query(
      'SELECT COUNT(*) as count FROM security_events WHERE organization_id = $1 AND is_resolved = false',
      [organizationId]
    );

    res.json({
      success: true,
      data: result.rows,
      unacknowledgedCount: parseInt(countResult.rows[0].count)
    });
  } catch (error: any) {
    logger.error('Failed to fetch security events', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch security events' });
  }
});

/**
 * @openapi
 * /api/v1/organization/security-events/{id}/acknowledge:
 *   patch:
 *     summary: Acknowledge security event
 *     description: Mark a security event as acknowledged with optional note.
 *     tags: [Security Events]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               note:
 *                 type: string
 *                 description: Optional note about acknowledgment
 *     responses:
 *       200:
 *         description: Event acknowledged
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.patch('/:id/acknowledge', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { note } = req.body;
    const organizationId = req.user?.organizationId;

    await db.query(`
      UPDATE security_events
      SET
        is_resolved = true,
        resolved_by = $1,
        resolved_at = NOW(),
        resolution_notes = $2
      WHERE id = $3 AND organization_id = $4
    `, [req.user?.userId, note, id, organizationId]);

    res.json({ success: true, message: 'Security event acknowledged' });
  } catch (error: any) {
    logger.error('Failed to acknowledge security event', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to acknowledge event' });
  }
});

export default router;
