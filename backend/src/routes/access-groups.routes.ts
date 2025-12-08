import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { authenticateToken } from '../middleware/auth';
import { db } from '../database/connection';
import { googleWorkspaceService } from '../services/google-workspace.service';
import { activityTracker } from '../services/activity-tracker.service';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/organization/access-groups
 * List all access groups for the organization
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      res.status(400).json({
        success: false,
        error: 'Organization ID not found',
      });
      return;
    }

    const result = await db.query(
      `SELECT
        ag.id,
        ag.name,
        ag.description,
        ag.email,
        ag.platform,
        ag.group_type,
        ag.external_id,
        ag.external_url,
        ag.is_active,
        ag.created_at,
        ag.synced_at,
        ag.metadata,
        COUNT(DISTINCT agm.user_id) as member_count
      FROM access_groups ag
      LEFT JOIN access_group_members agm ON ag.id = agm.access_group_id
      WHERE ag.organization_id = $1 AND ag.is_active = true
      GROUP BY ag.id
      ORDER BY ag.name ASC`,
      [organizationId]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error: any) {
    logger.error('Failed to list access groups', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to list access groups',
      message: error.message,
    });
  }
});

/**
 * GET /api/organization/access-groups/:id
 * Get access group details including members
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const organizationId = req.user?.organizationId;

    // Get group
    const groupResult = await db.query(
      `SELECT * FROM access_groups WHERE id = $1 AND organization_id = $2`,
      [id, organizationId]
    );

    if (groupResult.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: 'Access group not found',
      });
      return;
    }

    // Get members
    const membersResult = await db.query(
      `SELECT
        agm.id,
        agm.member_type,
        agm.is_active,
        agm.joined_at,
        ou.id as user_id,
        ou.email,
        ou.first_name,
        ou.last_name
      FROM access_group_members agm
      JOIN organization_users ou ON ou.id = agm.user_id
      WHERE agm.access_group_id = $1 AND agm.is_active = true
      ORDER BY ou.first_name, ou.last_name`,
      [id]
    );

    res.json({
      success: true,
      data: {
        group: groupResult.rows[0],
        members: membersResult.rows,
      },
    });
  } catch (error: any) {
    logger.error('Failed to get access group', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get access group',
      message: error.message,
    });
  }
});

/**
 * PUT /api/organization/access-groups/:id
 * Update an access group
 */
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const organizationId = req.user?.organizationId;
    const userId = req.user?.userId;
    const { name, description, email } = req.body;

    // Verify group exists and belongs to org
    const existing = await db.query(
      'SELECT * FROM access_groups WHERE id = $1 AND organization_id = $2',
      [id, organizationId]
    );

    if (existing.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: 'Access group not found',
      });
      return;
    }

    const oldGroup = existing.rows[0];

    // Update the group
    const result = await db.query(
      `UPDATE access_groups SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        email = COALESCE($3, email),
        updated_at = NOW()
      WHERE id = $4 AND organization_id = $5
      RETURNING *`,
      [name, description, email, id, organizationId]
    );

    // Track the activity
    const changes: any = {};
    if (name && name !== oldGroup.name) changes.name = { from: oldGroup.name, to: name };
    if (description !== undefined && description !== oldGroup.description) {
      changes.description = { from: oldGroup.description, to: description };
    }
    if (email !== undefined && email !== oldGroup.email) {
      changes.email = { from: oldGroup.email, to: email };
    }

    if (Object.keys(changes).length > 0) {
      await activityTracker.trackGroupChange(
        organizationId,
        id,
        userId!,
        req.user?.email!,
        'updated',
        {
          groupName: result.rows[0].name,
          changes
        }
      );
    }

    logger.info('Access group updated', {
      groupId: id,
      organizationId,
      changes
    });

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Access group updated successfully',
    });
  } catch (error: any) {
    logger.error('Failed to update access group', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to update access group',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/organization/access-groups/:id
 * Delete an access group
 */
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const organizationId = req.user?.organizationId;
    const userId = req.user?.userId;

    // Verify group exists and belongs to org
    const existing = await db.query(
      'SELECT * FROM access_groups WHERE id = $1 AND organization_id = $2',
      [id, organizationId]
    );

    if (existing.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: 'Access group not found',
      });
      return;
    }

    const group = existing.rows[0];

    // Soft delete by setting is_active = false
    await db.query(
      `UPDATE access_groups SET is_active = false, updated_at = NOW()
       WHERE id = $1 AND organization_id = $2`,
      [id, organizationId]
    );

    // Track the activity
    await activityTracker.trackGroupChange(
      organizationId,
      id,
      userId!,
      req.user?.email!,
      'deleted',
      {
        groupName: group.name
      }
    );

    logger.info('Access group deleted', {
      groupId: id,
      groupName: group.name,
      organizationId
    });

    res.json({
      success: true,
      message: 'Access group deleted successfully',
    });
  } catch (error: any) {
    logger.error('Failed to delete access group', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to delete access group',
      message: error.message,
    });
  }
});

/**
 * POST /api/organization/access-groups
 * Create a new access group (manual, not synced from platform)
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId;
    const userId = req.user?.userId;
    const { name, description, email } = req.body;

    if (!name) {
      res.status(400).json({
        success: false,
        error: 'Group name is required',
      });
      return;
    }

    const result = await db.query(
      `INSERT INTO access_groups (
        organization_id,
        name,
        description,
        email,
        platform,
        group_type,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [organizationId, name, description, email, 'manual', 'manual', userId]
    );

    // Track the activity
    await activityTracker.trackGroupChange(
      organizationId,
      result.rows[0].id,
      userId!,
      req.user?.email!,
      'created',
      {
        groupName: name,
        description: description || null,
        email: email || null
      }
    );

    logger.info('Access group created', {
      groupId: result.rows[0].id,
      name,
      organizationId,
    });

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Access group created successfully',
    });
  } catch (error: any) {
    logger.error('Failed to create access group', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to create access group',
      message: error.message,
    });
  }
});

/**
 * POST /api/organization/access-groups/:id/members
 * Add a member to an access group
 */
router.post('/:id/members', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const organizationId = req.user?.organizationId;
    const { userId, memberType } = req.body;

    // Verify group exists and belongs to org
    const groupCheck = await db.query(
      'SELECT id FROM access_groups WHERE id = $1 AND organization_id = $2',
      [id, organizationId]
    );

    if (groupCheck.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: 'Access group not found',
      });
      return;
    }

    // Add member
    await db.query(
      `INSERT INTO access_group_members (access_group_id, user_id, member_type)
       VALUES ($1, $2, $3)
       ON CONFLICT (access_group_id, user_id) DO UPDATE SET member_type = $3, is_active = true`,
      [id, userId, memberType || 'member']
    );

    // Sync to Google Workspace if this is a Google group
    const groupResult = await db.query(
      'SELECT name, external_id, platform FROM access_groups WHERE id = $1',
      [id]
    );

    const userResult = await db.query(
      'SELECT email, first_name, last_name FROM organization_users WHERE id = $1',
      [userId]
    );

    // Track the activity
    const actorId = req.user?.userId!;
    const actorEmail = req.user?.email!;

    if (userResult.rows[0] && groupResult.rows[0]) {
      await activityTracker.trackGroupChange(
        organizationId,
        id,
        actorId,
        actorEmail,
        'member_added',
        {
          memberEmail: userResult.rows[0].email,
          memberName: `${userResult.rows[0].first_name} ${userResult.rows[0].last_name}`,
          groupName: groupResult.rows[0].name
        }
      );
    }

    if (groupResult.rows[0]?.platform === 'google_workspace' &&
        groupResult.rows[0]?.external_id &&
        userResult.rows[0]?.email) {

      const syncResult = await googleWorkspaceService.addUserToGroup(
        organizationId,
        userResult.rows[0].email,
        groupResult.rows[0].external_id
      );

      if (!syncResult.success) {
        logger.warn('Failed to sync group membership to Google Workspace', {
          userId,
          groupId: id,
          error: syncResult.error
        });
      } else {
        logger.info('Group membership synced to Google Workspace', {
          userId,
          groupId: id
        });
      }
    }

    res.json({
      success: true,
      message: 'Member added to access group',
    });
  } catch (error: any) {
    logger.error('Failed to add access group member', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to add member',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/organization/access-groups/:id/members/:userId
 * Remove a member from an access group
 */
router.delete('/:id/members/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, userId } = req.params;
    const organizationId = req.user?.organizationId;

    // Verify group exists and belongs to org
    const groupCheck = await db.query(
      'SELECT id FROM access_groups WHERE id = $1 AND organization_id = $2',
      [id, organizationId]
    );

    if (groupCheck.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: 'Access group not found',
      });
      return;
    }

    // Remove member (soft delete by setting is_active = false)
    await db.query(
      `UPDATE access_group_members
       SET is_active = false, updated_at = CURRENT_TIMESTAMP
       WHERE access_group_id = $1 AND user_id = $2`,
      [id, userId]
    );

    // Get group and user info for activity tracking and sync
    const groupResult = await db.query(
      'SELECT name, external_id, platform FROM access_groups WHERE id = $1',
      [id]
    );

    const userResult = await db.query(
      'SELECT email, first_name, last_name FROM organization_users WHERE id = $1',
      [userId]
    );

    // Track the activity
    if (userResult.rows[0] && groupResult.rows[0]) {
      await activityTracker.trackGroupChange(
        organizationId!,
        id,
        req.user?.userId!,
        req.user?.email!,
        'member_removed',
        {
          memberEmail: userResult.rows[0].email,
          memberName: `${userResult.rows[0].first_name} ${userResult.rows[0].last_name}`,
          groupName: groupResult.rows[0].name
        }
      );
    }

    if (groupResult.rows[0]?.platform === 'google_workspace' &&
        groupResult.rows[0]?.external_id &&
        userResult.rows[0]?.email) {

      const syncResult = await googleWorkspaceService.removeUserFromGroup(
        organizationId,
        userResult.rows[0].email,
        groupResult.rows[0].external_id
      );

      if (!syncResult.success) {
        logger.warn('Failed to sync group removal to Google Workspace', {
          userId,
          groupId: id,
          error: syncResult.error
        });
      } else {
        logger.info('Group removal synced to Google Workspace', {
          userId,
          groupId: id
        });
      }
    }

    res.json({
      success: true,
      message: 'Member removed from access group',
    });
  } catch (error: any) {
    logger.error('Failed to remove access group member', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to remove member',
      message: error.message,
    });
  }
});

export default router;
