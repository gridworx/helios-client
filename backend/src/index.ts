// Load environment variables FIRST before any imports that use them
import dotenv from 'dotenv';
import path from 'path';
// .env is in project root, two levels up from src/
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

// Validate environment variables immediately after loading
import { validateEnv } from './config/env-validation';
try {
  validateEnv();
  console.log(`✅ Environment validated (${process.env['NODE_ENV'] || 'development'} mode)`);
} catch (error) {
  console.error('❌ Environment validation failed. Exiting...');
  process.exit(1);
}

import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { logger } from './utils/logger';
import { db } from './database/connection';
import { dbInitializer } from './database/init';
import { errorHandler } from './middleware/errorHandler';
// import { setupRoutes } from './routes/setup.routes';
// import { platformRoutes } from './routes/platform.routes';
import userRoutes from './routes/user.routes';
import authRoutes from './routes/auth.routes';
import GoogleWorkspaceRoutes from './routes/google-workspace.routes';
import modulesRoutes from './routes/modules.routes';
import organizationRoutes from './routes/organization.routes';
import apiKeysRoutes from './routes/api-keys.routes';
import labelsRoutes from './routes/labels.routes';
import workspacesRoutes from './routes/workspaces.routes';
import accessGroupsRoutes from './routes/access-groups.routes';
import securityEventsRoutes from './routes/security-events.routes';
import auditLogsRoutes from './routes/audit-logs.routes';
import userPreferencesRoutes from './routes/user-preferences.routes';
import emailSecurityRoutes from './routes/email-security.routes';
import orgChartRoutes from './routes/org-chart.routes';
import signaturesRoutes from './routes/signatures.routes';
import signatureAssignmentsRoutes from './routes/signature-assignments.routes';
import signatureSyncRoutes from './routes/signature-sync.routes';
import signatureCampaignsRoutes from './routes/signature-campaigns.routes';
import signaturePermissionsRoutes from './routes/signature-permissions.routes';
import customFieldsRoutes from './routes/custom-fields.routes';
import dashboardRoutes from './routes/dashboard.routes';
import departmentsRoutes from './routes/departments.routes';
import locationsRoutes from './routes/locations.routes';
import costCentersRoutes from './routes/cost-centers.routes';
import dataQualityRoutes from './routes/data-quality.routes';
import meRoutes from './routes/me.routes';
import peopleRoutes from './routes/people.routes';
import bulkOperationsRoutes from './routes/bulk-operations.routes';
import { authenticateApiKey } from './middleware/api-key-auth';
import { SignatureSchedulerService } from './services/signature-scheduler.service';
import { cacheService } from './services/cache.service';
import { activityTracker } from './services/activity-tracker.service';
import { initializeBulkOperationsGateway } from './websocket/bulk-operations.gateway';
import { startScheduledActionProcessor, stopScheduledActionProcessor } from './jobs/scheduled-action-processor';
import { startSignatureSyncJob, stopSignatureSyncJob } from './jobs/signature-sync.job';
import { startCampaignSchedulerJob, stopCampaignSchedulerJob } from './jobs/campaign-scheduler.job';

import transparentProxyRouter from './middleware/transparent-proxy';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
import assetProxyRoutes from './routes/asset-proxy.routes';
import assetsRoutes from './routes/assets.routes';
import lifecycleRoutes from './routes/lifecycle.routes';
import trackingRoutes from './routes/tracking.routes';
import { requestIdMiddleware, REQUEST_ID_HEADER } from './middleware/request-id';
const app = express();
const httpServer = createServer(app);
const PORT = process.env['PORT'] || 3001;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Rate limiting (disabled in test environment)
const rateLimitEnabled = process.env['RATE_LIMIT_ENABLED'] !== 'false';

if (rateLimitEnabled) {
  const limiter = rateLimit({
    windowMs: parseInt(process.env['RATE_LIMIT_WINDOW_MS'] || '900000'), // 15 minutes
    max: parseInt(process.env['RATE_LIMIT_MAX_REQUESTS'] || '100'),
    message: {
      error: 'Too many requests from this IP, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use(limiter);
  logger.info('Rate limiting enabled');
} else {
  logger.info('Rate limiting disabled (test environment)');
}

// CORS configuration
const corsOptions = {
  origin: process.env['NODE_ENV'] === 'production'
    ? [`https://${process.env['APPURL']}`, `https://${process.env['DOMAIN']}`]
    : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-API-Key',
    'X-Actor-Name',
    'X-Actor-Email',
    'X-Actor-ID',
    'X-Actor-Type',
    'X-Client-Reference',
    REQUEST_ID_HEADER  // X-Request-ID for request tracing
  ],
  exposedHeaders: [REQUEST_ID_HEADER],  // Allow client to read X-Request-ID
};

app.use(cors(corsOptions));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Request ID middleware - MUST be early in chain for tracing
app.use(requestIdMiddleware);

// Logging middleware - now includes requestId
app.use((req, res, next) => {
  // Log incoming request
  logger.info(`${req.method} ${req.url}`, {
    requestId: req.requestId,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  // Log response on finish
  res.on('finish', () => {
    const duration = Date.now() - req.startTime;
    const level = res.statusCode >= 400 ? 'warn' : 'info';
    logger.log(level, `${req.method} ${req.url} ${res.statusCode} ${duration}ms`, {
      requestId: req.requestId,
      status: res.statusCode,
      duration,
    });
  });

  next();
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const dbHealth = await db.healthCheck();
    const platformSetupComplete = await dbInitializer.isPlatformSetupComplete();

    res.json({
      status: 'healthy',
      database: dbHealth ? 'connected' : 'disconnected',
      platformSetup: platformSetupComplete ? 'complete' : 'pending',
      timestamp: new Date().toISOString(),
      version: process.env['npm_package_version'] || '1.0.0',
      requestId: req.requestId,
    });
  } catch (error) {
    logger.error('Health check failed', { error, requestId: req.requestId });
    res.status(503).json({
      status: 'unhealthy',
      error: 'Health check failed',
      timestamp: new Date().toISOString(),
      requestId: req.requestId,
    });
  }
});
// API Documentation - Swagger UI with custom styling
const swaggerCustomCss = `
  /* Helios Custom Swagger UI Styling */
  .swagger-ui .topbar { display: none; }

  /* Overall container */
  .swagger-ui {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  }

  /* Info section */
  .swagger-ui .info {
    margin: 30px 0;
  }

  .swagger-ui .info .title {
    font-size: 32px;
    color: #1f2937;
    font-weight: 600;
  }

  .swagger-ui .info .description {
    color: #4b5563;
    font-size: 14px;
    line-height: 1.6;
  }

  /* Scheme container */
  .swagger-ui .scheme-container {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 20px;
    margin: 20px 0;
  }

  /* Operations */
  .swagger-ui .opblock {
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    margin-bottom: 16px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }

  .swagger-ui .opblock.opblock-post {
    border-color: #10b981;
    background: rgba(16, 185, 129, 0.03);
  }

  .swagger-ui .opblock.opblock-get {
    border-color: #3b82f6;
    background: rgba(59, 130, 246, 0.03);
  }

  .swagger-ui .opblock.opblock-put {
    border-color: #f59e0b;
    background: rgba(245, 158, 11, 0.03);
  }

  .swagger-ui .opblock.opblock-patch {
    border-color: #8b5cf6;
    background: rgba(139, 92, 246, 0.03);
  }

  .swagger-ui .opblock.opblock-delete {
    border-color: #ef4444;
    background: rgba(239, 68, 68, 0.03);
  }

  /* Operation tags */
  .swagger-ui .opblock-tag {
    border-bottom: 2px solid #e5e7eb;
    padding: 16px 0;
    margin: 24px 0;
  }

  .swagger-ui .opblock-tag-section {
    margin-bottom: 24px;
  }

  /* Method badges */
  .swagger-ui .opblock-summary-method {
    border-radius: 4px;
    font-weight: 600;
    font-size: 12px;
    min-width: 70px;
    text-align: center;
    padding: 6px 12px;
  }

  /* Buttons */
  .swagger-ui .btn {
    border-radius: 6px;
    font-weight: 500;
    padding: 8px 16px;
    transition: all 0.15s ease;
  }

  .swagger-ui .btn.execute {
    background: #8b5cf6;
    border-color: #8b5cf6;
  }

  .swagger-ui .btn.execute:hover {
    background: #7c3aed;
    border-color: #7c3aed;
  }

  /* Parameters table */
  .swagger-ui table thead tr th {
    background: #f9fafb;
    color: #374151;
    font-weight: 600;
    font-size: 13px;
    padding: 12px;
    border-bottom: 2px solid #e5e7eb;
  }

  .swagger-ui table tbody tr td {
    padding: 12px;
    border-bottom: 1px solid #f3f4f6;
  }

  /* Response section */
  .swagger-ui .responses-wrapper {
    margin-top: 20px;
  }

  .swagger-ui .response {
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    margin-bottom: 12px;
  }

  /* Code blocks */
  .swagger-ui .highlight-code {
    background: #1e1e1e;
    border-radius: 6px;
    padding: 16px;
  }

  .swagger-ui .highlight-code pre {
    color: #e5e7eb;
  }

  /* Models */
  .swagger-ui .model-box {
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    background: #f9fafb;
    padding: 16px;
  }

  .swagger-ui .model-title {
    color: #1f2937;
    font-weight: 600;
  }

  /* Authentication */
  .swagger-ui .auth-container {
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    padding: 16px;
    margin: 16px 0;
  }

  .swagger-ui .auth-btn-wrapper .btn-done {
    background: #10b981;
    border-color: #10b981;
  }

  .swagger-ui .auth-btn-wrapper .btn-done:hover {
    background: #059669;
    border-color: #059669;
  }

  /* Scrollbar styling */
  .swagger-ui ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  .swagger-ui ::-webkit-scrollbar-track {
    background: #f3f4f6;
    border-radius: 4px;
  }

  .swagger-ui ::-webkit-scrollbar-thumb {
    background: #9ca3af;
    border-radius: 4px;
  }

  .swagger-ui ::-webkit-scrollbar-thumb:hover {
    background: #6b7280;
  }
`;

// API Documentation - available at both /api/docs and /api/v1/docs
app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: swaggerCustomCss,
  customSiteTitle: 'Helios API Documentation',
  customfavIcon: '/favicon.ico'
}));
// Backwards compatibility alias
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: swaggerCustomCss,
  customSiteTitle: 'Helios API Documentation',
  customfavIcon: '/favicon.ico'
}));

// Serve OpenAPI spec as JSON
app.get('/api/v1/openapi.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});
// Backwards compatibility alias
app.get('/api/openapi.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Public Asset Proxy - NO AUTHENTICATION REQUIRED
// This serves media assets for email signatures with direct URLs
// Must be registered BEFORE API auth middleware
app.use('/a', assetProxyRoutes);

// Tracking pixel endpoints - PUBLIC (no auth required)
// These are loaded by email clients when recipients view emails
// Keep at /api/t (not versioned - pixel URLs should be stable)
app.use('/api/t', trackingRoutes);

// API Key Authentication Middleware - Applied BEFORE JWT
// This allows API key authentication to take priority
// Apply to both versioned and unversioned routes for backwards compatibility
app.use('/api/v1', authenticateApiKey);
app.use('/api', authenticateApiKey);

// Platform setup check middleware - this is the core routing logic
// Helper function for setup check (reused for both /api and /api/v1)
const setupCheckMiddleware = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    // Normalize path for v1 routes (remove /v1 prefix if present)
    const normalizedPath = req.path.startsWith('/v1') ? req.path.slice(3) : req.path;

    // Skip setup check for health, organization setup, auth, and other setup endpoints
    if (normalizedPath.startsWith('/health') ||
        normalizedPath.startsWith('/organization/setup') ||
        normalizedPath.startsWith('/auth') ||
        normalizedPath.startsWith('/setup') ||
        normalizedPath.startsWith('/google-workspace') ||
        normalizedPath.startsWith('/modules') ||
        normalizedPath.startsWith('/docs') ||
        normalizedPath.startsWith('/openapi')) {
      return next();
    }

    const isPlatformSetup = await dbInitializer.isPlatformSetupComplete();

    if (!isPlatformSetup) {
      // If accessing /platform/* routes without setup, allow setup process
      if (normalizedPath.startsWith('/platform/') || normalizedPath === '/setup' || normalizedPath.startsWith('/setup/')) {
        return next();
      }

      // For any other route, return setup required
      return res.status(503).json({
        error: 'Platform setup required',
        setupUrl: '/platform/setup',
        message: 'Please complete platform setup before accessing this resource.',
        requestId: req.requestId,
      });
    }

    next();
  } catch (error) {
    logger.error('Platform setup check failed', { error, requestId: req.requestId });
    res.status(500).json({
      error: 'Platform setup check failed',
      message: 'Unable to determine platform setup status.',
      requestId: req.requestId,
    });
  }
};

// Apply to both versioned and unversioned routes
app.use('/api/v1', setupCheckMiddleware);
app.use('/api', setupCheckMiddleware);

// =============================================================================
// API Routes - v1 (Primary) and unversioned (Backwards Compatibility)
// =============================================================================
// All routes are registered under both /api/v1/ (recommended) and /api/ (deprecated)
// Order matters! More specific routes first

// Helper to register routes on both versioned and unversioned paths
const registerRoute = (path: string, router: express.Router) => {
  app.use(`/api/v1${path}`, router);  // Primary: /api/v1/*
  app.use(`/api${path}`, router);      // Deprecated: /api/*
};

// Dashboard
registerRoute('/dashboard', dashboardRoutes);

// Organization management routes (more specific first)
registerRoute('/organization/api-keys', apiKeysRoutes);
registerRoute('/organization/labels', labelsRoutes);
registerRoute('/organization/workspaces', workspacesRoutes);
registerRoute('/organization/access-groups', accessGroupsRoutes);
registerRoute('/organization/security-events', securityEventsRoutes);
registerRoute('/organization/audit-logs', auditLogsRoutes);
registerRoute('/organization/custom-fields', customFieldsRoutes);
registerRoute('/organization/departments', departmentsRoutes);
registerRoute('/organization/locations', locationsRoutes);
registerRoute('/organization/cost-centers', costCentersRoutes);
registerRoute('/organization/data-quality', dataQualityRoutes);
registerRoute('/organization', orgChartRoutes);
registerRoute('/organization', organizationRoutes);

// Email features
registerRoute('/email-security', emailSecurityRoutes);
registerRoute('/signatures/v2/assignments', signatureAssignmentsRoutes);
registerRoute('/signatures/sync', signatureSyncRoutes);
registerRoute('/signatures/campaigns', signatureCampaignsRoutes);
registerRoute('/signatures/permissions', signaturePermissionsRoutes);
registerRoute('/signatures', signaturesRoutes);

// Authentication & User
registerRoute('/auth', authRoutes);
registerRoute('/user', userRoutes);
registerRoute('/user-preferences', userPreferencesRoutes);
registerRoute('/me', meRoutes);

// People & Bulk operations
registerRoute('/people', peopleRoutes);
registerRoute('/bulk', bulkOperationsRoutes);

// Integrations
registerRoute('/google-workspace', GoogleWorkspaceRoutes);
registerRoute('/modules', modulesRoutes);

// Assets & Lifecycle
registerRoute('/assets', assetsRoutes);
registerRoute('/lifecycle', lifecycleRoutes);

// Transparent Proxy for Google Workspace APIs (must be before catch-all)
app.use(transparentProxyRouter);

// Catch-all for undefined API routes (both versioned and unversioned)
const notFoundHandler = (req: express.Request, res: express.Response) => {
  res.status(404).json({
    error: 'API endpoint not found',
    path: req.path,
    method: req.method,
    requestId: req.requestId,
  });
};
app.use('/api/v1/*', notFoundHandler);
app.use('/api/*', notFoundHandler);

// Root route - redirect logic based on platform setup
app.get('/', async (_req, res) => {
  try {
    const isPlatformSetup = await dbInitializer.isPlatformSetupComplete();

    if (!isPlatformSetup) {
      // Redirect to company website if no setup
      const companyWebsite = `https://${process.env['DOMAIN']}`;
      return res.redirect(companyWebsite);
    }

    // If setup is complete, show login page (handled by frontend)
    res.redirect('/login');
  } catch (error) {
    logger.error('Root route error', error);
    // Fallback to company website
    const companyWebsite = `https://${process.env.DOMAIN}`;
    res.redirect(companyWebsite);
  }
});

// Platform setup route - only accessible via /platform/
app.get('/platform', async (_req, res) => {
  try {
    const isPlatformSetup = await dbInitializer.isPlatformSetupComplete();

    if (isPlatformSetup) {
      // If already setup, redirect to main application
      return res.redirect('/');
    }

    // Serve setup page (handled by frontend)
    res.redirect('/platform/setup');
  } catch (error) {
    logger.error('Platform route error', error);
    res.status(500).json({
      error: 'Unable to determine platform status'
    });
  }
});

// Error handling middleware
app.use(errorHandler);

// Database initialization and server startup
async function startServer(): Promise<void> {
  try {
    logger.info('Starting Helios Platform Backend...');

    // Initialize database
    const dbHealthy = await db.healthCheck();
    if (!dbHealthy) {
      throw new Error('Database connection failed');
    }

    // Check and initialize database schema if needed
    const schemaHealthy = await dbInitializer.checkDatabaseHealth();
    if (!schemaHealthy) {
      logger.info('Database schema not found, initializing...');
      await dbInitializer.initializeDatabase();
      await dbInitializer.seedInitialData();
    }

    // CRITICAL: Verify single-tenant integrity
    // This ensures only ONE organization exists in the system
    try {
      const integrityCheck = await db.query('SELECT verify_single_tenant_integrity()');
      if (!integrityCheck.rows[0]?.verify_single_tenant_integrity) {
        logger.warn('⚠️ No organization found. Setup required.');
      } else {
        logger.info('✅ Single-tenant integrity verified');
      }
    } catch (error: any) {
      if (error.message?.includes('Single-tenant violation')) {
        logger.error('🚨 CRITICAL: Multiple organizations detected in single-tenant system!');
        logger.error('This application supports EXACTLY ONE organization.');
        logger.error('For multi-tenant needs, use the MTP platform.');
        process.exit(1);
      }
      throw error;
    }

    // Initialize signature scheduler (daily cron sync)
    const signatureScheduler = new SignatureSchedulerService();
    await signatureScheduler.initializeScheduler();
    logger.info('📧 Signature scheduler ready');

    // Start signature sync job (periodic pending sync processing)
    const signatureSyncEnabled = process.env['SIGNATURE_SYNC_JOB_ENABLED'] !== 'false';
    if (signatureSyncEnabled) {
      startSignatureSyncJob({
        enabled: true,
        intervalMs: parseInt(process.env['SIGNATURE_SYNC_INTERVAL_MS'] || '300000'), // 5 minutes default
        batchSize: parseInt(process.env['SIGNATURE_SYNC_BATCH_SIZE'] || '50'),
        maxRetries: 3,
        detectExternalChanges: process.env['SIGNATURE_DETECT_EXTERNAL_CHANGES'] === 'true'
      });
      logger.info('📧 Signature sync job started');
    } else {
      logger.info('📧 Signature sync job disabled');
    }

    // Start campaign scheduler job (manages campaign lifecycle)
    const campaignSchedulerEnabled = process.env['CAMPAIGN_SCHEDULER_ENABLED'] !== 'false';
    if (campaignSchedulerEnabled) {
      startCampaignSchedulerJob({
        enabled: true,
        intervalMs: parseInt(process.env['CAMPAIGN_SCHEDULER_INTERVAL_MS'] || '60000'), // 1 minute default
      });
      logger.info('📧 Campaign scheduler job started');
    } else {
      logger.info('📧 Campaign scheduler job disabled');
    }

    // Initialize WebSocket gateway for bulk operations
    initializeBulkOperationsGateway(httpServer);
    logger.info('🔌 WebSocket gateway initialized for bulk operations');

    // Start scheduled action processor for user lifecycle
    const scheduledActionsEnabled = process.env['SCHEDULED_ACTIONS_ENABLED'] !== 'false';
    if (scheduledActionsEnabled) {
      startScheduledActionProcessor({
        enabled: true,
        intervalMs: parseInt(process.env['SCHEDULED_ACTIONS_INTERVAL_MS'] || '60000'), // 1 minute default
        batchSize: parseInt(process.env['SCHEDULED_ACTIONS_BATCH_SIZE'] || '10'),
        maxRetries: parseInt(process.env['SCHEDULED_ACTIONS_MAX_RETRIES'] || '3')
      });
      logger.info('📅 Scheduled action processor started');
    } else {
      logger.info('📅 Scheduled action processor disabled');
    }

    // Start server (use httpServer instead of app.listen for WebSocket support)
    httpServer.listen(PORT, () => {
      logger.info(`🚀 Helios Platform Backend running on port ${PORT}`);
      logger.info(`📊 Health check: http://localhost:${PORT}/health`);
      logger.info(`⚙️ Platform setup: http://localhost:${PORT}/platform`);
      logger.info(`🔌 WebSocket: ws://localhost:${PORT}/socket.io/`);
      logger.info(`🌍 Environment: ${process.env['NODE_ENV'] || 'development'}`);
    });

  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  stopScheduledActionProcessor();
  stopSignatureSyncJob();
  stopCampaignSchedulerJob();
  await db.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  stopScheduledActionProcessor();
  stopSignatureSyncJob();
  stopCampaignSchedulerJob();
  await db.close();
  process.exit(0);
});

// Start the server
startServer();

