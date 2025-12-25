import { Router, Request, Response } from 'express';
import { db } from '../database/connection.js';
import { logger } from '../utils/logger.js';
import { authenticateToken } from '../middleware/auth.js';
import {
  successResponse,
  errorResponse,
} from '../utils/response.js';
import { ErrorCode } from '../types/error-codes.js';

const router = Router();

interface LicenseInfo {
  id: string;
  provider: 'google' | 'microsoft';
  skuId: string;
  displayName: string;
  description?: string;
  totalUnits: number;
  consumedUnits: number;
  availableUnits: number;
  features?: string[];
}

/**
 * @openapi
 * /organization/licenses:
 *   get:
 *     summary: List all available licenses
 *     description: |
 *       Returns a unified view of all available licenses across connected providers
 *       (Google Workspace and Microsoft 365). Includes usage information.
 *     tags: [Licenses]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of available licenses
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     licenses:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           provider:
 *                             type: string
 *                             enum: [google, microsoft]
 *                           skuId:
 *                             type: string
 *                           displayName:
 *                             type: string
 *                           totalUnits:
 *                             type: integer
 *                           consumedUnits:
 *                             type: integer
 *                           availableUnits:
 *                             type: integer
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalLicenses:
 *                           type: integer
 *                         googleLicenses:
 *                           type: integer
 *                         microsoftLicenses:
 *                           type: integer
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return errorResponse(res, ErrorCode.UNAUTHORIZED, 'Organization ID not found');
    }

    const licenses: LicenseInfo[] = [];

    // Fetch Microsoft licenses if available
    try {
      const msResult = await db.query(`
        SELECT
          id,
          sku_id as "skuId",
          sku_part_number as "skuPartNumber",
          display_name as "displayName",
          total_units as "totalUnits",
          consumed_units as "consumedUnits",
          available_units as "availableUnits",
          service_plans as "servicePlans"
        FROM ms_licenses
        WHERE organization_id = $1
        ORDER BY display_name
      `, [organizationId]);

      for (const row of msResult.rows) {
        licenses.push({
          id: row.id,
          provider: 'microsoft',
          skuId: row.skuId,
          displayName: row.displayName || row.skuPartNumber || row.skuId,
          totalUnits: row.totalUnits || 0,
          consumedUnits: row.consumedUnits || 0,
          availableUnits: row.availableUnits || 0,
          features: row.servicePlans ?
            (Array.isArray(row.servicePlans) ?
              row.servicePlans.map((sp: any) => sp.servicePlanName) :
              []) :
            []
        });
      }
    } catch (e: any) {
      logger.debug('No Microsoft licenses table or error fetching', { error: e.message });
    }

    // Define standard Google Workspace license SKUs with defaults
    // Note: Google doesn't have a direct license API like Microsoft.
    // These are the common Google Workspace editions available for user assignment.
    const googleLicenseSKUs = [
      {
        skuId: 'Google-Apps-For-Business',
        displayName: 'Google Workspace Business Starter',
        description: 'Basic productivity and collaboration tools'
      },
      {
        skuId: 'Google-Apps-Unlimited',
        displayName: 'Google Workspace Business Standard',
        description: 'Enhanced productivity with more storage'
      },
      {
        skuId: 'Google-Apps-For-Business-Plus',
        displayName: 'Google Workspace Business Plus',
        description: 'Advanced security and management features'
      },
      {
        skuId: 'Google-Apps-Enterprise',
        displayName: 'Google Workspace Enterprise Standard',
        description: 'Enterprise-grade security and compliance'
      },
      {
        skuId: 'Google-Apps-Enterprise-Plus',
        displayName: 'Google Workspace Enterprise Plus',
        description: 'Advanced enterprise features with eDiscovery'
      },
      {
        skuId: '1010020020',
        displayName: 'Google Workspace Essentials',
        description: 'Meet and Drive for non-Gmail users'
      },
      {
        skuId: '1010020025',
        displayName: 'Google Workspace Frontline Starter',
        description: 'Basic tools for frontline workers'
      }
    ];

    // Check if Google Workspace is enabled for this organization
    try {
      const gwResult = await db.query(`
        SELECT id FROM gw_credentials
        WHERE organization_id = $1
      `, [organizationId]);

      if (gwResult.rows.length > 0) {
        // Google Workspace is configured - add available license types
        // Note: In a real implementation, we would query the Google Licensing API
        // to get actual license counts. For now, we provide the list of available SKUs.
        for (const sku of googleLicenseSKUs) {
          licenses.push({
            id: `gw-${sku.skuId}`,
            provider: 'google',
            skuId: sku.skuId,
            displayName: sku.displayName,
            description: sku.description,
            totalUnits: -1, // -1 indicates unknown (requires API call)
            consumedUnits: -1,
            availableUnits: -1,
            features: []
          });
        }
      }
    } catch (e: any) {
      logger.debug('No Google Workspace credentials or error checking', { error: e.message });
    }

    // Calculate summary
    const googleLicenses = licenses.filter(l => l.provider === 'google');
    const microsoftLicenses = licenses.filter(l => l.provider === 'microsoft');

    successResponse(res, {
      licenses,
      summary: {
        totalLicenses: licenses.length,
        googleLicenses: googleLicenses.length,
        microsoftLicenses: microsoftLicenses.length
      }
    });
  } catch (error: any) {
    logger.error('Failed to fetch licenses', { error: error.message });
    errorResponse(res, ErrorCode.INTERNAL_ERROR, 'Failed to fetch licenses');
  }
});

/**
 * @openapi
 * /organization/licenses/{id}:
 *   get:
 *     summary: Get license details
 *     description: Get detailed information about a specific license.
 *     tags: [Licenses]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: License ID
 *     responses:
 *       200:
 *         description: License details
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const organizationId = req.user?.organizationId;

    // Check if it's a Google license (starts with gw-)
    if (id.startsWith('gw-')) {
      const skuId = id.replace('gw-', '');
      const googleLicenseSKUs: Record<string, { displayName: string; description: string }> = {
        'Google-Apps-For-Business': {
          displayName: 'Google Workspace Business Starter',
          description: 'Basic productivity and collaboration tools'
        },
        'Google-Apps-Unlimited': {
          displayName: 'Google Workspace Business Standard',
          description: 'Enhanced productivity with more storage'
        },
        'Google-Apps-For-Business-Plus': {
          displayName: 'Google Workspace Business Plus',
          description: 'Advanced security and management features'
        },
        'Google-Apps-Enterprise': {
          displayName: 'Google Workspace Enterprise Standard',
          description: 'Enterprise-grade security and compliance'
        },
        'Google-Apps-Enterprise-Plus': {
          displayName: 'Google Workspace Enterprise Plus',
          description: 'Advanced enterprise features with eDiscovery'
        }
      };

      const licenseInfo = googleLicenseSKUs[skuId];
      if (licenseInfo) {
        return successResponse(res, {
          id,
          provider: 'google',
          skuId,
          displayName: licenseInfo.displayName,
          description: licenseInfo.description,
          totalUnits: -1,
          consumedUnits: -1,
          availableUnits: -1
        });
      }
      return errorResponse(res, ErrorCode.NOT_FOUND, 'License not found');
    }

    // Otherwise, it's a Microsoft license
    const result = await db.query(`
      SELECT
        id,
        sku_id as "skuId",
        sku_part_number as "skuPartNumber",
        display_name as "displayName",
        total_units as "totalUnits",
        consumed_units as "consumedUnits",
        available_units as "availableUnits",
        service_plans as "servicePlans",
        raw_data as "rawData"
      FROM ms_licenses
      WHERE id = $1 AND organization_id = $2
    `, [id, organizationId]);

    if (result.rows.length === 0) {
      return errorResponse(res, ErrorCode.NOT_FOUND, 'License not found');
    }

    const row = result.rows[0];
    successResponse(res, {
      id: row.id,
      provider: 'microsoft',
      skuId: row.skuId,
      displayName: row.displayName || row.skuPartNumber || row.skuId,
      totalUnits: row.totalUnits || 0,
      consumedUnits: row.consumedUnits || 0,
      availableUnits: row.availableUnits || 0,
      servicePlans: row.servicePlans,
      rawData: row.rawData
    });
  } catch (error: any) {
    logger.error('Failed to fetch license', { error: error.message });
    errorResponse(res, ErrorCode.INTERNAL_ERROR, 'Failed to fetch license');
  }
});

export default router;
