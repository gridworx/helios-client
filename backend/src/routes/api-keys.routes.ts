import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { authenticateToken } from '../middleware/auth';
import { generateApiKey } from '../utils/apiKey';
import { db } from '../database/connection';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * POST /api/organization/api-keys
 * Create a new API key (Service or Vendor)
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name,
      description,
      type,
      permissions,
      expiresInDays,
      serviceConfig,
      vendorConfig,
      ipWhitelist,
      rateLimitConfig,
    } = req.body;

    // Validate required fields
    if (!name || !type) {
      res.status(400).json({
        success: false,
        error: 'Validation error',
        message: 'Name and type are required',
      });
      return;
    }

    // Validate type
    if (type !== 'service' && type !== 'vendor') {
      res.status(400).json({
        success: false,
        error: 'Validation error',
        message: 'Type must be "service" or "vendor"',
      });
      return;
    }

    // Validate permissions array
    if (!permissions || !Array.isArray(permissions)) {
      res.status(400).json({
        success: false,
        error: 'Validation error',
        message: 'Permissions must be an array',
      });
      return;
    }

    // For vendor keys, ensure vendorConfig is provided
    if (type === 'vendor' && !vendorConfig) {
      res.status(400).json({
        success: false,
        error: 'Validation error',
        message: 'Vendor configuration is required for vendor keys',
      });
      return;
    }

    // Get organization ID from authenticated user
    const organizationId = req.user?.organizationId;
    const createdBy = req.user?.userId;

    if (!organizationId) {
      res.status(400).json({
        success: false,
        error: 'Authentication error',
        message: 'Organization ID not found',
      });
      return;
    }

    // Generate API key
    const { key, hash, prefix } = generateApiKey();

    // Calculate expiration date
    let expiresAt = null;
    if (expiresInDays && expiresInDays > 0) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    }

    // Insert into database
    const result = await db.query(
      `INSERT INTO api_keys (
        organization_id,
        name,
        description,
        type,
        key_hash,
        key_prefix,
        permissions,
        expires_at,
        created_by,
        service_config,
        vendor_config,
        ip_whitelist,
        rate_limit_config
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id, name, type, key_prefix, created_at, expires_at`,
      [
        organizationId,
        name,
        description,
        type,
        hash,
        prefix,
        JSON.stringify(permissions),
        expiresAt,
        createdBy,
        serviceConfig ? JSON.stringify(serviceConfig) : null,
        vendorConfig ? JSON.stringify(vendorConfig) : null,
        ipWhitelist ? JSON.stringify(ipWhitelist) : null,
        rateLimitConfig ? JSON.stringify(rateLimitConfig) : null,
      ]
    );

    const createdKey = result.rows[0];

    logger.info('API key created', {
      keyId: createdKey.id,
      keyName: name,
      type,
      organizationId,
      createdBy,
    });

    // Return the key (ONLY ONCE!)
    res.status(201).json({
      success: true,
      data: {
        // Full key - shown only once!
        key,
        // Metadata
        id: createdKey.id,
        name: createdKey.name,
        type: createdKey.type,
        keyPrefix: createdKey.key_prefix,
        createdAt: createdKey.created_at,
        expiresAt: createdKey.expires_at,
      },
      message: 'API key created successfully. Save it securely - it will not be shown again.',
    });
  } catch (error: any) {
    logger.error('Failed to create API key', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      error: 'Failed to create API key',
      message: error.message,
    });
  }
});

/**
 * GET /api/organization/api-keys
 * List all API keys for the organization
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      res.status(400).json({
        success: false,
        error: 'Authentication error',
        message: 'Organization ID not found',
      });
      return;
    }

    // Optional filters
    const { status, type } = req.query;

    let query = `
      SELECT
        id,
        name,
        description,
        type,
        key_prefix,
        permissions,
        created_at,
        expires_at,
        is_active,
        last_used_at,
        vendor_config,
        service_config
      FROM api_keys
      WHERE organization_id = $1
    `;

    const params: any[] = [organizationId];

    // Filter by status
    if (status === 'active') {
      query += ' AND is_active = true AND (expires_at IS NULL OR expires_at > NOW())';
    } else if (status === 'expired') {
      query += ' AND expires_at IS NOT NULL AND expires_at <= NOW()';
    } else if (status === 'revoked') {
      query += ' AND is_active = false';
    }

    // Filter by type
    if (type === 'service' || type === 'vendor') {
      params.push(type);
      query += ` AND type = $${params.length}`;
    }

    query += ' ORDER BY created_at DESC';

    const result = await db.query(query, params);

    // Calculate status for each key
    const keys = result.rows.map((key: any) => {
      let status = 'active';
      if (!key.is_active) {
        status = 'revoked';
      } else if (key.expires_at && new Date(key.expires_at) <= new Date()) {
        status = 'expired';
      } else if (key.expires_at) {
        const daysUntilExpiry = Math.floor(
          (new Date(key.expires_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysUntilExpiry <= 14) {
          status = 'expiring_soon';
        }
      }

      return {
        id: key.id,
        name: key.name,
        description: key.description,
        type: key.type,
        keyPrefix: key.key_prefix,
        permissions: key.permissions,
        status,
        createdAt: key.created_at,
        expiresAt: key.expires_at,
        lastUsedAt: key.last_used_at,
        vendorConfig: key.vendor_config,
        serviceConfig: key.service_config,
      };
    });

    res.json({
      success: true,
      data: keys,
    });
  } catch (error: any) {
    logger.error('Failed to list API keys', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to list API keys',
      message: error.message,
    });
  }
});

/**
 * GET /api/organization/api-keys/:id
 * Get details of a specific API key
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const organizationId = req.user?.organizationId;

    const result = await db.query(
      `SELECT
        id,
        organization_id,
        name,
        description,
        type,
        key_prefix,
        permissions,
        created_at,
        created_by,
        expires_at,
        is_active,
        last_used_at,
        vendor_config,
        service_config,
        ip_whitelist,
        rate_limit_config
      FROM api_keys
      WHERE id = $1 AND organization_id = $2`,
      [id, organizationId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: 'API key not found',
      });
      return;
    }

    const key = result.rows[0];

    // Calculate status
    let status = 'active';
    if (!key.is_active) {
      status = 'revoked';
    } else if (key.expires_at && new Date(key.expires_at) <= new Date()) {
      status = 'expired';
    }

    res.json({
      success: true,
      data: {
        id: key.id,
        name: key.name,
        description: key.description,
        type: key.type,
        keyPrefix: key.key_prefix,
        permissions: key.permissions,
        status,
        createdAt: key.created_at,
        createdBy: key.created_by,
        expiresAt: key.expires_at,
        lastUsedAt: key.last_used_at,
        vendorConfig: key.vendor_config,
        serviceConfig: key.service_config,
        ipWhitelist: key.ip_whitelist,
        rateLimitConfig: key.rate_limit_config,
      },
    });
  } catch (error: any) {
    logger.error('Failed to get API key', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get API key',
      message: error.message,
    });
  }
});

/**
 * PATCH /api/organization/api-keys/:id
 * Update API key settings (permissions, expiration, etc.)
 */
router.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const organizationId = req.user?.organizationId;
    const { permissions, expiresAt, ipWhitelist, rateLimitConfig } = req.body;

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (permissions !== undefined) {
      updates.push(`permissions = $${paramIndex++}`);
      values.push(JSON.stringify(permissions));
    }

    if (expiresAt !== undefined) {
      updates.push(`expires_at = $${paramIndex++}`);
      values.push(expiresAt);
    }

    if (ipWhitelist !== undefined) {
      updates.push(`ip_whitelist = $${paramIndex++}`);
      values.push(JSON.stringify(ipWhitelist));
    }

    if (rateLimitConfig !== undefined) {
      updates.push(`rate_limit_config = $${paramIndex++}`);
      values.push(JSON.stringify(rateLimitConfig));
    }

    if (updates.length === 0) {
      res.status(400).json({
        success: false,
        error: 'No updates provided',
      });
      return;
    }

    // Add WHERE clause parameters
    values.push(id, organizationId);

    const query = `
      UPDATE api_keys
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex++} AND organization_id = $${paramIndex++}
      RETURNING id, name, type, key_prefix
    `;

    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: 'API key not found',
      });
      return;
    }

    logger.info('API key updated', {
      keyId: id,
      updates: Object.keys(req.body),
    });

    res.json({
      success: true,
      data: result.rows[0],
      message: 'API key updated successfully',
    });
  } catch (error: any) {
    logger.error('Failed to update API key', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to update API key',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/organization/api-keys/:id
 * Revoke (soft delete) an API key
 */
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const organizationId = req.user?.organizationId;

    const result = await db.query(
      `UPDATE api_keys
       SET is_active = false
       WHERE id = $1 AND organization_id = $2
       RETURNING id, name, type`,
      [id, organizationId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: 'API key not found',
      });
      return;
    }

    logger.info('API key revoked', {
      keyId: id,
      keyName: result.rows[0].name,
    });

    res.json({
      success: true,
      message: 'API key revoked successfully',
    });
  } catch (error: any) {
    logger.error('Failed to revoke API key', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to revoke API key',
      message: error.message,
    });
  }
});

/**
 * POST /api/organization/api-keys/:id/renew
 * Renew an expired API key (generates new key, keeps config)
 */
router.post('/:id/renew', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const organizationId = req.user?.organizationId;
    const { expiresInDays } = req.body;

    // Get existing key
    const existing = await db.query(
      `SELECT * FROM api_keys WHERE id = $1 AND organization_id = $2`,
      [id, organizationId]
    );

    if (existing.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: 'API key not found',
      });
      return;
    }

    const oldKey = existing.rows[0];

    // Generate new key
    const { key, hash, prefix } = generateApiKey();

    // Calculate new expiration
    let expiresAt = null;
    if (expiresInDays && expiresInDays > 0) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    }

    // Start transaction
    await db.query('BEGIN');

    try {
      // Revoke old key
      await db.query('UPDATE api_keys SET is_active = false WHERE id = $1', [id]);

      // Create new key with same config
      const result = await db.query(
        `INSERT INTO api_keys (
          organization_id,
          name,
          description,
          type,
          key_hash,
          key_prefix,
          permissions,
          expires_at,
          created_by,
          service_config,
          vendor_config,
          ip_whitelist,
          rate_limit_config
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id, name, type, key_prefix, created_at, expires_at`,
        [
          organizationId,
          oldKey.name,
          oldKey.description,
          oldKey.type,
          hash,
          prefix,
          oldKey.permissions,
          expiresAt,
          req.user?.userId,
          oldKey.service_config,
          oldKey.vendor_config,
          oldKey.ip_whitelist,
          oldKey.rate_limit_config,
        ]
      );

      await db.query('COMMIT');

      const newKey = result.rows[0];

      logger.info('API key renewed', {
        oldKeyId: id,
        newKeyId: newKey.id,
        keyName: newKey.name,
      });

      // Return new key (ONLY ONCE!)
      res.status(201).json({
        success: true,
        data: {
          key, // Full key - shown only once!
          id: newKey.id,
          name: newKey.name,
          type: newKey.type,
          keyPrefix: newKey.key_prefix,
          createdAt: newKey.created_at,
          expiresAt: newKey.expires_at,
        },
        message: 'API key renewed successfully. Save it securely - it will not be shown again.',
      });
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error: any) {
    logger.error('Failed to renew API key', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to renew API key',
      message: error.message,
    });
  }
});

/**
 * GET /api/organization/api-keys/:id/usage
 * Get usage history for an API key
 */
router.get('/:id/usage', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const organizationId = req.user?.organizationId;
    const { limit = 100, offset = 0 } = req.query;

    // Verify key belongs to organization
    const keyCheck = await db.query(
      'SELECT id FROM api_keys WHERE id = $1 AND organization_id = $2',
      [id, organizationId]
    );

    if (keyCheck.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: 'API key not found',
      });
      return;
    }

    // Get usage logs
    const result = await db.query(
      `SELECT
        id,
        timestamp,
        action,
        resource_type,
        resource_id,
        result,
        actor_type,
        actor_name,
        actor_email,
        client_reference,
        ip_address,
        user_agent,
        request_duration,
        http_method,
        http_path,
        http_status,
        error_message
      FROM api_key_usage_logs
      WHERE api_key_id = $1
      ORDER BY timestamp DESC
      LIMIT $2 OFFSET $3`,
      [id, limit, offset]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error: any) {
    logger.error('Failed to get API key usage', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get API key usage',
      message: error.message,
    });
  }
});

export default router;
