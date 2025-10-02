import { PluginManager } from '../core/plugins/PluginManager';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        role: string;
        organizationId: string;
        department?: string;
      };
      organization?: {
        id: string;
        name: string;
        domain: string;
        isSetupComplete: boolean;
      };
    }

    interface Locals {
      pluginManager: PluginManager;
    }
  }
}