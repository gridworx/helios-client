import { Router, Request, Response } from 'express';
import multer from 'multer';
import { photoService } from '../services/photo.service';
import { logger } from '../utils/logger';

const router = Router();

// Configure multer for memory storage (we'll process the buffer)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max
  },
  fileFilter: (req, file, cb) => {
    // Accept images only
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  }
});

/**
 * POST /api/photos/upload-avatar
 * Upload user avatar photo with automatic resizing
 */
router.post('/upload-avatar', upload.single('photo'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const { userId, organizationId } = req.body;

    if (!userId || !organizationId) {
      return res.status(400).json({
        success: false,
        error: 'userId and organizationId are required'
      });
    }

    logger.info('Uploading avatar photo', { userId, organizationId, size: req.file.size });

    const result = await photoService.uploadPhoto(req.file.buffer, {
      userId,
      organizationId,
      photoType: 'avatar',
      aspectRatio: 1.0 // Square
    });

    if (result.success) {
      res.json({
        success: true,
        message: 'Avatar uploaded successfully',
        data: {
          assetId: result.assetId,
          urls: result.urls
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }

  } catch (error: any) {
    logger.error('Avatar upload failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to upload avatar'
    });
  }
});

/**
 * POST /api/photos/upload-logo
 * Upload company logo with automatic resizing
 */
router.post('/upload-logo', upload.single('photo'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const { organizationId, aspectRatio } = req.body;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: 'organizationId is required'
      });
    }

    logger.info('Uploading company logo', { organizationId, size: req.file.size });

    const result = await photoService.uploadPhoto(req.file.buffer, {
      organizationId,
      photoType: 'logo',
      aspectRatio: aspectRatio ? parseFloat(aspectRatio) : 1.0
    });

    if (result.success) {
      res.json({
        success: true,
        message: 'Logo uploaded successfully',
        data: {
          assetId: result.assetId,
          urls: result.urls
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }

  } catch (error: any) {
    logger.error('Logo upload failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to upload logo'
    });
  }
});

/**
 * GET /api/photos/:entityType/:entityId
 * Get photo URLs for a user or organization
 */
router.get('/:entityType/:entityId', async (req: Request, res: Response) => {
  try {
    const { entityType, entityId } = req.params;

    if (entityType !== 'user' && entityType !== 'organization') {
      return res.status(400).json({
        success: false,
        error: 'Invalid entity type. Must be "user" or "organization"'
      });
    }

    const urls = await photoService.getPhotoUrls(entityId, entityType);

    if (!urls) {
      return res.status(404).json({
        success: false,
        error: 'Photo not found'
      });
    }

    res.json({
      success: true,
      data: { urls }
    });

  } catch (error: any) {
    logger.error('Failed to get photo URLs', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get photo URLs'
    });
  }
});

/**
 * DELETE /api/photos/:assetId
 * Delete a photo and all its sizes
 */
router.delete('/:assetId', async (req: Request, res: Response) => {
  try {
    const { assetId } = req.params;

    const result = await photoService.deletePhoto(assetId);

    if (result.success) {
      res.json({
        success: true,
        message: 'Photo deleted successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }

  } catch (error: any) {
    logger.error('Photo deletion failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to delete photo'
    });
  }
});

export default router;
