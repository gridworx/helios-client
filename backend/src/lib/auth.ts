/**
 * Better Auth Configuration - UNUSED/DEFERRED
 *
 * STATUS: This file is NOT ACTIVE. Better-auth is disabled in index.ts.
 *
 * REASON FOR DEFERRAL (2025-12-19):
 * Better-auth requires passwords to be stored in the `account` table with
 * `providerId = "credential"`, but our system stores passwords in
 * `organization_users.password_hash`. Migration would require moving all
 * passwords and risking breaking authentication for 36+ users.
 *
 * The current JWT-based auth system works perfectly. If SSO is needed in
 * the future, this configuration can be revisited.
 *
 * ORIGINAL PURPOSE:
 * This file configures better-auth for the Helios platform.
 * It maps to the existing organization_users table and provides:
 * - Email/password authentication
 * - Session management with httpOnly cookies
 * - Role-based access control
 * - Future: SSO/OIDC support
 *
 * SEE: openspec/changes/fix-better-auth-integration/decision.md
 */

import { betterAuth } from 'better-auth';
import { Pool } from 'pg';

// Create PostgreSQL connection pool
const pool = new Pool({
  host: process.env['DB_HOST'] || 'localhost',
  port: parseInt(process.env['DB_PORT'] || '5432'),
  database: process.env['DB_NAME'] || 'helios_client',
  user: process.env['DB_USER'] || 'postgres',
  password: process.env['DB_PASSWORD'] || 'postgres',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export const auth = betterAuth({
  // Database configuration
  database: pool,

  // Secret for signing tokens and cookies
  secret: process.env['BETTER_AUTH_SECRET'] || process.env['JWT_SECRET'],

  // Base URL for callbacks
  baseURL: process.env['APP_URL'] || 'http://localhost:3001',

  // Email + Password authentication
  emailAndPassword: {
    enabled: true,
    // Use existing bcrypt hashes
    // better-auth uses bcrypt by default which is compatible
  },

  // Session configuration
  session: {
    // 8 hours session expiry
    expiresIn: 60 * 60 * 8,
    // Update session activity every 15 minutes
    updateAge: 60 * 15,
    // Cookie settings
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // Cache for 5 minutes
    },
  },

  // Map to existing database schema
  user: {
    modelName: 'organization_users',
    fields: {
      // Required fields
      email: 'email',
      emailVerified: 'email_verified',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    // Additional fields we need
    additionalFields: {
      firstName: {
        type: 'string',
        fieldName: 'first_name',
      },
      lastName: {
        type: 'string',
        fieldName: 'last_name',
      },
      role: {
        type: 'string',
        fieldName: 'role',
      },
      organizationId: {
        type: 'string',
        fieldName: 'organization_id',
      },
      isExternalAdmin: {
        type: 'boolean',
        fieldName: 'is_external_admin',
      },
      defaultView: {
        type: 'string',
        fieldName: 'default_view',
      },
      isActive: {
        type: 'boolean',
        fieldName: 'is_active',
      },
      department: {
        type: 'string',
        fieldName: 'department',
      },
    },
  },

  // Account linking for SSO (future)
  account: {
    modelName: 'auth_accounts',
  },

  // Session table
  sessionModel: {
    modelName: 'auth_sessions',
  },

  // Verification table (email verification, password reset)
  verification: {
    modelName: 'auth_verifications',
  },

  // Advanced options
  advanced: {
    // Use secure cookies in production
    useSecureCookies: process.env['NODE_ENV'] === 'production',
    // Cookie prefix
    cookiePrefix: 'helios',
  },

  // Truested origins for CORS
  trustedOrigins: [
    'http://localhost:3000',
    'http://localhost:3001',
    process.env['FRONTEND_URL'] || 'http://localhost:3000',
  ],
});

// Export auth type for use in other files
export type Auth = typeof auth;
