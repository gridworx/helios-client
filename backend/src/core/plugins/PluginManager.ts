import fs from 'fs/promises';
import path from 'path';
import { logger } from '../../utils/logger';

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  main: string;
  dependencies?: string[];
  systemPlugin: boolean;
  configSchema: any;
  hooks?: Array<{
    name: string;
    type: 'action' | 'filter';
    callback: string;
    priority: number;
  }>;
  routes?: Array<{
    method: string;
    path: string;
    handler: string;
    middleware?: string[];
    requiresAuth?: boolean;
    requiresTenant?: boolean;
    requiresPlatformOwner?: boolean;
  }>;
  middleware?: Array<{
    name: string;
    handler: string;
    global: boolean;
  }>;
  permissions?: string[];
  database?: {
    tables: string[];
    migrations: string[];
  };
  frontend?: {
    components?: string[];
    routes?: Array<{
      path: string;
      component: string;
      requiresAuth?: boolean;
      requiresPermission?: string;
    }>;
  };
}

export interface Plugin {
  manifest: PluginManifest;
  instance: any;
  isLoaded: boolean;
  isActive: boolean;
  loadError?: string;
}

export interface PluginHook {
  pluginName: string;
  hookName: string;
  type: 'action' | 'filter';
  callback: Function;
  priority: number;
}

export class PluginManager {
  private plugins: Map<string, Plugin> = new Map();
  private hooks: Map<string, PluginHook[]> = new Map();
  private pluginDirectory: string;

  constructor(pluginDirectory: string = '/app/plugins') {
    this.pluginDirectory = pluginDirectory;
  }

  /**
   * Initialize plugin system - discover and load all plugins
   */
  async initialize(): Promise<void> {
    logger.info('Initializing Plugin Manager...');

    try {
      await this.discoverPlugins();
      await this.loadSystemPlugins();
      await this.loadActivePlugins();

      logger.info(`Plugin Manager initialized. Loaded ${this.plugins.size} plugins.`);
    } catch (error) {
      logger.error('Failed to initialize Plugin Manager', error);
      throw error;
    }
  }

  /**
   * Discover all available plugins by scanning plugin directory
   */
  private async discoverPlugins(): Promise<void> {
    try {
      const pluginDirs = await this.scanPluginDirectories();

      for (const pluginDir of pluginDirs) {
        try {
          const manifest = await this.loadPluginManifest(pluginDir);

          const plugin: Plugin = {
            manifest,
            instance: null,
            isLoaded: false,
            isActive: false
          };

          this.plugins.set(manifest.name, plugin);
          logger.debug(`Discovered plugin: ${manifest.name} v${manifest.version}`);
        } catch (error) {
          logger.warn(`Failed to load plugin manifest from ${pluginDir}`, error);
        }
      }
    } catch (error) {
      logger.error('Failed to discover plugins', error);
      throw error;
    }
  }

  /**
   * Scan plugin directories to find plugin.json files
   */
  private async scanPluginDirectories(): Promise<string[]> {
    const pluginDirs: string[] = [];

    try {
      // Core plugins
      const corePluginsDir = path.join(this.pluginDirectory, 'core-plugins');
      const corePlugins = await this.scanDirectory(corePluginsDir);
      pluginDirs.push(...corePlugins);

      // Regular plugins
      const regularPlugins = await this.scanDirectory(this.pluginDirectory, ['core-plugins']);
      pluginDirs.push(...regularPlugins);

    } catch (error) {
      logger.warn('Plugin directory not found or inaccessible', error);
    }

    return pluginDirs;
  }

  /**
   * Scan a directory for plugin manifests
   */
  private async scanDirectory(dir: string, exclude: string[] = []): Promise<string[]> {
    const pluginDirs: string[] = [];

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory() && !exclude.includes(entry.name)) {
          const pluginPath = path.join(dir, entry.name);
          const manifestPath = path.join(pluginPath, 'plugin.json');

          try {
            await fs.access(manifestPath);
            pluginDirs.push(pluginPath);
          } catch {
            // No plugin.json found, check subdirectories
            const subDirs = await this.scanDirectory(pluginPath);
            pluginDirs.push(...subDirs);
          }
        }
      }
    } catch (error) {
      logger.debug(`Could not scan directory ${dir}`, error);
    }

    return pluginDirs;
  }

  /**
   * Load plugin manifest from plugin.json
   */
  private async loadPluginManifest(pluginDir: string): Promise<PluginManifest> {
    const manifestPath = path.join(pluginDir, 'plugin.json');

    try {
      const manifestData = await fs.readFile(manifestPath, 'utf-8');
      const manifest: PluginManifest = JSON.parse(manifestData);

      // Validate required fields
      if (!manifest.name || !manifest.version || !manifest.main) {
        throw new Error('Invalid plugin manifest: missing required fields');
      }

      return manifest;
    } catch (error) {
      throw new Error(`Failed to load plugin manifest from ${manifestPath}: ${error.message}`);
    }
  }

  /**
   * Load system plugins (always active)
   */
  private async loadSystemPlugins(): Promise<void> {
    const systemPlugins = Array.from(this.plugins.values())
      .filter(plugin => plugin.manifest.systemPlugin);

    // Sort plugins by dependencies to load in correct order
    const sortedPlugins = this.sortPluginsByDependencies(systemPlugins);

    for (const plugin of sortedPlugins) {
      try {
        await this.loadPlugin(plugin.manifest.name);
        logger.info(`Loaded system plugin: ${plugin.manifest.name}`);
      } catch (error) {
        logger.error(`Failed to load system plugin ${plugin.manifest.name}`, error);
        // For now, continue loading other plugins instead of crashing
        logger.warn(`Skipping failed system plugin: ${plugin.manifest.name}`);
      }
    }
  }

  /**
   * Sort plugins by dependencies using topological sort
   */
  private sortPluginsByDependencies(plugins: Plugin[]): Plugin[] {
    const sorted: Plugin[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (plugin: Plugin): void => {
      if (visiting.has(plugin.manifest.name)) {
        throw new Error(`Circular dependency detected: ${plugin.manifest.name}`);
      }
      if (visited.has(plugin.manifest.name)) {
        return;
      }

      visiting.add(plugin.manifest.name);

      // Visit dependencies first
      if (plugin.manifest.dependencies) {
        for (const depName of plugin.manifest.dependencies) {
          const depPlugin = plugins.find(p => p.manifest.name === depName);
          if (depPlugin) {
            visit(depPlugin);
          }
        }
      }

      visiting.delete(plugin.manifest.name);
      visited.add(plugin.manifest.name);
      sorted.push(plugin);
    };

    for (const plugin of plugins) {
      if (!visited.has(plugin.manifest.name)) {
        visit(plugin);
      }
    }

    return sorted;
  }

  /**
   * Load active plugins (non-system plugins that are enabled)
   */
  private async loadActivePlugins(): Promise<void> {
    // TODO: Check database for active plugins
    // For now, load all non-system plugins
    const regularPlugins = Array.from(this.plugins.values())
      .filter(plugin => !plugin.manifest.systemPlugin);

    for (const plugin of regularPlugins) {
      try {
        // TODO: Check if plugin is active in database
        const isActive = await this.isPluginActive(plugin.manifest.name);

        if (isActive) {
          await this.loadPlugin(plugin.manifest.name);
          logger.info(`Loaded plugin: ${plugin.manifest.name}`);
        }
      } catch (error) {
        logger.warn(`Failed to load plugin ${plugin.manifest.name}`, error);
        // Non-system plugins should not prevent startup
      }
    }
  }

  /**
   * Load a specific plugin
   */
  async loadPlugin(pluginName: string): Promise<void> {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginName}`);
    }

    if (plugin.isLoaded) {
      return; // Already loaded
    }

    try {
      // Check dependencies
      if (plugin.manifest.dependencies) {
        for (const dep of plugin.manifest.dependencies) {
          const depPlugin = this.plugins.get(dep);
          if (!depPlugin || !depPlugin.isLoaded) {
            throw new Error(`Dependency not loaded: ${dep}`);
          }
        }
      }

      // Load plugin instance
      const pluginMainPath = this.resolvePluginMainPath(pluginName);
      const PluginClass = require(pluginMainPath);

      plugin.instance = new PluginClass.default();

      // Register hooks
      if (plugin.manifest.hooks) {
        this.registerPluginHooks(plugin);
      }

      plugin.isLoaded = true;
      plugin.isActive = true;

      // Call plugin initialization if available
      if (plugin.instance.initialize) {
        await plugin.instance.initialize();
      }

    } catch (error) {
      plugin.loadError = error.message;
      throw new Error(`Failed to load plugin ${pluginName}: ${error.message}`);
    }
  }

  /**
   * Register hooks for a plugin
   */
  private registerPluginHooks(plugin: Plugin): void {
    if (!plugin.manifest.hooks) return;

    for (const hookDef of plugin.manifest.hooks) {
      const hook: PluginHook = {
        pluginName: plugin.manifest.name,
        hookName: hookDef.name,
        type: hookDef.type,
        callback: plugin.instance[hookDef.callback].bind(plugin.instance),
        priority: hookDef.priority || 10
      };

      if (!this.hooks.has(hookDef.name)) {
        this.hooks.set(hookDef.name, []);
      }

      const hooks = this.hooks.get(hookDef.name)!;
      hooks.push(hook);

      // Sort by priority
      hooks.sort((a, b) => a.priority - b.priority);
    }
  }

  /**
   * Execute action hooks
   */
  async doAction(hookName: string, ...args: any[]): Promise<void> {
    const hooks = this.hooks.get(hookName);
    if (!hooks) return;

    const actionHooks = hooks.filter(h => h.type === 'action');

    for (const hook of actionHooks) {
      try {
        await hook.callback(...args);
      } catch (error) {
        logger.error(`Hook execution failed: ${hookName} in ${hook.pluginName}`, error);
      }
    }
  }

  /**
   * Apply filter hooks
   */
  async applyFilter(hookName: string, value: any, ...args: any[]): Promise<any> {
    const hooks = this.hooks.get(hookName);
    if (!hooks) return value;

    const filterHooks = hooks.filter(h => h.type === 'filter');

    let filteredValue = value;

    for (const hook of filterHooks) {
      try {
        filteredValue = await hook.callback(filteredValue, ...args);
      } catch (error) {
        logger.error(`Filter execution failed: ${hookName} in ${hook.pluginName}`, error);
      }
    }

    return filteredValue;
  }

  /**
   * Get all loaded plugins
   */
  getLoadedPlugins(): Plugin[] {
    return Array.from(this.plugins.values()).filter(p => p.isLoaded);
  }

  /**
   * Get plugin by name
   */
  getPlugin(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * Check if plugin is active (TODO: implement database check)
   */
  private async isPluginActive(pluginName: string): Promise<boolean> {
    // TODO: Query database to check if plugin is active
    // For now, return true for testing
    return true;
  }

  /**
   * Resolve the main file path for a plugin
   */
  private resolvePluginMainPath(pluginName: string): string {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginName}`);
    }

    // Find plugin directory
    const pluginDir = this.findPluginDirectory(pluginName);
    return path.join(pluginDir, plugin.manifest.main);
  }

  /**
   * Find the directory path for a plugin
   */
  private findPluginDirectory(pluginName: string): string {
    // Check core plugins first
    let pluginDir = path.join(this.pluginDirectory, 'core-plugins', pluginName);
    if (this.directoryExists(pluginDir)) {
      return pluginDir;
    }

    // Check regular plugins
    pluginDir = path.join(this.pluginDirectory, pluginName);
    if (this.directoryExists(pluginDir)) {
      return pluginDir;
    }

    throw new Error(`Plugin directory not found: ${pluginName}`);
  }

  /**
   * Check if directory exists synchronously
   */
  private directoryExists(dir: string): boolean {
    try {
      require('fs').accessSync(dir);
      return true;
    } catch {
      return false;
    }
  }
}