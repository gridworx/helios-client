import { PluginManager } from '../core/plugins/PluginManager';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        tenantId?: string;
      };
      tenant?: {
        id: string;
        name: string;
        domain: string;
      };
    }

    interface Locals {
      pluginManager: PluginManager;
    }
  }
}