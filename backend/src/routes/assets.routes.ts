import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import { db } from '../database/connection';
import { logger } from '../utils/logger';
import { authenticateToken } from '../middleware/auth';
import { mediaAssetStorageService } from '../services/media-asset-storage.service';
import { mediaAssetCacheService } from '../services/media-asset-cache.service';
import type {
  MediaAsset,
  MediaAssetWithUrl,
  MediaAssetFolder,
  FolderTreeNode,
  CreateMediaAssetRequest,
  UpdateMediaAssetRequest,
  ListMediaAssetsQuery,
  CreateMediaAssetFolderRequest,
  UpdateMediaAssetSettingsRequest,
  MediaAssetSetupStatus,
  AssetCategory,
  StorageBackend,
  ALLOWED_MIME_TYPES,
} from '../types/media-assets';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB default, will check org settings
  },
});

// All routes require authentication
router.use(authenticateToken);

// Helper: Get organization ID from request
function getOrganizationId(req: Request): string {
  return (req as any).user?.organizationId || (req as any).organizationId;
}

// Helper: Get user ID from request
function getUserId(req: Request): string | null {
  return (req as any).user?.id || null;
}

// Helper: Generate public URL for an asset
function getPublicUrl(accessToken: string, filename?: string): string {
  const baseUrl = process.env['PUBLIC_URL'] || process.env['BACKEND_URL'] || 'http://localhost:3001';
  if (filename) {
    return `${baseUrl}/a/${accessToken}/${encodeURIComponent(filename)}`;
  }
  return `${baseUrl}/a/${accessToken}`;
}

// ============================================================================
// Asset CRUD Routes (TASK-ASSET-009)
// ============================================================================

/**
 * GET /api/assets
 * List assets with optional filters
 */
router.get('/', async (req: Request, res: Response) => {
  const organizationId = getOrganizationId(req);
  const { folderId, category, search, limit = '50', offset = '0' } = req.query as ListMediaAssetsQuery;

  try {
    let query = `
      SELECT
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
      WHERE organization_id = $1
    `;
    const params: any[] = [organizationId];
    let paramIndex = 2;

    if (folderId) {
      query += ` AND folder_id = $${paramIndex}`;
      params.push(folderId);
      paramIndex++;
    }

    if (category) {
      query += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    if (search) {
      query += ` AND (name ILIKE $${paramIndex} OR filename ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Get total count
    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM media_assets WHERE organization_id = $1${
        folderId ? ` AND folder_id = $${folderId ? 2 : 0}` : ''
      }${category ? ` AND category = $${category ? (folderId ? 3 : 2) : 0}` : ''}`,
      folderId ? (category ? [organizationId, folderId, category] : [organizationId, folderId]) :
      (category ? [organizationId, category] : [organizationId])
    );

    // Add ordering and pagination
    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit as string) || 50);
    params.push(parseInt(offset as string) || 0);

    const result = await db.query(query, params);

    // Add public URLs
    const assets: MediaAssetWithUrl[] = result.rows.map((row: MediaAsset) => ({
      ...row,
      publicUrl: getPublicUrl(row.accessToken, row.filename),
    }));

    res.json({
      success: true,
      data: {
        assets,
        total: parseInt(countResult.rows[0]?.total || '0'),
        limit: parseInt(limit as string) || 50,
        offset: parseInt(offset as string) || 0,
      },
    });
  } catch (error: any) {
    logger.error('Failed to list assets', { organizationId, error: error.message });
    res.status(500).json({ success: false, error: 'Failed to list assets' });
  }
});

/**
 * GET /api/assets/:id
 * Get a single asset by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  const organizationId = getOrganizationId(req);
  const { id } = req.params;

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
      WHERE id = $1 AND organization_id = $2`,
      [id, organizationId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Asset not found' });
    }

    const asset: MediaAssetWithUrl = {
      ...result.rows[0],
      publicUrl: getPublicUrl(result.rows[0].accessToken, result.rows[0].filename),
    };

    res.json({ success: true, data: asset });
  } catch (error: any) {
    logger.error('Failed to get asset', { organizationId, id, error: error.message });
    res.status(500).json({ success: false, error: 'Failed to get asset' });
  }
});

/**
 * POST /api/assets
 * Register an existing storage file as an asset
 */
router.post('/', async (req: Request, res: Response) => {
  const organizationId = getOrganizationId(req);
  const userId = getUserId(req);
  const body: CreateMediaAssetRequest = req.body;

  if (!body.name || !body.filename || !body.mimeType || !body.storagePath) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: name, filename, mimeType, storagePath',
    });
  }

  try {
    // Get settings to determine storage type
    const settings = await mediaAssetStorageService.getSettings(organizationId);
    const storageType = body.storageType || settings?.storageBackend || 'google_drive';

    const result = await db.query(
      `INSERT INTO media_assets (
        organization_id,
        storage_type,
        storage_path,
        name,
        filename,
        mime_type,
        size_bytes,
        folder_id,
        category,
        is_public,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10)
      RETURNING
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
        updated_at as "updatedAt"`,
      [
        organizationId,
        storageType,
        body.storagePath,
        body.name,
        body.filename,
        body.mimeType,
        body.sizeBytes || null,
        body.folderId || null,
        body.category || null,
        userId,
      ]
    );

    const asset: MediaAssetWithUrl = {
      ...result.rows[0],
      publicUrl: getPublicUrl(result.rows[0].accessToken, result.rows[0].filename),
    };

    logger.info('Asset registered', { organizationId, assetId: asset.id, name: asset.name });
    res.status(201).json({ success: true, data: asset });
  } catch (error: any) {
    logger.error('Failed to register asset', { organizationId, error: error.message });
    res.status(500).json({ success: false, error: 'Failed to register asset' });
  }
});

/**
 * PUT /api/assets/:id
 * Update asset metadata
 */
router.put('/:id', async (req: Request, res: Response) => {
  const organizationId = getOrganizationId(req);
  const { id } = req.params;
  const body: UpdateMediaAssetRequest = req.body;

  try {
    // Build dynamic update query
    const updates: string[] = [];
    const params: any[] = [id, organizationId];
    let paramIndex = 3;

    if (body.name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      params.push(body.name);
      paramIndex++;
    }

    if (body.folderId !== undefined) {
      updates.push(`folder_id = $${paramIndex}`);
      params.push(body.folderId || null);
      paramIndex++;
    }

    if (body.category !== undefined) {
      updates.push(`category = $${paramIndex}`);
      params.push(body.category || null);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    const result = await db.query(
      `UPDATE media_assets
       SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $1 AND organization_id = $2
       RETURNING
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
         updated_at as "updatedAt"`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Asset not found' });
    }

    const asset: MediaAssetWithUrl = {
      ...result.rows[0],
      publicUrl: getPublicUrl(result.rows[0].accessToken, result.rows[0].filename),
    };

    res.json({ success: true, data: asset });
  } catch (error: any) {
    logger.error('Failed to update asset', { organizationId, id, error: error.message });
    res.status(500).json({ success: false, error: 'Failed to update asset' });
  }
});

/**
 * DELETE /api/assets/:id
 * Delete an asset
 */
router.delete('/:id', async (req: Request, res: Response) => {
  const organizationId = getOrganizationId(req);
  const { id } = req.params;

  try {
    // Get asset info first
    const assetResult = await db.query(
      `SELECT storage_type, storage_path, access_token
       FROM media_assets
       WHERE id = $1 AND organization_id = $2`,
      [id, organizationId]
    );

    if (assetResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Asset not found' });
    }

    const asset = assetResult.rows[0];

    // Delete from storage (optional - might want to keep file)
    const deleteFromStorage = req.query.deleteFile === 'true';
    if (deleteFromStorage) {
      await mediaAssetStorageService.deleteFile(
        organizationId,
        asset.storage_path,
        asset.storage_type as StorageBackend
      );
    }

    // Invalidate cache
    await mediaAssetCacheService.invalidate(asset.access_token);

    // Delete from database
    await db.query(
      'DELETE FROM media_assets WHERE id = $1 AND organization_id = $2',
      [id, organizationId]
    );

    logger.info('Asset deleted', { organizationId, assetId: id, deletedFromStorage: deleteFromStorage });
    res.json({ success: true, message: 'Asset deleted' });
  } catch (error: any) {
    logger.error('Failed to delete asset', { organizationId, id, error: error.message });
    res.status(500).json({ success: false, error: 'Failed to delete asset' });
  }
});

// ============================================================================
// Asset Upload Route (TASK-ASSET-010)
// ============================================================================

/**
 * POST /api/assets/upload
 * Upload a new file and register as asset
 */
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  const organizationId = getOrganizationId(req);
  const userId = getUserId(req);

  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No file provided' });
  }

  const { name, folderId, category } = req.body;
  const file = req.file;

  // Validate mime type
  const settings = await mediaAssetStorageService.getSettings(organizationId);
  const allowedTypes = settings?.allowedMimeTypes || [
    'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml', 'image/x-icon'
  ];

  if (!allowedTypes.includes(file.mimetype)) {
    return res.status(400).json({
      success: false,
      error: `File type not allowed. Allowed types: ${allowedTypes.join(', ')}`,
    });
  }

  // Validate file size
  const maxSizeMb = settings?.maxFileSizeMb || 10;
  if (file.size > maxSizeMb * 1024 * 1024) {
    return res.status(400).json({
      success: false,
      error: `File too large. Maximum size: ${maxSizeMb}MB`,
    });
  }

  try {
    // Get Drive folder ID if folderId provided
    let driveFolderId: string | undefined;
    if (folderId) {
      const folderResult = await db.query(
        'SELECT drive_folder_id FROM media_asset_folders WHERE id = $1 AND organization_id = $2',
        [folderId, organizationId]
      );
      if (folderResult.rows.length > 0 && folderResult.rows[0].drive_folder_id) {
        driveFolderId = folderResult.rows[0].drive_folder_id;
      }
    }

    // Upload to storage
    const uploadResult = await mediaAssetStorageService.uploadFile(
      organizationId,
      file.buffer,
      file.originalname,
      file.mimetype,
      driveFolderId
    );

    if (!uploadResult.success || !uploadResult.result) {
      return res.status(500).json({
        success: false,
        error: uploadResult.error || 'Failed to upload file to storage',
      });
    }

    // Register asset in database
    const result = await db.query(
      `INSERT INTO media_assets (
        organization_id,
        storage_type,
        storage_path,
        name,
        filename,
        mime_type,
        size_bytes,
        folder_id,
        category,
        is_public,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10)
      RETURNING
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
        updated_at as "updatedAt"`,
      [
        organizationId,
        settings?.storageBackend || 'google_drive',
        uploadResult.result.storagePath,
        name || file.originalname,
        file.originalname,
        file.mimetype,
        file.size,
        folderId || null,
        category || null,
        userId,
      ]
    );

    const asset: MediaAssetWithUrl = {
      ...result.rows[0],
      publicUrl: getPublicUrl(result.rows[0].accessToken, result.rows[0].filename),
    };

    logger.info('Asset uploaded', { organizationId, assetId: asset.id, filename: file.originalname });
    res.status(201).json({ success: true, data: asset });
  } catch (error: any) {
    logger.error('Failed to upload asset', { organizationId, error: error.message });
    res.status(500).json({ success: false, error: 'Failed to upload asset' });
  }
});

// ============================================================================
// Folder Management Routes (TASK-ASSET-011)
// ============================================================================

/**
 * GET /api/assets/folders
 * Get folder tree for organization
 */
router.get('/folders', async (req: Request, res: Response) => {
  const organizationId = getOrganizationId(req);

  try {
    const result = await db.query(
      `SELECT
        id,
        organization_id as "organizationId",
        name,
        path,
        parent_id as "parentId",
        drive_folder_id as "driveFolderId",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM media_asset_folders
      WHERE organization_id = $1
      ORDER BY path`,
      [organizationId]
    );

    // Build tree structure
    const folders = result.rows as MediaAssetFolder[];
    const folderMap = new Map<string, FolderTreeNode>();
    const rootFolders: FolderTreeNode[] = [];

    // First pass: create all nodes
    for (const folder of folders) {
      folderMap.set(folder.id, {
        id: folder.id,
        name: folder.name,
        path: folder.path,
        driveFolderId: folder.driveFolderId,
        children: [],
      });
    }

    // Second pass: build tree
    for (const folder of folders) {
      const node = folderMap.get(folder.id)!;
      if (folder.parentId && folderMap.has(folder.parentId)) {
        folderMap.get(folder.parentId)!.children.push(node);
      } else {
        rootFolders.push(node);
      }
    }

    res.json({ success: true, data: rootFolders });
  } catch (error: any) {
    logger.error('Failed to get folders', { organizationId, error: error.message });
    res.status(500).json({ success: false, error: 'Failed to get folders' });
  }
});

/**
 * POST /api/assets/folders
 * Create a new folder
 */
router.post('/folders', async (req: Request, res: Response) => {
  const organizationId = getOrganizationId(req);
  const body: CreateMediaAssetFolderRequest = req.body;

  if (!body.name) {
    return res.status(400).json({ success: false, error: 'Folder name is required' });
  }

  try {
    // Determine parent folder and path
    let parentId: string | null = null;
    let parentPath = '';

    if (body.parentPath) {
      const parentResult = await db.query(
        'SELECT id, path FROM media_asset_folders WHERE organization_id = $1 AND path = $2',
        [organizationId, body.parentPath]
      );
      if (parentResult.rows.length > 0) {
        parentId = parentResult.rows[0].id;
        parentPath = parentResult.rows[0].path;
      }
    }

    const folderPath = parentPath ? `${parentPath}/${body.name.toLowerCase().replace(/\s+/g, '-')}` : `/${body.name.toLowerCase().replace(/\s+/g, '-')}`;

    // Check if path already exists
    const existingResult = await db.query(
      'SELECT id FROM media_asset_folders WHERE organization_id = $1 AND path = $2',
      [organizationId, folderPath]
    );
    if (existingResult.rows.length > 0) {
      return res.status(409).json({ success: false, error: 'Folder with this path already exists' });
    }

    // Create folder in storage (Google Drive)
    let driveFolderId: string | null = null;
    const settings = await mediaAssetStorageService.getSettings(organizationId);

    if (settings?.isConfigured && settings.storageBackend === 'google_drive') {
      let driveParentId: string | undefined;

      if (parentId) {
        const parentFolderResult = await db.query(
          'SELECT drive_folder_id FROM media_asset_folders WHERE id = $1',
          [parentId]
        );
        if (parentFolderResult.rows.length > 0) {
          driveParentId = parentFolderResult.rows[0].drive_folder_id;
        }
      } else if (settings.driveSharedDriveId) {
        driveParentId = settings.driveSharedDriveId;
      }

      const createResult = await mediaAssetStorageService.createFolder(organizationId, body.name, driveParentId);
      if (createResult.success && createResult.folderId) {
        driveFolderId = createResult.folderId;
      }
    }

    // Insert folder record
    const result = await db.query(
      `INSERT INTO media_asset_folders (organization_id, name, path, parent_id, drive_folder_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING
         id,
         organization_id as "organizationId",
         name,
         path,
         parent_id as "parentId",
         drive_folder_id as "driveFolderId",
         created_at as "createdAt",
         updated_at as "updatedAt"`,
      [organizationId, body.name, folderPath, parentId, driveFolderId]
    );

    logger.info('Folder created', { organizationId, folderId: result.rows[0].id, path: folderPath });
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    logger.error('Failed to create folder', { organizationId, error: error.message });
    res.status(500).json({ success: false, error: 'Failed to create folder' });
  }
});

/**
 * DELETE /api/assets/folders/:id
 * Delete a folder (must be empty)
 */
router.delete('/folders/:id', async (req: Request, res: Response) => {
  const organizationId = getOrganizationId(req);
  const { id } = req.params;

  try {
    // Check if folder exists
    const folderResult = await db.query(
      'SELECT id, path FROM media_asset_folders WHERE id = $1 AND organization_id = $2',
      [id, organizationId]
    );

    if (folderResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Folder not found' });
    }

    // Check if folder has children
    const childrenResult = await db.query(
      'SELECT COUNT(*) as count FROM media_asset_folders WHERE parent_id = $1',
      [id]
    );
    if (parseInt(childrenResult.rows[0].count) > 0) {
      return res.status(400).json({ success: false, error: 'Cannot delete folder with subfolders' });
    }

    // Check if folder has assets
    const assetsResult = await db.query(
      'SELECT COUNT(*) as count FROM media_assets WHERE folder_id = $1',
      [id]
    );
    if (parseInt(assetsResult.rows[0].count) > 0) {
      return res.status(400).json({ success: false, error: 'Cannot delete folder with assets' });
    }

    // Delete folder
    await db.query('DELETE FROM media_asset_folders WHERE id = $1', [id]);

    logger.info('Folder deleted', { organizationId, folderId: id });
    res.json({ success: true, message: 'Folder deleted' });
  } catch (error: any) {
    logger.error('Failed to delete folder', { organizationId, id, error: error.message });
    res.status(500).json({ success: false, error: 'Failed to delete folder' });
  }
});

// ============================================================================
// Asset Settings Routes (TASK-ASSET-012)
// ============================================================================

/**
 * GET /api/assets/settings
 * Get asset storage settings
 */
router.get('/settings', async (req: Request, res: Response) => {
  const organizationId = getOrganizationId(req);

  try {
    const settings = await mediaAssetStorageService.getSettings(organizationId);

    if (!settings) {
      // Return defaults
      return res.json({
        success: true,
        data: {
          organizationId,
          storageBackend: 'google_drive',
          driveSharedDriveId: null,
          driveRootFolderId: null,
          cacheTtlSeconds: 3600,
          maxFileSizeMb: 10,
          allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml', 'image/x-icon'],
          isConfigured: false,
        },
      });
    }

    res.json({ success: true, data: settings });
  } catch (error: any) {
    logger.error('Failed to get asset settings', { organizationId, error: error.message });
    res.status(500).json({ success: false, error: 'Failed to get settings' });
  }
});

/**
 * PUT /api/assets/settings
 * Update asset storage settings
 */
router.put('/settings', async (req: Request, res: Response) => {
  const organizationId = getOrganizationId(req);
  const body: UpdateMediaAssetSettingsRequest = req.body;

  try {
    const result = await mediaAssetStorageService.updateSettings(organizationId, {
      storageBackend: body.storageBackend,
      cacheTtlSeconds: body.cacheTtlSeconds,
      maxFileSizeMb: body.maxFileSizeMb,
      allowedMimeTypes: body.allowedMimeTypes,
    });

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    const settings = await mediaAssetStorageService.getSettings(organizationId);
    res.json({ success: true, data: settings });
  } catch (error: any) {
    logger.error('Failed to update asset settings', { organizationId, error: error.message });
    res.status(500).json({ success: false, error: 'Failed to update settings' });
  }
});

/**
 * GET /api/assets/status
 * Get asset storage setup status
 */
router.get('/status', async (req: Request, res: Response) => {
  const organizationId = getOrganizationId(req);

  try {
    const status = await mediaAssetStorageService.getStatus(organizationId);
    const settings = await mediaAssetStorageService.getSettings(organizationId);

    // Get folder and asset counts
    const folderCountResult = await db.query(
      'SELECT COUNT(*) as count FROM media_asset_folders WHERE organization_id = $1',
      [organizationId]
    );
    const assetCountResult = await db.query(
      'SELECT COUNT(*) as count FROM media_assets WHERE organization_id = $1',
      [organizationId]
    );

    // Check if Google Workspace is configured
    const gwResult = await db.query(
      `SELECT is_enabled FROM organization_modules om
       JOIN modules m ON om.module_id = m.id
       WHERE om.organization_id = $1 AND m.slug = 'google_workspace'`,
      [organizationId]
    );

    const setupStatus: MediaAssetSetupStatus = {
      isConfigured: status.isConfigured,
      storageBackend: status.backend,
      hasGoogleWorkspace: gwResult.rows.length > 0 && gwResult.rows[0].is_enabled,
      hasDriveAccess: status.canUpload,
      sharedDriveName: settings?.driveSharedDriveId ? 'Helios Assets' : undefined,
      folderCount: parseInt(folderCountResult.rows[0]?.count || '0'),
      assetCount: parseInt(assetCountResult.rows[0]?.count || '0'),
    };

    res.json({ success: true, data: setupStatus });
  } catch (error: any) {
    logger.error('Failed to get asset status', { organizationId, error: error.message });
    res.status(500).json({ success: false, error: 'Failed to get status' });
  }
});

/**
 * POST /api/assets/setup
 * Initialize asset storage (create Shared Drive, folders, etc.)
 */
router.post('/setup', async (req: Request, res: Response) => {
  const organizationId = getOrganizationId(req);
  const { backend = 'google_drive' } = req.body;

  try {
    const result = await mediaAssetStorageService.setupStorage(organizationId, backend as StorageBackend);

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    // Get updated status
    const status = await mediaAssetStorageService.getStatus(organizationId);

    logger.info('Asset storage setup complete', { organizationId, backend });
    res.json({ success: true, data: status });
  } catch (error: any) {
    logger.error('Failed to setup asset storage', { organizationId, error: error.message });
    res.status(500).json({ success: false, error: 'Failed to setup storage' });
  }
});

export default router;
