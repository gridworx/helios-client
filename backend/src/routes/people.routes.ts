import express from 'express';
import { requireAuth } from '../middleware/auth';
import { peopleService } from '../services/people.service';
import { mediaUploadService } from '../services/media-upload.service';
import { logger } from '../utils/logger';

const router = express.Router();

/**
 * GET /api/people
 * List people in the directory with pagination and filtering
 */
router.get('/', requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const {
      search,
      department,
      location,
      limit = '20',
      offset = '0',
      sortBy = 'name',
      sortOrder = 'asc',
      newJoinersOnly = 'false',
      hasMedia = 'false',
    } = req.query;

    const result = await peopleService.listPeople({
      organizationId,
      search: search as string,
      department: department as string,
      location: location as string,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
      sortBy: sortBy as 'name' | 'department' | 'startDate',
      sortOrder: sortOrder as 'asc' | 'desc',
      newJoinersOnly: newJoinersOnly === 'true',
      hasMedia: hasMedia === 'true',
    });

    res.json({
      success: true,
      data: result.people,
      pagination: {
        total: result.total,
        limit: parseInt(limit as string, 10),
        offset: parseInt(offset as string, 10),
        hasMore: parseInt(offset as string, 10) + result.people.length < result.total,
      },
    });
  } catch (error: any) {
    logger.error('Error listing people:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/people/search
 * Search people by name, skills, or interests
 */
router.get('/search', requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { q, limit = '10', fields } = req.query;

    if (!q || typeof q !== 'string' || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Search query must be at least 2 characters',
      });
    }

    // Parse search fields
    let searchFields: ('name' | 'skills' | 'interests')[] = ['name', 'skills', 'interests'];
    if (fields && typeof fields === 'string') {
      searchFields = fields.split(',') as ('name' | 'skills' | 'interests')[];
    }

    const people = await peopleService.searchPeople(organizationId, q.trim(), {
      limit: parseInt(limit as string, 10),
      searchFields,
    });

    res.json({
      success: true,
      data: people,
    });
  } catch (error: any) {
    logger.error('Error searching people:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/people/new
 * Get recently joined people (new joiners)
 */
router.get('/new', requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { limit = '10' } = req.query;

    const people = await peopleService.getNewJoiners(
      organizationId,
      parseInt(limit as string, 10)
    );

    res.json({
      success: true,
      data: people,
    });
  } catch (error: any) {
    logger.error('Error getting new joiners:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/people/filters
 * Get available filter options (departments, locations)
 */
router.get('/filters', requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const filters = await peopleService.getFilterOptions(organizationId);

    res.json({
      success: true,
      data: filters,
    });
  } catch (error: any) {
    logger.error('Error getting filter options:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/people/by-skill/:topic
 * Find people with specific expertise
 */
router.get('/by-skill/:topic', requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { topic } = req.params;
    const { limit = '10' } = req.query;

    if (!topic || topic.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Topic must be at least 2 characters',
      });
    }

    const people = await peopleService.findByExpertise(
      organizationId,
      topic.trim(),
      parseInt(limit as string, 10)
    );

    res.json({
      success: true,
      data: people,
    });
  } catch (error: any) {
    logger.error('Error finding people by skill:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/people/:id
 * Get a single person's profile
 */
router.get('/:id', requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const organizationId = req.user?.organizationId;
    const viewerId = req.user?.userId;

    if (!organizationId || !viewerId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { id } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ success: false, error: 'Invalid person ID' });
    }

    const profile = await peopleService.getPersonProfile(id, viewerId, organizationId);

    if (!profile) {
      return res.status(404).json({ success: false, error: 'Person not found' });
    }

    res.json({
      success: true,
      data: profile,
    });
  } catch (error: any) {
    logger.error('Error getting person profile:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/people/:id/media/:type
 * Get a person's media (voice intro, video intro, name pronunciation)
 * Returns presigned URL for playback
 */
router.get('/:id/media/:type', requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const organizationId = req.user?.organizationId;
    const viewerId = req.user?.userId;

    if (!organizationId || !viewerId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { id, type } = req.params;

    // Validate media type
    const validTypes = ['voice_intro', 'video_intro', 'name_pronunciation'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ success: false, error: 'Invalid media type' });
    }

    // Get media with presigned URL
    const media = await mediaUploadService.getMedia(id, type as any);

    if (!media) {
      return res.status(404).json({ success: false, error: 'Media not found' });
    }

    res.json({
      success: true,
      data: media,
    });
  } catch (error: any) {
    logger.error('Error getting person media:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
