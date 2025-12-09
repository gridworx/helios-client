import { Router, Request, Response } from 'express';
import { db } from '../database/connection';
import { logger } from '../utils/logger';
import { mediaAssetCacheService } from '../services/media-asset-cache.service';
import { mediaAssetStorageService } from '../services/media-asset-storage.service';
import type { MediaAsset, StorageBackend } from '../types/media-assets';

const router = Router();

/**
 * Health check endpoint for the proxy
 * MUST be registered BEFORE token routes to avoid matching as a token
 */
router.get('/_health', async (_req: Request, res: Response) => {
  const cacheStats = await mediaAssetCacheService.getStats();

  res.json({
    success: true,
    service: 'asset-proxy',
    cache: {
      connected: cacheStats.connected,
      keyCount: cacheStats.keyCount,
    },
  });
});

/**
 * Rate limiting state (simple in-memory for now)
 * In production, use Redis for distributed rate limiting
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 100; // requests per window
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

/**
 * Simple rate limiter middleware
 */
function rateLimit(req: Request, res: Response, next: Function) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();

  const state = rateLimitMap.get(ip);

  if (!state || now > state.resetAt) {
    // New window
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return next();
  }

  if (state.count >= RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil((state.resetAt - now) / 1000);
    res.set('Retry-After', retryAfter.toString());
    return res.status(429).json({
      success: false,
      error: 'Too many requests',
      retryAfter,
    });
  }

  state.count++;
  return next();
}

/**
 * Get asset from database by token
 */
async function getAssetByToken(accessToken: string): Promise<MediaAsset | null> {
  try {
    const result = await db.query(
      `SELECT
        id,
        organization_id as "organizationId",
        storage_type as "storageType",
        storage_path as "storagePath",
        name,
        filename,
        mime_type as "mimeType",
        size_bytes as "sizeBytes",
        folder_id as "folderId",
        category,
        access_token as "accessToken",
        is_public as "isPublic",
        access_count as "accessCount",
        last_accessed_at as "lastAccessedAt",
        created_by as "createdBy",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM media_assets
      WHERE access_token = $1`,
      [accessToken]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0] as MediaAsset;
  } catch (error) {
    logger.error('Failed to get asset by token', { accessToken, error });
    return null;
  }
}

/**
 * Update access stats (async, non-blocking)
 */
async function updateAccessStats(assetId: string): Promise<void> {
  try {
    await db.query(
      `UPDATE media_assets
       SET access_count = access_count + 1,
           last_accessed_at = NOW()
       WHERE id = $1`,
      [assetId]
    );
  } catch (error) {
    // Log but don't fail the request
    logger.warn('Failed to update asset access stats', { assetId, error });
  }
}

/**
 * GET /a/:token
 * GET /a/:token/:filename
 *
 * Public asset proxy endpoint - no authentication required.
 * Serves media assets with proper Content-Type and caching headers.
 */
router.get(
  ['/:token', '/:token/:filename'],
  rateLimit,
  async (req: Request, res: Response) => {
    const { token } = req.params;

    try {
      // Try cache first
      const cached = await mediaAssetCacheService.get(token);
      if (cached) {
        // Update stats asynchronously
        const asset = await getAssetByToken(token);
        if (asset) {
          updateAccessStats(asset.id); // Don't await
        }

        // Serve from cache
        res.set({
          'Content-Type': cached.mimeType,
          'Content-Length': cached.data.length.toString(),
          'Cache-Control': 'public, max-age=3600',
          'X-Cache': 'HIT',
        });
        return res.send(cached.data);
      }

      // Cache miss - get asset metadata from database
      const asset = await getAssetByToken(token);

      if (!asset) {
        logger.debug('Asset not found', { token });
        return res.status(404).json({
          success: false,
          error: 'Asset not found',
        });
      }

      // Check if asset is public
      if (!asset.isPublic) {
        logger.debug('Asset is not public', { token, assetId: asset.id });
        return res.status(403).json({
          success: false,
          error: 'Access denied',
        });
      }

      // Get file from storage
      const fileResult = await mediaAssetStorageService.getFile(
        asset.organizationId,
        asset.storagePath,
        asset.storageType as StorageBackend
      );

      if (!fileResult.success || !fileResult.data) {
        logger.error('Failed to retrieve asset from storage', {
          token,
          assetId: asset.id,
          error: fileResult.error,
        });
        return res.status(503).json({
          success: false,
          error: 'Storage temporarily unavailable',
        });
      }

      // Cache the file for future requests
      // Get cache TTL from organization settings
      const settings = await mediaAssetStorageService.getSettings(asset.organizationId);
      const cacheTTL = settings?.cacheTtlSeconds || 3600;

      // Cache asynchronously (don't wait)
      mediaAssetCacheService.set(token, fileResult.data, asset.mimeType, cacheTTL);

      // Update access stats asynchronously
      updateAccessStats(asset.id);

      // Serve the file
      res.set({
        'Content-Type': asset.mimeType,
        'Content-Length': fileResult.data.length.toString(),
        'Cache-Control': `public, max-age=${cacheTTL}`,
        'X-Cache': 'MISS',
      });

      return res.send(fileResult.data);
    } catch (error: any) {
      logger.error('Asset proxy error', { token, error: error.message });
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }
);

export default router;
