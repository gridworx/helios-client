import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { dataQualityService } from '../services/data-quality.service';
import { logger } from '../utils/logger';
import { authenticateToken } from '../middleware/auth';

const router = Router();

/**
 * GET /api/organization/data-quality/orphans
 * Get all orphaned values (combined from departments, locations, cost centers)
 * This is the endpoint used by the frontend MasterDataSection component
 */
router.get('/orphans', authenticateToken, async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        error: 'Organization ID not found'
      });
    }

    const [deptQuality, locQuality, ccQuality] = await Promise.all([
      dataQualityService.getDepartmentQuality(organizationId),
      dataQualityService.getLocationQuality(organizationId),
      dataQualityService.getCostCenterQuality(organizationId)
    ]);

    // Combine all orphaned values with field indicator
    const orphans = [
      ...deptQuality.orphaned.map(o => ({ ...o, field: 'department' })),
      ...locQuality.orphaned.map(o => ({ ...o, field: 'location' })),
      ...ccQuality.orphaned.map(o => ({ ...o, field: 'cost_center' }))
    ];

    res.json({
      success: true,
      data: orphans
    });
  } catch (error: any) {
    logger.error('Failed to fetch orphaned values', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch orphaned values'
    });
  }
});

/**
 * GET /api/organization/data-quality/report
 * Get comprehensive data quality report
 */
router.get('/report', authenticateToken, async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        error: 'Organization ID not found'
      });
    }

    const report = await dataQualityService.getDataQualityReport(organizationId);

    res.json({
      success: true,
      data: report
    });
  } catch (error: any) {
    logger.error('Failed to fetch data quality report', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch data quality report'
    });
  }
});

/**
 * GET /api/organization/data-quality/departments
 * Get department-specific data quality
 */
router.get('/departments', authenticateToken, async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        error: 'Organization ID not found'
      });
    }

    const quality = await dataQualityService.getDepartmentQuality(organizationId);

    res.json({
      success: true,
      data: quality
    });
  } catch (error: any) {
    logger.error('Failed to fetch department quality', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch department quality'
    });
  }
});

/**
 * GET /api/organization/data-quality/locations
 * Get location-specific data quality
 */
router.get('/locations', authenticateToken, async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        error: 'Organization ID not found'
      });
    }

    const quality = await dataQualityService.getLocationQuality(organizationId);

    res.json({
      success: true,
      data: quality
    });
  } catch (error: any) {
    logger.error('Failed to fetch location quality', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch location quality'
    });
  }
});

/**
 * GET /api/organization/data-quality/cost-centers
 * Get cost center-specific data quality
 */
router.get('/cost-centers', authenticateToken, async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        error: 'Organization ID not found'
      });
    }

    const quality = await dataQualityService.getCostCenterQuality(organizationId);

    res.json({
      success: true,
      data: quality
    });
  } catch (error: any) {
    logger.error('Failed to fetch cost center quality', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch cost center quality'
    });
  }
});

/**
 * GET /api/organization/data-quality/managers
 * Get manager relationship quality
 */
router.get('/managers', authenticateToken, async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        error: 'Organization ID not found'
      });
    }

    const quality = await dataQualityService.getManagerQuality(organizationId);

    res.json({
      success: true,
      data: quality
    });
  } catch (error: any) {
    logger.error('Failed to fetch manager quality', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch manager quality'
    });
  }
});

/**
 * POST /api/organization/data-quality/resolve-orphan
 * Resolve an orphaned value by mapping to master data or creating new entry
 */
router.post('/resolve-orphan',
  authenticateToken,
  [
    body('entityType').isIn(['department', 'location', 'cost_center']).withMessage('Invalid entity type'),
    body('orphanedValue').trim().notEmpty().withMessage('Orphaned value is required'),
    body('resolution').isIn(['map', 'create', 'ignore']).withMessage('Invalid resolution type'),
    body('targetId').optional().isUUID().withMessage('Target ID must be a valid UUID'),
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

      if (!organizationId) {
        return res.status(401).json({
          success: false,
          error: 'Organization ID not found'
        });
      }

      const { entityType, orphanedValue, resolution, targetId } = req.body;

      // Validate that targetId is provided when resolution is 'map'
      if (resolution === 'map' && !targetId) {
        return res.status(400).json({
          success: false,
          error: 'Target ID is required when mapping to existing entity'
        });
      }

      let result: { affected: number };

      switch (entityType) {
        case 'department':
          result = await dataQualityService.resolveOrphanedDepartment(
            organizationId,
            orphanedValue,
            resolution,
            targetId
          );
          break;
        case 'location':
          result = await dataQualityService.resolveOrphanedLocation(
            organizationId,
            orphanedValue,
            resolution,
            targetId
          );
          break;
        case 'cost_center':
          // TODO: Implement cost center resolution
          return res.status(501).json({
            success: false,
            error: 'Cost center resolution not yet implemented'
          });
        default:
          return res.status(400).json({
            success: false,
            error: 'Invalid entity type'
          });
      }

      res.json({
        success: true,
        message: `Successfully resolved orphan. ${result.affected} users updated.`,
        data: result
      });
    } catch (error: any) {
      logger.error('Failed to resolve orphan', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to resolve orphan'
      });
    }
  }
);

/**
 * POST /api/organization/data-quality/auto-import
 * Auto-import unique values from user records into master data
 */
router.post('/auto-import',
  authenticateToken,
  [
    body('entityType').isIn(['departments', 'locations', 'cost_centers']).withMessage('Invalid entity type'),
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

      if (!organizationId) {
        return res.status(401).json({
          success: false,
          error: 'Organization ID not found'
        });
      }

      const { entityType } = req.body;

      const result = await dataQualityService.autoImportMasterData(organizationId, entityType);

      res.json({
        success: true,
        message: `Successfully imported ${result.imported} ${entityType}`,
        data: result
      });
    } catch (error: any) {
      logger.error('Failed to auto-import master data', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to auto-import master data'
      });
    }
  }
);

export default router;
