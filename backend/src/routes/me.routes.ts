import express from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth';
import { db } from '../database/connection';
import { logger } from '../utils/logger';
import { mediaUploadService, MediaType } from '../services/media-upload.service';

const router = express.Router();

// Configure multer for memory storage (files kept in memory as Buffer)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max (video)
  },
});

// =====================================================
// PROFILE ENDPOINTS
// =====================================================

/**
 * GET /api/me/profile - Get current user's full profile for editing
 */
router.get('/profile', requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Get user profile with all editable fields
    const userResult = await db.query(
      `SELECT
        id, email, first_name, last_name, job_title, department,
        bio, pronouns, current_status, avatar_url, photo_data,
        mobile_phone, work_phone, timezone, preferred_language,
        location, organizational_unit, employee_type, start_date,
        profile_completeness, profile_updated_at, created_at
       FROM organization_users
       WHERE id = $1 AND is_active = true`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Get fun facts
    const funFactsResult = await db.query(
      `SELECT id, emoji, content, display_order
       FROM user_fun_facts
       WHERE user_id = $1
       ORDER BY display_order ASC`,
      [userId]
    );

    // Get interests
    const interestsResult = await db.query(
      `SELECT id, interest, category
       FROM user_interests
       WHERE user_id = $1
       ORDER BY interest ASC`,
      [userId]
    );

    // Get expertise topics
    const expertiseResult = await db.query(
      `SELECT id, topic, skill_level
       FROM user_expertise_topics
       WHERE user_id = $1
       ORDER BY topic ASC`,
      [userId]
    );

    // Get media
    const mediaResult = await db.query(
      `SELECT id, media_type, file_name, duration_seconds, transcription, created_at
       FROM user_media
       WHERE user_id = $1`,
      [userId]
    );

    // Get visibility settings
    const visibilityResult = await db.query(
      `SELECT field_name, visibility
       FROM user_field_visibility
       WHERE user_id = $1`,
      [userId]
    );

    // Convert visibility to object
    const visibility: Record<string, string> = {};
    visibilityResult.rows.forEach((row: any) => {
      visibility[row.field_name] = row.visibility;
    });

    // Convert media to object by type
    const media: Record<string, any> = {};
    mediaResult.rows.forEach((row: any) => {
      media[row.media_type] = {
        id: row.id,
        fileName: row.file_name,
        durationSeconds: row.duration_seconds,
        transcription: row.transcription,
        createdAt: row.created_at
      };
    });

    res.json({
      success: true,
      data: {
        profile: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          jobTitle: user.job_title,
          department: user.department,
          bio: user.bio,
          pronouns: user.pronouns,
          currentStatus: user.current_status,
          avatarUrl: user.avatar_url,
          mobilePhone: user.mobile_phone,
          workPhone: user.work_phone,
          timezone: user.timezone,
          preferredLanguage: user.preferred_language,
          location: user.location,
          organizationalUnit: user.organizational_unit,
          employeeType: user.employee_type,
          startDate: user.start_date,
          profileCompleteness: user.profile_completeness || 0,
          profileUpdatedAt: user.profile_updated_at,
          createdAt: user.created_at
        },
        funFacts: funFactsResult.rows.map((row: any) => ({
          id: row.id,
          emoji: row.emoji,
          content: row.content,
          displayOrder: row.display_order
        })),
        interests: interestsResult.rows.map((row: any) => ({
          id: row.id,
          interest: row.interest,
          category: row.category
        })),
        expertiseTopics: expertiseResult.rows.map((row: any) => ({
          id: row.id,
          topic: row.topic,
          skillLevel: row.skill_level
        })),
        media,
        visibility
      }
    });
  } catch (error: any) {
    logger.error('Error fetching profile:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/me/profile - Update current user's profile
 */
router.put('/profile', requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.user?.userId;
    const organizationId = req.user?.organizationId;

    if (!userId || !organizationId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const {
      firstName,
      lastName,
      bio,
      pronouns,
      currentStatus,
      mobilePhone,
      workPhone,
      timezone,
      preferredLanguage
    } = req.body;

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (firstName !== undefined) {
      updates.push(`first_name = $${paramIndex++}`);
      values.push(firstName);
    }
    if (lastName !== undefined) {
      updates.push(`last_name = $${paramIndex++}`);
      values.push(lastName);
    }
    if (bio !== undefined) {
      updates.push(`bio = $${paramIndex++}`);
      values.push(bio);
    }
    if (pronouns !== undefined) {
      updates.push(`pronouns = $${paramIndex++}`);
      values.push(pronouns);
    }
    if (currentStatus !== undefined) {
      updates.push(`current_status = $${paramIndex++}`);
      values.push(currentStatus);
    }
    if (mobilePhone !== undefined) {
      updates.push(`mobile_phone = $${paramIndex++}`);
      values.push(mobilePhone);
    }
    if (workPhone !== undefined) {
      updates.push(`work_phone = $${paramIndex++}`);
      values.push(workPhone);
    }
    if (timezone !== undefined) {
      updates.push(`timezone = $${paramIndex++}`);
      values.push(timezone);
    }
    if (preferredLanguage !== undefined) {
      updates.push(`preferred_language = $${paramIndex++}`);
      values.push(preferredLanguage);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    // Always update profile_updated_at
    updates.push(`profile_updated_at = NOW()`);
    updates.push(`updated_at = NOW()`);

    // Add userId at the end
    values.push(userId);

    const query = `
      UPDATE organization_users
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id
    `;

    await db.query(query, values);

    // Recalculate profile completeness
    await db.query(
      `UPDATE organization_users
       SET profile_completeness = calculate_profile_completeness($1)
       WHERE id = $1`,
      [userId]
    );

    logger.info('Profile updated', { userId });

    res.json({
      success: true,
      message: 'Profile updated successfully'
    });
  } catch (error: any) {
    logger.error('Error updating profile:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// FUN FACTS ENDPOINTS
// =====================================================

/**
 * POST /api/me/fun-facts - Add a new fun fact
 */
router.post('/fun-facts', requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.user?.userId;
    const { emoji, content } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Content is required' });
    }

    // Get max display order
    const maxOrderResult = await db.query(
      `SELECT COALESCE(MAX(display_order), -1) + 1 as next_order
       FROM user_fun_facts WHERE user_id = $1`,
      [userId]
    );
    const nextOrder = maxOrderResult.rows[0].next_order;

    const result = await db.query(
      `INSERT INTO user_fun_facts (user_id, emoji, content, display_order)
       VALUES ($1, $2, $3, $4)
       RETURNING id, emoji, content, display_order`,
      [userId, emoji || null, content.trim(), nextOrder]
    );

    // Update profile completeness
    await db.query(
      `UPDATE organization_users
       SET profile_completeness = calculate_profile_completeness($1),
           profile_updated_at = NOW()
       WHERE id = $1`,
      [userId]
    );

    res.status(201).json({
      success: true,
      data: {
        id: result.rows[0].id,
        emoji: result.rows[0].emoji,
        content: result.rows[0].content,
        displayOrder: result.rows[0].display_order
      }
    });
  } catch (error: any) {
    logger.error('Error adding fun fact:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/me/fun-facts/:id - Update a fun fact
 */
router.put('/fun-facts/:id', requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    const { emoji, content } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const result = await db.query(
      `UPDATE user_fun_facts
       SET emoji = $1, content = $2, updated_at = NOW()
       WHERE id = $3 AND user_id = $4
       RETURNING id, emoji, content, display_order`,
      [emoji || null, content?.trim(), id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Fun fact not found' });
    }

    res.json({
      success: true,
      data: {
        id: result.rows[0].id,
        emoji: result.rows[0].emoji,
        content: result.rows[0].content,
        displayOrder: result.rows[0].display_order
      }
    });
  } catch (error: any) {
    logger.error('Error updating fun fact:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/me/fun-facts/:id - Delete a fun fact
 */
router.delete('/fun-facts/:id', requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const result = await db.query(
      `DELETE FROM user_fun_facts WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Fun fact not found' });
    }

    // Update profile completeness
    await db.query(
      `UPDATE organization_users
       SET profile_completeness = calculate_profile_completeness($1),
           profile_updated_at = NOW()
       WHERE id = $1`,
      [userId]
    );

    res.json({ success: true, message: 'Fun fact deleted' });
  } catch (error: any) {
    logger.error('Error deleting fun fact:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/me/fun-facts/reorder - Reorder fun facts
 */
router.put('/fun-facts/reorder', requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.user?.userId;
    const { order } = req.body; // Array of { id, displayOrder }

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (!Array.isArray(order)) {
      return res.status(400).json({ success: false, error: 'Order must be an array' });
    }

    // Update each fun fact's order
    for (const item of order) {
      await db.query(
        `UPDATE user_fun_facts SET display_order = $1 WHERE id = $2 AND user_id = $3`,
        [item.displayOrder, item.id, userId]
      );
    }

    res.json({ success: true, message: 'Order updated' });
  } catch (error: any) {
    logger.error('Error reordering fun facts:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// INTERESTS ENDPOINTS
// =====================================================

/**
 * POST /api/me/interests - Add a new interest
 */
router.post('/interests', requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.user?.userId;
    const { interest, category } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (!interest || interest.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Interest is required' });
    }

    const normalizedInterest = interest.trim().toLowerCase();

    const result = await db.query(
      `INSERT INTO user_interests (user_id, interest, category)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, interest) DO NOTHING
       RETURNING id, interest, category`,
      [userId, normalizedInterest, category || null]
    );

    if (result.rows.length === 0) {
      return res.status(409).json({ success: false, error: 'Interest already exists' });
    }

    // Update profile completeness
    await db.query(
      `UPDATE organization_users
       SET profile_completeness = calculate_profile_completeness($1),
           profile_updated_at = NOW()
       WHERE id = $1`,
      [userId]
    );

    res.status(201).json({
      success: true,
      data: {
        id: result.rows[0].id,
        interest: result.rows[0].interest,
        category: result.rows[0].category
      }
    });
  } catch (error: any) {
    logger.error('Error adding interest:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/me/interests/:id - Delete an interest
 */
router.delete('/interests/:id', requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const result = await db.query(
      `DELETE FROM user_interests WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Interest not found' });
    }

    // Update profile completeness
    await db.query(
      `UPDATE organization_users
       SET profile_completeness = calculate_profile_completeness($1),
           profile_updated_at = NOW()
       WHERE id = $1`,
      [userId]
    );

    res.json({ success: true, message: 'Interest deleted' });
  } catch (error: any) {
    logger.error('Error deleting interest:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// EXPERTISE TOPICS ENDPOINTS (Ask Me About)
// =====================================================

/**
 * POST /api/me/expertise - Add a new expertise topic
 */
router.post('/expertise', requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.user?.userId;
    const { topic, skillLevel } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (!topic || topic.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Topic is required' });
    }

    const normalizedTopic = topic.trim().toLowerCase();

    const result = await db.query(
      `INSERT INTO user_expertise_topics (user_id, topic, skill_level)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, topic) DO NOTHING
       RETURNING id, topic, skill_level`,
      [userId, normalizedTopic, skillLevel || null]
    );

    if (result.rows.length === 0) {
      return res.status(409).json({ success: false, error: 'Topic already exists' });
    }

    // Update profile completeness
    await db.query(
      `UPDATE organization_users
       SET profile_completeness = calculate_profile_completeness($1),
           profile_updated_at = NOW()
       WHERE id = $1`,
      [userId]
    );

    res.status(201).json({
      success: true,
      data: {
        id: result.rows[0].id,
        topic: result.rows[0].topic,
        skillLevel: result.rows[0].skill_level
      }
    });
  } catch (error: any) {
    logger.error('Error adding expertise topic:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/me/expertise/:id - Delete an expertise topic
 */
router.delete('/expertise/:id', requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const result = await db.query(
      `DELETE FROM user_expertise_topics WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Expertise topic not found' });
    }

    // Update profile completeness
    await db.query(
      `UPDATE organization_users
       SET profile_completeness = calculate_profile_completeness($1),
           profile_updated_at = NOW()
       WHERE id = $1`,
      [userId]
    );

    res.json({ success: true, message: 'Expertise topic deleted' });
  } catch (error: any) {
    logger.error('Error deleting expertise topic:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// PRIVACY SETTINGS ENDPOINTS
// =====================================================

/**
 * GET /api/me/privacy - Get privacy settings
 */
router.get('/privacy', requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Initialize default settings if they don't exist
    await db.query('SELECT initialize_user_visibility_settings($1)', [userId]);

    const result = await db.query(
      `SELECT field_name, visibility FROM user_field_visibility WHERE user_id = $1`,
      [userId]
    );

    const settings: Record<string, string> = {};
    result.rows.forEach((row: any) => {
      settings[row.field_name] = row.visibility;
    });

    res.json({ success: true, data: settings });
  } catch (error: any) {
    logger.error('Error fetching privacy settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/me/privacy - Update privacy settings
 */
router.put('/privacy', requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.user?.userId;
    const { settings } = req.body; // { fieldName: visibility }

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ success: false, error: 'Settings must be an object' });
    }

    const validVisibilities = ['everyone', 'team', 'manager', 'none'];

    // Update each field's visibility
    for (const [fieldName, visibility] of Object.entries(settings)) {
      if (!validVisibilities.includes(visibility as string)) {
        continue; // Skip invalid visibilities
      }

      await db.query(
        `INSERT INTO user_field_visibility (user_id, field_name, visibility, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (user_id, field_name)
         DO UPDATE SET visibility = $3, updated_at = NOW()`,
        [userId, fieldName, visibility]
      );
    }

    res.json({ success: true, message: 'Privacy settings updated' });
  } catch (error: any) {
    logger.error('Error updating privacy settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// TEAM ENDPOINTS
// =====================================================

/**
 * GET /api/me/team - Get current user's team (manager, peers, reports)
 */
router.get('/team', requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.user?.userId;
    const organizationId = req.user?.organizationId;

    if (!userId || !organizationId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Get current user's manager
    const userResult = await db.query(
      `SELECT manager_id FROM organization_users WHERE id = $1`,
      [userId]
    );

    const managerId = userResult.rows[0]?.manager_id;

    // Get manager info
    let manager = null;
    if (managerId) {
      const managerResult = await db.query(
        `SELECT id, first_name, last_name, email, job_title, department, avatar_url
         FROM organization_users WHERE id = $1 AND is_active = true`,
        [managerId]
      );
      if (managerResult.rows.length > 0) {
        const m = managerResult.rows[0];
        manager = {
          id: m.id,
          firstName: m.first_name,
          lastName: m.last_name,
          email: m.email,
          jobTitle: m.job_title,
          department: m.department,
          avatarUrl: m.avatar_url
        };
      }
    }

    // Get peers (same manager, excluding self)
    let peers: any[] = [];
    if (managerId) {
      const peersResult = await db.query(
        `SELECT id, first_name, last_name, email, job_title, department, avatar_url
         FROM organization_users
         WHERE manager_id = $1 AND id != $2 AND is_active = true
         ORDER BY first_name, last_name`,
        [managerId, userId]
      );
      peers = peersResult.rows.map((p: any) => ({
        id: p.id,
        firstName: p.first_name,
        lastName: p.last_name,
        email: p.email,
        jobTitle: p.job_title,
        department: p.department,
        avatarUrl: p.avatar_url
      }));
    }

    // Get direct reports
    const reportsResult = await db.query(
      `SELECT id, first_name, last_name, email, job_title, department, avatar_url
       FROM organization_users
       WHERE manager_id = $1 AND is_active = true
       ORDER BY first_name, last_name`,
      [userId]
    );
    const directReports = reportsResult.rows.map((r: any) => ({
      id: r.id,
      firstName: r.first_name,
      lastName: r.last_name,
      email: r.email,
      jobTitle: r.job_title,
      department: r.department,
      avatarUrl: r.avatar_url
    }));

    res.json({
      success: true,
      data: {
        manager,
        peers,
        directReports
      }
    });
  } catch (error: any) {
    logger.error('Error fetching team:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// MEDIA ENDPOINTS
// =====================================================

/**
 * GET /api/me/media/constraints - Get media upload constraints for client validation
 */
router.get('/media/constraints', requireAuth, async (_req: express.Request, res: express.Response) => {
  res.json({
    success: true,
    data: mediaUploadService.getMediaConstraints()
  });
});

/**
 * GET /api/me/media - Get all media for current user
 */
router.get('/media', requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const media = await mediaUploadService.getAllMedia(userId);

    res.json({ success: true, data: media });
  } catch (error: any) {
    logger.error('Error fetching media:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/me/media/:type - Get specific media type
 */
router.get('/media/:type', requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.user?.userId;
    const mediaType = req.params.type as MediaType;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const validTypes: MediaType[] = ['voice_intro', 'video_intro', 'name_pronunciation'];
    if (!validTypes.includes(mediaType)) {
      return res.status(400).json({ success: false, error: 'Invalid media type' });
    }

    const media = await mediaUploadService.getMedia(userId, mediaType);

    if (!media) {
      return res.status(404).json({ success: false, error: 'Media not found' });
    }

    res.json({ success: true, data: media });
  } catch (error: any) {
    logger.error('Error fetching media:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/me/media/:type - Upload media
 */
router.post('/media/:type', requireAuth, upload.single('file'), async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.user?.userId;
    const organizationId = req.user?.organizationId;
    const mediaType = req.params.type as MediaType;

    if (!userId || !organizationId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const validTypes: MediaType[] = ['voice_intro', 'video_intro', 'name_pronunciation'];
    if (!validTypes.includes(mediaType)) {
      return res.status(400).json({ success: false, error: 'Invalid media type' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    // Get duration from request body (client should calculate this)
    const durationSeconds = req.body.duration ? parseInt(req.body.duration, 10) : undefined;

    const result = await mediaUploadService.uploadMedia({
      userId,
      organizationId,
      mediaType,
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      fileName: req.file.originalname,
      durationSeconds,
    });

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    res.status(201).json({
      success: true,
      data: {
        mediaId: result.mediaId,
        presignedUrl: result.presignedUrl,
      },
    });
  } catch (error: any) {
    logger.error('Error uploading media:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/me/media/:type - Delete media
 */
router.delete('/media/:type', requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.user?.userId;
    const mediaType = req.params.type as MediaType;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const validTypes: MediaType[] = ['voice_intro', 'video_intro', 'name_pronunciation'];
    if (!validTypes.includes(mediaType)) {
      return res.status(400).json({ success: false, error: 'Invalid media type' });
    }

    const success = await mediaUploadService.deleteMedia(userId, mediaType);

    if (!success) {
      return res.status(500).json({ success: false, error: 'Failed to delete media' });
    }

    res.json({ success: true, message: 'Media deleted' });
  } catch (error: any) {
    logger.error('Error deleting media:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
