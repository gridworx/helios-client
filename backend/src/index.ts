// Load environment variables FIRST before any imports that use them
import dotenv from 'dotenv';
import path from 'path';
// .env is in project root, two levels up from src/
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

import express from 'express';
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
import { PluginManager } from './core/plugins/PluginManager';
import userRoutes from './routes/user.routes';
import authRoutes from './routes/auth.routes';
// import tenantAuthRoutes from './routes/tenant-auth.routes';
// import tenantSetupRoutes from './routes/tenant-setup.routes';
import GoogleWorkspaceRoutes from './routes/google-workspace.routes';
import modulesRoutes from './routes/modules.routes';
import organizationRoutes from './routes/organization.routes';

const app = express();
const PORT = process.env['PORT'] || 3001;

// Initialize plugin manager
const pluginManager = new PluginManager();

// Add plugin manager to app for use in routes and middleware
app.locals.pluginManager = pluginManager;

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

// Rate limiting
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

// CORS configuration
const corsOptions = {
  origin: process.env['NODE_ENV'] === 'production'
    ? [`https://${process.env['APPURL']}`, `https://${process.env['DOMAIN']}`]
    : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

app.use(cors(corsOptions));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Logging middleware
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.url}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
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
    });
  } catch (error) {
    logger.error('Health check failed', error);
    res.status(503).json({
      status: 'unhealthy',
      error: 'Health check failed',
      timestamp: new Date().toISOString(),
    });
  }
});

// Platform setup check middleware - this is the core routing logic
app.use('/api', async (req, res, next) => {
  try {
    // Skip setup check for health, organization setup, auth, and other setup endpoints
    if (req.path.startsWith('/health') ||
        req.path.startsWith('/organization/setup') ||
        req.path.startsWith('/auth') ||
        req.path.startsWith('/setup') ||
        req.path.startsWith('/tenant-setup') ||
        req.path.startsWith('/google-workspace') ||
        req.path.startsWith('/modules')) {
      return next();
    }

    const isPlatformSetup = await dbInitializer.isPlatformSetupComplete();

    if (!isPlatformSetup) {
      // If accessing /platform/* routes without setup, allow setup process
      if (req.path.startsWith('/platform/') || req.path === '/setup' || req.path.startsWith('/setup/')) {
        return next();
      }

      // For any other route, return setup required
      return res.status(503).json({
        error: 'Platform setup required',
        setupUrl: '/platform/setup',
        message: 'Please complete platform setup before accessing this resource.'
      });
    }

    next();
  } catch (error) {
    logger.error('Platform setup check failed', error);
    res.status(500).json({
      error: 'Platform setup check failed',
      message: 'Unable to determine platform setup status.'
    });
  }
});

// API Routes
app.use('/api/organization', organizationRoutes);
app.use('/api/auth', authRoutes);
// app.use('/api/auth', tenantAuthRoutes); // Tenant authentication
app.use('/api/user', userRoutes);
// app.use('/api/platform', platformRoutes);
app.use('/api/google-workspace', GoogleWorkspaceRoutes);
app.use('/api/modules', modulesRoutes);

// Catch-all for undefined API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    error: 'API endpoint not found',
    path: req.path,
    method: req.method,
  });
});

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

    // Initialize plugin system
    logger.info('Initializing plugin system...');
    await pluginManager.initialize();

    // Start server
    app.listen(PORT, () => {
      logger.info(`🚀 Helios Platform Backend running on port ${PORT}`);
      logger.info(`📊 Health check: http://localhost:${PORT}/health`);
      logger.info(`⚙️ Platform setup: http://localhost:${PORT}/platform`);
      logger.info(`🌍 Environment: ${process.env['NODE_ENV'] || 'development'}`);
      logger.info(`🔌 Plugins loaded: ${pluginManager.getLoadedPlugins().length}`);
    });

  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await db.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await db.close();
  process.exit(0);
});

// Start the server
startServer();
