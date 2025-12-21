/**
 * Better Auth Express Handler - UNUSED/DEFERRED
 *
 * STATUS: This handler is NOT mounted. See index.ts lines 538-541.
 *
 * REASON: Better-auth migration deferred due to password storage incompatibility.
 * Current JWT-based auth works perfectly.
 *
 * SEE: openspec/changes/fix-better-auth-integration/decision.md
 *
 * ORIGINAL PURPOSE:
 * Provides the Express middleware for mounting better-auth routes.
 */

import { toNodeHandler } from 'better-auth/node';
import { auth } from './auth.js';

// Export the Node.js handler for Express
export const authHandler = toNodeHandler(auth);

// Re-export auth for direct access
export { auth };
