import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { helpdeskService } from '../services/helpdesk.service';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/helpdesk/tickets
 * Get all tickets with filters
 */
router.get('/tickets', authenticateToken, async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({
        success: false,
        error: 'Organization not found',
      });
    }

    const filters = {
      status: req.query.status as string,
      assignedTo: req.query.assigned_to as string,
      priority: req.query.priority as string,
      limit: parseInt(req.query.limit as string) || 50,
      offset: parseInt(req.query.offset as string) || 0,
    };

    const tickets = await helpdeskService.getTickets(organizationId, filters);

    res.json({
      success: true,
      data: tickets,
    });
  } catch (error: any) {
    logger.error('Error fetching tickets:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch tickets',
    });
  }
});

/**
 * GET /api/helpdesk/tickets/:id
 * Get single ticket details
 */
router.get('/tickets/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({
        success: false,
        error: 'Organization not found',
      });
    }

    const ticket = await helpdeskService.getTicket(req.params.id, organizationId);

    res.json({
      success: true,
      data: ticket,
    });
  } catch (error: any) {
    logger.error('Error fetching ticket:', error);
    res.status(error.message === 'Ticket not found' ? 404 : 500).json({
      success: false,
      error: error.message || 'Failed to fetch ticket',
    });
  }
});

/**
 * POST /api/helpdesk/tickets
 * Create a new ticket (usually from email webhook)
 */
router.post('/tickets', authenticateToken, async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({
        success: false,
        error: 'Organization not found',
      });
    }

    const {
      googleMessageId,
      googleThreadId,
      groupEmail,
      subject,
      senderEmail,
      senderName,
      priority,
      tags,
    } = req.body;

    if (!googleMessageId || !googleThreadId || !groupEmail || !subject || !senderEmail) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
      });
    }

    const ticket = await helpdeskService.createTicket({
      organizationId,
      googleMessageId,
      googleThreadId,
      groupEmail,
      subject,
      senderEmail,
      senderName,
      priority,
      tags,
    });

    res.status(201).json({
      success: true,
      data: ticket,
    });
  } catch (error: any) {
    logger.error('Error creating ticket:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create ticket',
    });
  }
});

/**
 * POST /api/helpdesk/tickets/:id/assign
 * Assign ticket to an agent
 */
router.post('/tickets/:id/assign', authenticateToken, async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    const userId = req.user?.userId;

    if (!organizationId || !userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const { assignToUserId } = req.body;
    const ticketId = req.params.id;

    const result = await helpdeskService.assignTicket(
      ticketId,
      assignToUserId || userId, // Self-assign if no user specified
      userId,
      organizationId
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error('Error assigning ticket:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to assign ticket',
    });
  }
});

/**
 * DELETE /api/helpdesk/tickets/:id/assign
 * Unassign ticket
 */
router.delete('/tickets/:id/assign', authenticateToken, async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    const userId = req.user?.userId;

    if (!organizationId || !userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const result = await helpdeskService.updateTicketStatus(
      req.params.id,
      'new',
      userId,
      organizationId
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error('Error unassigning ticket:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to unassign ticket',
    });
  }
});

/**
 * PATCH /api/helpdesk/tickets/:id/status
 * Update ticket status
 */
router.patch('/tickets/:id/status', authenticateToken, async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    const userId = req.user?.userId;

    if (!organizationId || !userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const { status } = req.body;
    const validStatuses = ['new', 'in_progress', 'pending', 'resolved', 'reopened'];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status',
      });
    }

    const result = await helpdeskService.updateTicketStatus(
      req.params.id,
      status,
      userId,
      organizationId
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error('Error updating ticket status:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update status',
    });
  }
});

/**
 * GET /api/helpdesk/tickets/:id/notes
 * Get ticket notes
 */
router.get('/tickets/:id/notes', authenticateToken, async (req: Request, res: Response) => {
  try {
    const notes = await helpdeskService.getTicketNotes(req.params.id);

    res.json({
      success: true,
      data: notes,
    });
  } catch (error: any) {
    logger.error('Error fetching notes:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch notes',
    });
  }
});

/**
 * POST /api/helpdesk/tickets/:id/notes
 * Add internal note to ticket
 */
router.post('/tickets/:id/notes', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const { content, mentionedUsers } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'Content is required',
      });
    }

    const note = await helpdeskService.addNote(
      req.params.id,
      userId,
      content,
      mentionedUsers || []
    );

    res.status(201).json({
      success: true,
      data: note,
    });
  } catch (error: any) {
    logger.error('Error adding note:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to add note',
    });
  }
});

/**
 * GET /api/helpdesk/tickets/:id/presence
 * Get current presence for a ticket
 */
router.get('/tickets/:id/presence', authenticateToken, async (req: Request, res: Response) => {
  try {
    const presence = await helpdeskService.getTicketPresence(req.params.id);

    res.json({
      success: true,
      data: presence,
    });
  } catch (error: any) {
    logger.error('Error fetching presence:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch presence',
    });
  }
});

/**
 * GET /api/helpdesk/analytics
 * Get helpdesk analytics
 */
router.get('/analytics', authenticateToken, async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({
        success: false,
        error: 'Organization not found',
      });
    }

    const startDate = req.query.start_date
      ? new Date(req.query.start_date as string)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Last 30 days

    const endDate = req.query.end_date
      ? new Date(req.query.end_date as string)
      : new Date();

    const analytics = await helpdeskService.getAnalytics(organizationId, {
      start: startDate,
      end: endDate,
    });

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error: any) {
    logger.error('Error fetching analytics:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch analytics',
    });
  }
});

/**
 * GET /api/helpdesk/stats
 * Get quick stats for dashboard
 */
router.get('/stats', authenticateToken, async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    const userId = req.user?.userId;

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        error: 'Organization not found',
      });
    }

    // Get counts for different statuses
    const [allTickets, myTickets] = await Promise.all([
      helpdeskService.getTickets(organizationId, { limit: 1 }),
      helpdeskService.getTickets(organizationId, { assignedTo: userId, limit: 1 }),
    ]);

    const stats = {
      total: allTickets.length,
      myTickets: myTickets.length,
      newTickets: allTickets.filter((t: any) => t.status === 'new').length,
      inProgress: allTickets.filter((t: any) => t.status === 'in_progress').length,
      resolved: allTickets.filter((t: any) => t.status === 'resolved').length,
    };

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    logger.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch stats',
    });
  }
});

export default router;