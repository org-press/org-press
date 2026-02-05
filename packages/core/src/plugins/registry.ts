/**
 * Plugin Registry
 *
 * Manages plugin loading, sorting, and initialization.
 * Responsible for calling each plugin's setup() function with the PluginContext.
 *
 * @example
 * ```typescript
 * const registry = new PluginRegistry(config, projectRoot);
 *
 * // Register plugins from config
 * await registry.register(config.plugins ?? []);
 *
 * // Get the initialized context
 * const ctx = registry.getContext();
 *
 * // Use handlers in pipeline
 * const drawerHandler = ctx.getDrawerHandler('AI');
 * ```
 */

import type { OrgPressConfig, OrgPressPlugin, Logger } from "./types.ts";
import { PluginContextImpl } from "./context.ts";

/**
 * Default logger that writes to console
 */
const defaultLogger: Logger = {
  info: (message: string, ...args: unknown[]) => console.log(`[info] ${message}`, ...args),
  warn: (message: string, ...args: unknown[]) => console.warn(`[warn] ${message}`, ...args),
  error: (message: string, ...args: unknown[]) => console.error(`[error] ${message}`, ...args),
  debug: (message: string, ...args: unknown[]) => {
    if (process.env.DEBUG) {
      console.debug(`[debug] ${message}`, ...args);
    }
  },
};

/**
 * Plugin Registry
 *
 * Manages the lifecycle of plugins:
 * 1. Sorts plugins by priority (higher first)
 * 2. Initializes each plugin by calling setup()
 * 3. Catches and logs errors without crashing
 * 4. Provides access to the initialized context
 */
export class PluginRegistry {
  /** The plugin context instance */
  private ctx: PluginContextImpl;

  /** Registered plugins in priority order */
  private plugins: OrgPressPlugin[] = [];

  /** Logger instance */
  private logger: Logger;

  /**
   * Create a new plugin registry
   *
   * @param config - Org-press configuration
   * @param projectRoot - Absolute path to project root
   * @param logger - Optional logger instance
   */
  constructor(config: OrgPressConfig, projectRoot: string, logger?: Logger) {
    this.logger = logger ?? defaultLogger;
    this.ctx = new PluginContextImpl(config, projectRoot, this.logger);
  }

  /**
   * Register and initialize plugins
   *
   * Process:
   * 1. Sort plugins by priority (higher runs first)
   * 2. Call each plugin's setup() function with the context
   * 3. Handle async setup functions
   * 4. Catch errors and continue with remaining plugins
   *
   * @param plugins - Array of plugins to register
   */
  async register(plugins: OrgPressPlugin[]): Promise<void> {
    // Store plugins
    this.plugins = [...plugins];

    // Sort by priority (higher first)
    // Plugins without priority default to 0
    this.plugins.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    this.logger.debug(
      `Registering ${this.plugins.length} plugins: ${this.plugins.map((p) => `${p.name}(${p.priority ?? 0})`).join(", ")}`
    );

    // Initialize each plugin
    for (const plugin of this.plugins) {
      // Plugins must have setup() to register handlers
      if (!plugin.setup) {
        throw new Error(
          `Plugin '${plugin.name}' is missing setup(). ` +
          `Use CreateBlock/CreateDrawer/CreateTransformer to create plugins.`
        );
      }

      // Set the current plugin priority for handler registration
      this.ctx._setCurrentPluginPriority(plugin.priority ?? 0);

      try {
        this.logger.debug(`Setting up plugin: ${plugin.name}`);
        const result = plugin.setup(this.ctx);

        // Handle async setup
        if (result instanceof Promise) {
          await result;
        }

        this.logger.debug(`Plugin ${plugin.name} setup complete`);
      } catch (error) {
        // Log error but don't crash - continue with other plugins
        this.logger.error(
          `Failed to setup plugin '${plugin.name}':`,
          error instanceof Error ? error.message : error
        );

        // Log stack trace in debug mode
        if (process.env.DEBUG && error instanceof Error && error.stack) {
          this.logger.debug(error.stack);
        }
      }
    }

    // Reset priority after all plugins are registered
    this.ctx._setCurrentPluginPriority(0);
  }

  /**
   * Get the initialized plugin context
   *
   * @returns The PluginContextImpl instance with all registered handlers
   */
  getContext(): PluginContextImpl {
    return this.ctx;
  }

  /**
   * Get all registered plugins
   *
   * @returns Array of plugins in priority order
   */
  getPlugins(): OrgPressPlugin[] {
    return [...this.plugins];
  }

  /**
   * Get a specific plugin by name
   *
   * @param name - Plugin name
   * @returns Plugin or undefined if not found
   */
  getPlugin(name: string): OrgPressPlugin | undefined {
    return this.plugins.find((p) => p.name === name);
  }

  /**
   * Check if a plugin is registered
   *
   * @param name - Plugin name
   * @returns true if plugin is registered
   */
  hasPlugin(name: string): boolean {
    return this.plugins.some((p) => p.name === name);
  }
}

export default PluginRegistry;
