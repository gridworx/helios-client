import { Router, Request, Response } from 'express';
import { db } from '../database/connection';
import { logger } from '../utils/logger';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/organization/security-events
 * List security events with filtering
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    const { severity, acknowledged, limit = 100, offset = 0 } = req.query;

    let query = `
      SELECT
        id,
        event_type,
        severity,
        user_id,
        user_email,
        title,
        description,
        details,
        source,
        acknowledged,
        acknowledged_by,
        acknowledged_at,
        created_at
      FROM security_events
      WHERE organization_id = $1
    `;

    const params: any[] = [organizationId];

    if (severity) {
      params.push(severity);
      query += ` AND severity = $${params.length}`;
    }

    if (acknowledged === 'true') {
      query += ` AND acknowledged = true`;
    } else if (acknowledged === 'false') {
      query += ` AND acknowledged = false`;
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    // Get unacknowledged count
    const countResult = await db.query(
      'SELECT COUNT(*) as count FROM security_events WHERE organization_id = $1 AND acknowledged = false',
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
 * PATCH /api/organization/security-events/:id/acknowledge
 * Acknowledge a security event
 */
router.patch('/:id/acknowledge', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { note } = req.body;
    const organizationId = req.user?.organizationId;

    await db.query(`
      UPDATE security_events
      SET
        acknowledged = true,
        acknowledged_by = $1,
        acknowledged_at = NOW(),
        acknowledged_note = $2
      WHERE id = $3 AND organization_id = $4
    `, [req.user?.userId, note, id, organizationId]);

    res.json({ success: true, message: 'Security event acknowledged' });
  } catch (error: any) {
    logger.error('Failed to acknowledge security event', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to acknowledge event' });
  }
});

export default router;
