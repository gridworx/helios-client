import { Router, Request, Response } from 'express';
import { db } from '../database/connection';
import { logger } from '../utils/logger';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

/**
 * @openapi
 * /api/v1/organization/audit-logs:
 *   get:
 *     summary: List audit logs
 *     description: Get audit logs for the organization with filtering options.
 *     tags: [Audit Logs]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *         description: Filter by action type
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by user ID
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter logs after this date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter logs before this date
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in description and metadata
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *         description: Maximum number of results
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of results to skip
 *     responses:
 *       200:
 *         description: Audit logs
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
 *                       action:
 *                         type: string
 *                       resourceType:
 *                         type: string
 *                       description:
 *                         type: string
 *                       actorEmail:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
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
 * @openapi
 * /api/v1/organization/audit-logs/export:
 *   get:
 *     summary: Export audit logs
 *     description: Export audit logs to CSV format.
 *     tags: [Audit Logs]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *         description: Filter by action type
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by user ID
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter logs after this date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter logs before this date
 *     responses:
 *       200:
 *         description: CSV file
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
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

/**
 * @openapi
 * /api/v1/organization/audit-logs/console:
 *   post:
 *     summary: Log a console command
 *     description: Record a Developer Console command execution to the audit log.
 *     tags: [Audit Logs]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - command
 *             properties:
 *               command:
 *                 type: string
 *                 description: The command that was executed
 *                 example: "helios gw users list"
 *               durationMs:
 *                 type: integer
 *                 description: Execution duration in milliseconds
 *                 example: 250
 *               resultStatus:
 *                 type: string
 *                 enum: [success, error]
 *                 description: Whether the command succeeded or failed
 *                 example: "success"
 *               resultCount:
 *                 type: integer
 *                 description: Number of results returned (if applicable)
 *                 example: 42
 *               errorMessage:
 *                 type: string
 *                 description: Error message if the command failed
 *     responses:
 *       201:
 *         description: Audit log entry created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *       400:
 *         description: Invalid request body
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/console', async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    const userId = req.user?.userId;
    const { command, durationMs, resultStatus, resultCount, errorMessage } = req.body;

    if (!command || typeof command !== 'string') {
      return res.status(400).json({ success: false, error: 'Command is required' });
    }

    // Truncate command for description (max 500 chars)
    const description = command.length > 500 ? command.substring(0, 497) + '...' : command;

    // Build metadata object
    const metadata: Record<string, any> = {
      command,
      duration_ms: durationMs,
      result_status: resultStatus || 'success',
    };

    if (resultCount !== undefined) {
      metadata.result_count = resultCount;
    }

    if (errorMessage) {
      metadata.error_message = errorMessage;
    }

    // Get IP and user agent from request
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = await db.query(
      `INSERT INTO activity_logs (
        id, organization_id, user_id, actor_id, action, resource_type,
        description, metadata, ip_address, user_agent, actor_type, result, created_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW()
      ) RETURNING id`,
      [
        organizationId,
        userId,
        'console_command_executed',
        'developer_console',
        description,
        JSON.stringify(metadata),
        ipAddress,
        userAgent,
        'internal',
        resultStatus || 'success'
      ]
    );

    logger.info('Console command logged', {
      userId,
      command: description,
      durationMs,
      resultStatus
    });

    res.status(201).json({
      success: true,
      data: { id: result.rows[0].id }
    });
  } catch (error: any) {
    logger.error('Failed to log console command', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to log console command' });
  }
});

export default router;
