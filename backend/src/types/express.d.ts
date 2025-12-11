/**
 * Express Request type extensions
 */

declare global {
  namespace Express {
    interface Request {
      /** Unique request ID for tracing (added by request-id middleware) */
      requestId: string;

      /** Request start time in milliseconds (added by request-id middleware) */
      startTime: number;

      /** Authenticated user context (added by auth middleware) */
      user?: {
        userId: string;
        email: string;
        role: string;
        organizationId: string;
        firstName?: string;
        lastName?: string;
        // API Key context
        keyType?: 'service' | 'vendor';
        apiKeyId?: string;
        apiKeyName?: string;
        serviceName?: string;
        serviceEmail?: string;
        serviceOwner?: string;
        vendorName?: string;
      };
    }
  }
}

export {};
