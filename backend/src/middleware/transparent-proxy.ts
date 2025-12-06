/**
 * Transparent Proxy Middleware
 *
 * Proxies Google Workspace API calls through Helios for:
 * - Full audit trail
 * - Actor attribution (user/service/vendor)
 * - Intelligent sync to Helios database
 *
 * Usage:
 *   User calls: POST /api/google/admin/directory/v1/users
 *   Helios proxies to: https://admin.googleapis.com/admin/directory/v1/users
 *   Result: Google's response + audit log + DB sync
 */

import { Router, Request, Response, NextFunction } from 'express';
import { google } from 'googleapis';
import { db } from '../database/connection';
import { logger } from '../utils/logger';
import { authenticateToken } from './auth';
import axios from 'axios';

// Extend Express Request type for API keys
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        role: string;
        organizationId: string;
        firstName?: string;
        lastName?: string;
        keyType?: 'service' | 'vendor';
        apiKeyId?: string;
        apiKeyName?: string;
        serviceName?: string;
        serviceEmail?: string;
        serviceOwner?: string;
        vendorName?: string;
      };
      apiKey?: {
        id: string;
        name: string;
        type: 'service' | 'vendor';
        organizationId: string;
        permissions: string[];
        vendorConfig?: any;
        serviceConfig?: any;
      };
      actorContext?: {
        type: string;
        name: string;
        email: string;
        id?: string;
        clientReference?: string;
      };
    }
  }
}

export const transparentProxyRouter = Router();

// ===== INTERFACES =====

interface ProxyRequest {
  method: string;
  path: string;
  body: any;
  query: any;
  headers: any;
}

interface Actor {
  type: 'user' | 'service' | 'vendor';
  id: string;
  name: string;
  email: string;
  vendorName?: string;
  serviceName?: string;
  serviceOwner?: string;
}

interface GoogleCredentials {
  client_email: string;
  private_key: string;
  admin_email: string;
}

// ===== MAIN PROXY ROUTE =====

/**
 * Combined authentication middleware for transparent proxy
 * Accepts BOTH JWT tokens AND API keys
 */
const combinedAuth = (req: Request, res: Response, next: NextFunction): void => {
  // If API key is set (by api-key-auth middleware), populate req.user from it
  if (req.apiKey) {
    req.user = {
      userId: req.apiKey.id,
      email: req.actorContext?.email || 'api-key',
      role: 'admin', // API keys have admin-level access
      organizationId: req.apiKey.organizationId,
      keyType: req.apiKey.type,
      apiKeyId: req.apiKey.id,
      apiKeyName: req.apiKey.name,
      serviceName: req.apiKey.serviceConfig?.serviceName,
      serviceEmail: req.apiKey.serviceConfig?.serviceEmail,
      serviceOwner: req.apiKey.serviceConfig?.serviceOwner,
      vendorName: req.apiKey.vendorConfig?.vendorName,
      firstName: req.actorContext?.name?.split(' ')[0],
      lastName: req.actorContext?.name?.split(' ').slice(1).join(' ')
    };
    return next();
  }

  // Otherwise, use JWT authentication
  authenticateToken(req, res, next);
};

/**
 * Catch-all route for Google Workspace API proxying
 *
 * Matches any route starting with /api/google/*
 * Examples:
 *   POST /api/google/admin/directory/v1/users
 *   GET  /api/google/admin/directory/v1/groups
 *   POST /api/google/gmail/v1/users/:userId/settings/delegates
 */
transparentProxyRouter.all('/api/google/*', combinedAuth, async (req: Request, res: Response) => {
  const startTime = Date.now();
  let auditLogId: string | null = null;

  try {
    // 1. EXTRACT GOOGLE API PATH
    // /api/google/admin/directory/v1/users → admin/directory/v1/users
    const googleApiPath = req.path.replace('/api/google/', '');

    logger.info('Proxy request received', {
      method: req.method,
      path: googleApiPath,
      organizationId: req.user?.organizationId
    });

    // 2. EXTRACT ACTOR INFORMATION
    const actor = extractActor(req);

    // 3. CREATE AUDIT LOG ENTRY (START)
    auditLogId = await createAuditLogEntry({
      organizationId: req.user?.organizationId,
      actor,
      method: req.method,
      path: googleApiPath,
      body: req.body,
      query: req.query
    });

    // 4. GET GOOGLE CREDENTIALS
    const googleCreds = await getGoogleCredentials(req.user?.organizationId);

    if (!googleCreds) {
      await updateAuditLogEntry(auditLogId, {
        status: 'failure',
        statusCode: 400,
        error: 'Google Workspace not configured',
        duration: Date.now() - startTime
      });

      return res.status(400).json({
        success: false,
        error: 'Google Workspace not configured for this organization'
      });
    }

    // 5. PROXY TO GOOGLE
    const googleResponse = await proxyToGoogle({
      method: req.method,
      path: googleApiPath,
      body: req.body,
      query: req.query,
      headers: req.headers
    }, googleCreds);

    // 6. INTELLIGENT SYNC
    await intelligentSync({
      method: req.method,
      path: googleApiPath,
      response: googleResponse,
      organizationId: req.user?.organizationId
    });

    // 7. UPDATE AUDIT LOG (SUCCESS)
    await updateAuditLogEntry(auditLogId, {
      status: 'success',
      statusCode: googleResponse.status,
      responseBody: googleResponse.data,
      duration: Date.now() - startTime
    });

    // 8. RETURN GOOGLE'S RESPONSE
    return res.status(googleResponse.status).json(googleResponse.data);

  } catch (error: any) {
    logger.error('Proxy request failed', {
      error: error.message,
      stack: error.stack,
      path: req.path
    });

    // Update audit log with error
    if (auditLogId) {
      await updateAuditLogEntry(auditLogId, {
        status: 'failure',
        statusCode: error.response?.status || 500,
        error: error.message,
        responseBody: error.response?.data,
        duration: Date.now() - startTime
      });
    }

    // Return error response
    const statusCode = error.response?.status || 500;
    const errorData = error.response?.data || {
      error: {
        code: statusCode,
        message: error.message,
        status: 'INTERNAL_ERROR'
      }
    };

    return res.status(statusCode).json(errorData);
  }
});

// ===== HELPER FUNCTIONS =====

/**
 * Extract actor information from request
 */
function extractActor(req: Request): Actor {
  const user = req.user as any; // Type assertion for API key fields

  // Service API Key
  if (user?.keyType === 'service') {
    return {
      type: 'service',
      id: user.apiKeyId || 'unknown',
      name: user.apiKeyName || 'Unknown Service',
      email: user.serviceEmail || 'service',
      serviceName: user.serviceName,
      serviceOwner: user.serviceOwner
    };
  }

  // Vendor API Key (requires X-Actor-Name and X-Actor-Email headers)
  if (user?.keyType === 'vendor') {
    return {
      type: 'vendor',
      id: user.apiKeyId || 'unknown',
      name: req.headers['x-actor-name'] as string || 'Unknown',
      email: req.headers['x-actor-email'] as string || 'unknown',
      vendorName: user.vendorName
    };
  }

  // Regular User
  return {
    type: 'user',
    id: user?.userId || 'unknown',
    name: `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || req.user?.email || 'Unknown User',
    email: req.user?.email || 'unknown'
  };
}

/**
 * Get Google Workspace credentials for organization
 */
async function getGoogleCredentials(organizationId?: string): Promise<GoogleCredentials | null> {
  if (!organizationId) {
    return null;
  }

  try {
    const result = await db.query(
      'SELECT service_account_key, admin_email FROM gw_credentials WHERE organization_id = $1',
      [organizationId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const serviceAccountKey = JSON.parse(result.rows[0].service_account_key);

    return {
      client_email: serviceAccountKey.client_email,
      private_key: serviceAccountKey.private_key,
      admin_email: result.rows[0].admin_email
    };
  } catch (error) {
    logger.error('Failed to get Google credentials', { organizationId, error });
    return null;
  }
}

/**
 * Proxy request to Google Admin SDK
 * Uses Google SDK clients directly to avoid JWT scope/audience bugs
 */
async function proxyToGoogle(
  proxyRequest: ProxyRequest,
  credentials: GoogleCredentials
): Promise<{ status: number; data: any; headers: any }> {

  // Use manual JWT token generation to avoid Google Auth Library bugs
  // Build JWT manually and exchange for access token
  const jwt = require('jsonwebtoken');

  const now = Math.floor(Date.now() / 1000);
  const jwtPayload = {
    iss: credentials.client_email,
    scope: [
      'https://www.googleapis.com/auth/admin.directory.user',
      'https://www.googleapis.com/auth/admin.directory.group',
      'https://www.googleapis.com/auth/admin.directory.orgunit',
      'https://www.googleapis.com/auth/admin.directory.domain'
    ].join(' '),
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
    sub: credentials.admin_email
  };

  const signedJWT = jwt.sign(jwtPayload, credentials.private_key, {
    algorithm: 'RS256'
  });

  logger.info('JWT signed', {
    subject: credentials.admin_email,
    scopes: jwtPayload.scope
  });

  // Exchange JWT for access token
  const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: signedJWT
  });

  const accessToken = tokenResponse.data.access_token;

  if (!accessToken) {
    throw new Error('Failed to obtain access token from Google');
  }

  logger.info('Access token obtained', {
    hasToken: !!accessToken,
    expiresIn: tokenResponse.data.expires_in
  });

  // Build URL for Google Admin API
  const baseUrl = 'https://admin.googleapis.com';
  const url = `${baseUrl}/${proxyRequest.path}`;

  logger.info('Proxying to Google Admin API', {
    method: proxyRequest.method,
    url,
    hasBody: !!proxyRequest.body,
    hasQuery: !!proxyRequest.query && Object.keys(proxyRequest.query).length > 0
  });

  // Use axios with Bearer token to avoid SDK bugs
  try {
    const requestConfig: any = {
      method: proxyRequest.method,
      url: url,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    };

    // Add query parameters
    if (proxyRequest.query && Object.keys(proxyRequest.query).length > 0) {
      requestConfig.params = proxyRequest.query;
    }

    // Add body for POST/PUT/PATCH
    if (['POST', 'PUT', 'PATCH'].includes(proxyRequest.method.toUpperCase()) && proxyRequest.body) {
      requestConfig.data = proxyRequest.body;
    }

    logger.info('Axios request config', {
      method: requestConfig.method,
      url: requestConfig.url,
      hasParams: !!requestConfig.params,
      hasData: !!requestConfig.data
    });

    const response = await axios(requestConfig);

    logger.info('Google API request successful', {
      status: response.status,
      hasData: !!response.data
    });

    return {
      status: response.status,
      data: response.data,
      headers: response.headers
    };

  } catch (error: any) {
    logger.error('Google API request failed', {
      path: proxyRequest.path,
      method: proxyRequest.method,
      error: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    });

    throw {
      status: error.response?.status || 500,
      message: error.message,
      data: error.response?.data
    };
  }
}

/**
 * Create audit log entry for proxy request
 */
async function createAuditLogEntry(params: {
  organizationId?: string;
  actor: Actor;
  method: string;
  path: string;
  body: any;
  query: any;
}): Promise<string> {
  // Determine user_id and actor_id based on actor type
  let userId = null;
  let actorId = null;

  if (params.actor.type === 'user') {
    // For regular users, set both user_id and actor_id to the user's UUID
    userId = params.actor.id;
    actorId = params.actor.id;
  }
  // For service/vendor, both remain null (logged in metadata instead)

  const result = await db.query(`
    INSERT INTO activity_logs (
      organization_id,
      user_id,
      actor_id,
      action,
      resource_type,
      resource_id,
      description,
      metadata,
      ip_address,
      user_agent,
      created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
    RETURNING id
  `, [
    params.organizationId,
    userId,
    actorId,
    `google_api_${params.method.toLowerCase()}`,
    'google_api',
    params.path,
    `${params.method} ${params.path} via ${params.actor.type} (${params.actor.name})`,
    JSON.stringify({
      method: params.method,
      path: params.path,
      body: params.body,
      query: params.query,
      actor: {
        type: params.actor.type,
        id: params.actor.id,
        name: params.actor.name,
        email: params.actor.email,
        serviceName: params.actor.serviceName,
        serviceOwner: params.actor.serviceOwner,
        vendorName: params.actor.vendorName
      },
      status: 'in_progress'
    }),
    null, // IP address (can be extracted from req if needed)
    null  // User agent
  ]);

  return result.rows[0].id;
}

/**
 * Update audit log entry with results
 */
async function updateAuditLogEntry(
  auditLogId: string,
  update: {
    status: 'success' | 'failure';
    statusCode: number;
    responseBody?: any;
    error?: string;
    duration: number;
  }
): Promise<void> {
  await db.query(`
    UPDATE activity_logs
    SET
      metadata = metadata || $1::jsonb,
      created_at = created_at
    WHERE id = $2
  `, [
    JSON.stringify({
      status: update.status,
      statusCode: update.statusCode,
      responseBody: update.responseBody ? JSON.stringify(update.responseBody).substring(0, 5000) : null, // Limit size
      error: update.error,
      durationMs: update.duration,
      completedAt: new Date().toISOString()
    }),
    auditLogId
  ]);
}

/**
 * Intelligent sync - update Helios DB based on proxied request
 */
async function intelligentSync(params: {
  method: string;
  path: string;
  response: any;
  organizationId?: string;
}): Promise<void> {
  if (!params.organizationId) {
    return;
  }

  // Identify resource type from path
  const resourceType = identifyResourceType(params.path);

  if (!resourceType) {
    // Not a resource we sync (e.g., calendar, drive)
    logger.debug('Skipping sync for non-tracked resource', { path: params.path });
    return;
  }

  try {
    switch (resourceType) {
      case 'users':
        await syncUserResource(params);
        break;
      case 'groups':
        await syncGroupResource(params);
        break;
      case 'orgunits':
        await syncOrgUnitResource(params);
        break;
      default:
        logger.debug('No sync handler for resource type', { resourceType });
    }
  } catch (error: any) {
    logger.error('Intelligent sync failed', {
      resourceType,
      error: error.message,
      path: params.path
    });
    // Don't throw - sync failures shouldn't break the proxy
  }
}

/**
 * Identify resource type from API path
 */
function identifyResourceType(path: string): string | null {
  const pathLower = path.toLowerCase();

  if (pathLower.includes('admin/directory/v1/users')) return 'users';
  if (pathLower.includes('admin/directory/v1/groups')) return 'groups';
  if (pathLower.includes('admin/directory/v1/orgunits')) return 'orgunits';

  return null;
}

/**
 * Sync user resource changes to Helios DB
 */
async function syncUserResource(params: {
  method: string;
  path: string;
  response: any;
  organizationId?: string;
}): Promise<void> {
  const method = params.method.toUpperCase();
  const responseData = params.response.data;

  // CREATE USER (POST)
  if (method === 'POST' && responseData.id) {
    await db.query(`
      INSERT INTO organization_users (
        organization_id,
        email,
        first_name,
        last_name,
        google_workspace_id,
        is_active,
        user_status,
        platforms,
        org_unit_path,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      ON CONFLICT (organization_id, email)
      DO UPDATE SET
        google_workspace_id = EXCLUDED.google_workspace_id,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        org_unit_path = EXCLUDED.org_unit_path,
        updated_at = NOW()
    `, [
      params.organizationId,
      responseData.primaryEmail,
      responseData.name?.givenName,
      responseData.name?.familyName,
      responseData.id,
      !responseData.suspended,
      responseData.suspended ? 'suspended' : 'active',
      ['google_workspace'],
      responseData.orgUnitPath || '/'
    ]);

    logger.info('Synced user creation', {
      email: responseData.primaryEmail,
      googleId: responseData.id
    });
  }

  // DELETE USER (DELETE)
  else if (method === 'DELETE') {
    // Extract user key from path
    const userKey = extractUserKeyFromPath(params.path);

    await db.query(`
      UPDATE organization_users
      SET
        deleted_at = NOW(),
        user_status = 'deleted',
        is_active = false,
        updated_at = NOW()
      WHERE organization_id = $1
        AND (email = $2 OR google_workspace_id = $2)
    `, [params.organizationId, userKey]);

    logger.info('Synced user deletion', { userKey });
  }

  // UPDATE USER (PATCH/PUT)
  else if ((method === 'PATCH' || method === 'PUT') && responseData.id) {
    await db.query(`
      UPDATE organization_users
      SET
        first_name = COALESCE($1, first_name),
        last_name = COALESCE($2, last_name),
        is_active = $3,
        user_status = $4,
        org_unit_path = COALESCE($5, org_unit_path),
        updated_at = NOW()
      WHERE organization_id = $6
        AND google_workspace_id = $7
    `, [
      responseData.name?.givenName,
      responseData.name?.familyName,
      !responseData.suspended,
      responseData.suspended ? 'suspended' : 'active',
      responseData.orgUnitPath,
      params.organizationId,
      responseData.id
    ]);

    logger.info('Synced user update', { googleId: responseData.id });
  }

  // LIST USERS (GET)
  else if (method === 'GET' && responseData.users && Array.isArray(responseData.users)) {
    for (const user of responseData.users) {
      await db.query(`
        INSERT INTO organization_users (
          organization_id,
          email,
          first_name,
          last_name,
          google_workspace_id,
          is_active,
          user_status,
          platforms,
          org_unit_path,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        ON CONFLICT (organization_id, email)
        DO UPDATE SET
          google_workspace_id = EXCLUDED.google_workspace_id,
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          is_active = EXCLUDED.is_active,
          user_status = EXCLUDED.user_status,
          org_unit_path = EXCLUDED.org_unit_path,
          updated_at = NOW()
      `, [
        params.organizationId,
        user.primaryEmail,
        user.name?.givenName,
        user.name?.familyName,
        user.id,
        !user.suspended,
        user.suspended ? 'suspended' : 'active',
        ['google_workspace'],
        user.orgUnitPath || '/'
      ]);
    }

    logger.info('Synced user list', { count: responseData.users.length });
  }
}

/**
 * Sync group resource changes to Helios DB
 */
async function syncGroupResource(params: {
  method: string;
  path: string;
  response: any;
  organizationId?: string;
}): Promise<void> {
  const method = params.method.toUpperCase();
  const responseData = params.response.data;

  // CREATE GROUP
  if (method === 'POST' && responseData.id) {
    await db.query(`
      INSERT INTO access_groups (
        organization_id,
        name,
        email,
        description,
        google_workspace_id,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      ON CONFLICT (organization_id, email)
      DO UPDATE SET
        google_workspace_id = EXCLUDED.google_workspace_id,
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        updated_at = NOW()
    `, [
      params.organizationId,
      responseData.name,
      responseData.email,
      responseData.description,
      responseData.id
    ]);

    logger.info('Synced group creation', {
      email: responseData.email,
      googleId: responseData.id
    });
  }

  // DELETE GROUP
  else if (method === 'DELETE') {
    const groupKey = extractGroupKeyFromPath(params.path);

    await db.query(`
      DELETE FROM access_groups
      WHERE organization_id = $1
        AND (email = $2 OR google_workspace_id = $2)
    `, [params.organizationId, groupKey]);

    logger.info('Synced group deletion', { groupKey });
  }
}

/**
 * Sync org unit resource changes
 */
async function syncOrgUnitResource(params: {
  method: string;
  path: string;
  response: any;
  organizationId?: string;
}): Promise<void> {
  // TODO: Implement OU sync if needed
  logger.debug('OU sync not yet implemented');
}

/**
 * Extract user key from API path
 * Example: admin/directory/v1/users/john@company.com → john@company.com
 */
function extractUserKeyFromPath(path: string): string {
  const match = path.match(/users\/([^\/\?]+)/);
  return match ? match[1] : '';
}

/**
 * Extract group key from API path
 */
function extractGroupKeyFromPath(path: string): string {
  const match = path.match(/groups\/([^\/\?]+)/);
  return match ? match[1] : '';
}

export default transparentProxyRouter;
