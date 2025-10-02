import { Router } from 'express';
import { db } from '../database/connection';
import { logger } from '../utils/logger';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// Platform overview/dashboard
router.get('/overview', asyncHandler(async (_req, res) => {
  try {
    // Get platform statistics
    const [
      tenantsResult,
      usersResult,
      pluginsResult,
      settingsResult
    ] = await Promise.all([
      db.query('SELECT COUNT(*) as count FROM tenants WHERE is_active = true'),
      db.query('SELECT COUNT(*) as count FROM users WHERE is_active = true AND role != \'platform_owner\''),
      db.query('SELECT COUNT(*) as count FROM plugins WHERE is_enabled = true'),
      db.query('SELECT key, value, is_public FROM platform_settings WHERE is_public = true OR key IN (\'platform_name\', \'platform_version\')')
    ]);

    const stats = {
      activeTenants: parseInt(tenantsResult.rows[0].count),
      totalUsers: parseInt(usersResult.rows[0].count),
      activePlugins: parseInt(pluginsResult.rows[0].count),
    };

    const settings = {};
    settingsResult.rows.forEach((row: any) => {
      (settings as any)[row.key] = row.value;
    });

    // Get recent activity (last 50 audit logs with full details)
    const recentActivityResult = await db.query(`
      SELECT
        al.id,
        al.action,
        al.resource,
        al.resource_id,
        al.timestamp,
        al.ip_address,
        al.user_agent,
        al.old_values,
        al.new_values,
        u.id as user_id,
        u.first_name,
        u.last_name,
        u.email,
        u.role,
        t.name as tenant_name,
        t.domain as tenant_domain
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      LEFT JOIN tenants t ON al.tenant_id = t.id
      ORDER BY al.timestamp DESC
      LIMIT 50
    `);

    res.json({
      success: true,
      data: {
        stats,
        settings,
        recentActivity: recentActivityResult.rows
      }
    });

  } catch (error) {
    logger.error('Failed to get platform overview', error);
    throw error;
  }
}));

// Get all plugins
router.get('/plugins', asyncHandler(async (_req, res) => {
  const plugins = await db.findMany('plugins');

  res.json({
    success: true,
    data: {
      plugins
    }
  });
}));

// Enable/disable plugin
router.put('/plugins/:pluginId/toggle', asyncHandler(async (req, res) => {
  const { pluginId } = req.params;

  const plugin = await db.findOne('plugins', { id: pluginId });

  if (!plugin) {
    return res.status(404).json({
      success: false,
      error: 'Plugin not found'
    });
  }

  const newEnabledState = !plugin.is_enabled;

  await db.update('plugins',
    { is_enabled: newEnabledState },
    { id: pluginId }
  );

  // Log the change
  // TODO: Get user from auth middleware
  await db.insert('audit_logs', {
    // user_id: req.user.id,
    action: 'update',
    resource: 'plugin',
    resource_id: pluginId,
    old_values: { is_enabled: plugin.is_enabled },
    new_values: { is_enabled: newEnabledState },
    ip_address: req.ip,
    user_agent: req.get('User-Agent')
  });

  logger.info(`Plugin ${plugin.name} ${newEnabledState ? 'enabled' : 'disabled'}`, {
    pluginId,
    pluginName: plugin.name,
    enabled: newEnabledState
  });

  res.json({
    success: true,
    message: `Plugin ${newEnabledState ? 'enabled' : 'disabled'} successfully`,
    data: {
      plugin: {
        ...plugin,
        is_enabled: newEnabledState
      }
    }
  });
}));

// Get platform settings
router.get('/settings', asyncHandler(async (_req, res) => {
  const settings = await db.findMany('platform_settings');

  res.json({
    success: true,
    data: {
      settings
    }
  });
}));

// Update platform setting
router.put('/settings/:key', asyncHandler(async (req, res) => {
  const { key } = req.params;
  const { value, description, isPublic } = req.body;

  if (!value) {
    return res.status(400).json({
      success: false,
      error: 'Value is required'
    });
  }

  const existingSetting = await db.findOne('platform_settings', { key });

  if (existingSetting) {
    const updatedSetting = await db.update('platform_settings',
      {
        value,
        ...(description !== undefined && { description }),
        ...(isPublic !== undefined && { is_public: isPublic })
      },
      { key }
    );

    res.json({
      success: true,
      message: 'Setting updated successfully',
      data: { setting: updatedSetting }
    });

  } else {
    const newSetting = await db.insert('platform_settings', {
      key,
      value,
      description: description || null,
      is_public: isPublic || false
    });

    res.json({
      success: true,
      message: 'Setting created successfully',
      data: { setting: newSetting }
    });
  }

  logger.info(`Platform setting updated: ${key}`, {
    key,
    value,
    description,
    isPublic
  });
}));

// Get all tenants (for platform owner)
router.get('/tenants', asyncHandler(async (_req, res) => {
  const tenants = await db.query(`
    SELECT
      t.*,
      COUNT(u.id) as user_count,
      MAX(u.last_login) as last_user_login
    FROM tenants t
    LEFT JOIN users u ON t.id = u.tenant_id AND u.is_active = true
    GROUP BY t.id
    ORDER BY t.created_at DESC
  `);

  res.json({
    success: true,
    data: {
      tenants: tenants.rows
    }
  });
}));

// Create new tenant
router.post('/tenants', asyncHandler(async (_req, res) => {
  // This will be implemented as we build the tenant creation flow
  res.status(501).json({
    success: false,
    error: 'Tenant creation not implemented yet'
  });
}));

// Get full audit logs with filters
router.get('/audit-logs', asyncHandler(async (req, res) => {
  const { limit = 100, offset = 0, action, resource, userId, startDate, endDate } = req.query;

  let query = `
    SELECT
      al.id,
      al.action,
      al.resource,
      al.resource_id,
      al.timestamp,
      al.ip_address,
      al.user_agent,
      al.old_values,
      al.new_values,
      u.id as user_id,
      u.first_name,
      u.last_name,
      u.email,
      u.role,
      t.id as tenant_id,
      t.name as tenant_name,
      t.domain as tenant_domain
    FROM audit_logs al
    LEFT JOIN users u ON al.user_id = u.id
    LEFT JOIN tenants t ON al.tenant_id = t.id
    WHERE 1=1
  `;

  const params: any[] = [];
  let paramIndex = 1;

  if (action) {
    query += ` AND al.action = $${paramIndex}`;
    params.push(action);
    paramIndex++;
  }

  if (resource) {
    query += ` AND al.resource = $${paramIndex}`;
    params.push(resource);
    paramIndex++;
  }

  if (userId) {
    query += ` AND al.user_id = $${paramIndex}`;
    params.push(userId);
    paramIndex++;
  }

  if (startDate) {
    query += ` AND al.timestamp >= $${paramIndex}`;
    params.push(startDate);
    paramIndex++;
  }

  if (endDate) {
    query += ` AND al.timestamp <= $${paramIndex}`;
    params.push(endDate);
    paramIndex++;
  }

  query += ` ORDER BY al.timestamp DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(parseInt(limit as string), parseInt(offset as string));

  const result = await db.query(query, params);

  res.json({
    success: true,
    data: {
      logs: result.rows,
      total: result.rowCount,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    }
  });
}));

// Export audit logs as CSV
router.get('/audit-logs/export', asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  let query = `
    SELECT
      al.timestamp,
      al.action,
      al.resource,
      al.resource_id,
      u.email as user_email,
      u.first_name || ' ' || u.last_name as user_name,
      u.role as user_role,
      al.ip_address,
      al.user_agent,
      t.name as tenant_name,
      t.domain as tenant_domain,
      al.old_values,
      al.new_values
    FROM audit_logs al
    LEFT JOIN users u ON al.user_id = u.id
    LEFT JOIN tenants t ON al.tenant_id = t.id
    WHERE 1=1
  `;

  const params: any[] = [];
  let paramIndex = 1;

  if (startDate) {
    query += ` AND al.timestamp >= $${paramIndex}`;
    params.push(startDate);
    paramIndex++;
  }

  if (endDate) {
    query += ` AND al.timestamp <= $${paramIndex}`;
    params.push(endDate);
    paramIndex++;
  }

  query += ` ORDER BY al.timestamp DESC`;

  const result = await db.query(query, params);

  // Convert to CSV
  const headers = [
    'Timestamp', 'Action', 'Resource', 'Resource ID', 'User Email', 'User Name',
    'User Role', 'IP Address', 'User Agent', 'Tenant Name', 'Tenant Domain',
    'Old Values', 'New Values'
  ];

  const csvRows = [headers.join(',')];

  result.rows.forEach((row: any) => {
    const values = [
      row.timestamp,
      row.action,
      row.resource,
      row.resource_id || '',
      row.user_email || '',
      row.user_name || '',
      row.user_role || '',
      row.ip_address || '',
      `"${(row.user_agent || '').replace(/"/g, '""')}"`,
      row.tenant_name || '',
      row.tenant_domain || '',
      row.old_values ? `"${JSON.stringify(row.old_values).replace(/"/g, '""')}"` : '',
      row.new_values ? `"${JSON.stringify(row.new_values).replace(/"/g, '""')}"` : ''
    ];
    csvRows.push(values.join(','));
  });

  const csv = csvRows.join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=helios-audit-logs-${new Date().toISOString()}.csv`);
  res.send(csv);
}));

// Check if any tenants are configured (for Client Portal routing)
router.get('/tenants/check', asyncHandler(async (_req, res) => {
  const result = await db.query('SELECT COUNT(*) as count FROM tenants');
  const count = parseInt(result.rows[0].count);

  res.json({
    success: true,
    hasTenantsConfigured: count > 0,
    tenantCount: count
  });
}));

export { router as platformRoutes };