import { Router, Request, Response } from 'express';
import { db } from '../database/connection';
import { logger } from '../utils/logger';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

/**
 * GET /api/organization/audit-logs
 * List audit logs with filtering
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    const { action, userId, startDate, endDate, limit = 100, offset = 0, search } = req.query;

    let query = `
      SELECT
        al.id,
        al.organization_id,
        al.user_id,
        al.actor_id,
        al.action,
        al.resource_type,
        al.resource_id,
        al.description,
        al.metadata,
        al.ip_address,
        al.user_agent,
        al.created_at,
        u.email as actor_email,
        u.first_name as actor_first_name,
        u.last_name as actor_last_name
      FROM activity_logs al
      LEFT JOIN organization_users u ON al.actor_id = u.id
      WHERE al.organization_id = $1
    `;

    const params: any[] = [organizationId];

    if (action) {
      params.push(action);
      query += ` AND al.action LIKE $${params.length}`;
    }

    if (userId) {
      params.push(userId);
      query += ` AND al.user_id = $${params.length}`;
    }

    if (startDate) {
      params.push(startDate);
      query += ` AND al.created_at >= $${params.length}`;
    }

    if (endDate) {
      params.push(endDate);
      query += ` AND al.created_at <= $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (al.description ILIKE $${params.length} OR al.metadata::text ILIKE $${params.length})`;
    }

    query += ` ORDER BY al.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error: any) {
    logger.error('Failed to fetch audit logs', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch audit logs' });
  }
});

/**
 * GET /api/organization/audit-logs/export
 * Export audit logs to CSV
 */
router.get('/export', async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    const { action, userId, startDate, endDate } = req.query;

    let query = `
      SELECT
        al.created_at,
        u.email as actor_email,
        al.action,
        al.resource_type,
        al.resource_id,
        al.description,
        al.ip_address
      FROM activity_logs al
      LEFT JOIN organization_users u ON al.actor_id = u.id
      WHERE al.organization_id = $1
    `;

    const params: any[] = [organizationId];

    if (action) {
      params.push(action);
      query += ` AND al.action LIKE $${params.length}`;
    }

    if (userId) {
      params.push(userId);
      query += ` AND al.user_id = $${params.length}`;
    }

    if (startDate) {
      params.push(startDate);
      query += ` AND al.created_at >= $${params.length}`;
    }

    if (endDate) {
      params.push(endDate);
      query += ` AND al.created_at <= $${params.length}`;
    }

    query += ` ORDER BY al.created_at DESC`;

    const result = await db.query(query, params);

    // Generate CSV
    const headers = ['Timestamp', 'Actor', 'Action', 'Resource Type', 'Resource ID', 'Description', 'IP Address'];
    const csv = [
      headers.join(','),
      ...result.rows.map((row: any) => [
        new Date(row.created_at).toISOString(),
        row.actor_email || 'System',
        row.action,
        row.resource_type || '',
        row.resource_id || '',
        `"${(row.description || '').replace(/"/g, '""')}"`,
        row.ip_address || ''
      ].join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (error: any) {
    logger.error('Failed to export audit logs', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to export audit logs' });
  }
});

export default router;
