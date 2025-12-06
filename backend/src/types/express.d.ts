/**
 * Express Request type extensions
 */

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
