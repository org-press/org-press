/**
 * PluginContext Implementation
 *
 * The runtime that executes plugin setup functions and stores registered handlers.
 * This is the core of the plugin system.
 *
 * @example
 * ```typescript
 * const ctx = new PluginContextImpl(config, projectRoot, logger);
 *
 * // Plugins register handlers via setup()
 * plugin.setup(ctx);
 *
 * // Pipeline accesses registered handlers
 * const handlers = ctx.getElementHandlers('drawer');
 * const drawerHandler = ctx.getDrawerHandler('AI');
 * ```
 */

import type { Plugin as VitePlugin } from "vite";
import type {
  PluginContext,
  OrgPressConfig,
  Logger,
  PipelineStage,
  ElementHandler,
  DrawerHandler,
  DrawerNode,
  BlockHandler,
  StageHandler,
  RehypePlugin,
  UniorgPlugin,
  CommandOptions,
  TransformerOptions,
  MiddlewareOptions,
} from "./types.ts";

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
 * Internal interface for element handler with priority
 */
interface PrioritizedElementHandler {
  handler: ElementHandler;
  priority: number;
}

/**
 * Internal interface for stage handler with priority
 */
interface PrioritizedStageHandler {
  handler: StageHandler;
  priority: number;
}

/**
 * Internal interface for dynamic drawer matcher with priority
 */
interface DynamicDrawerMatcher {
  matches: (drawer: DrawerNode) => boolean;
  handler: DrawerHandler;
  priority: number;
}

/**
 * PluginContext implementation
 *
 * Implements all the registration methods from the PluginContext interface
 * and provides getter methods for the pipeline to access registered handlers.
 */
export class PluginContextImpl implements PluginContext {
  // === Storage for registered handlers ===

  /** Element handlers keyed by AST element type */
  private elementHandlers: Map<string, PrioritizedElementHandler[]> = new Map();

  /** Drawer handlers keyed by uppercase drawer name */
  private drawerHandlers: Map<string, DrawerHandler> = new Map();

  /** Dynamic drawer matchers sorted by priority */
  private dynamicDrawerMatchers: DynamicDrawerMatcher[] = [];

  /** Block handlers keyed by language name */
  private blockHandlers: Map<string, BlockHandler> = new Map();

  /** Pipeline hooks keyed by stage */
  private pipelineHooks: Map<PipelineStage, PrioritizedStageHandler[]> = new Map();

  /** Rehype plugins in registration order */
  private rehypePlugins: Array<{ plugin: RehypePlugin; options?: unknown }> = [];

  /** Uniorg plugins in registration order */
  private uniorgPlugins: Array<{ plugin: UniorgPlugin; options?: unknown }> = [];

  /** CLI commands keyed by command name */
  private commands: Map<string, CommandOptions> = new Map();

  /** Transformers for :use pipeline, keyed by transformer name */
  private transformers: Map<string, TransformerOptions> = new Map();

  /** Vite plugins contributed by CreateVitePlugin */
  private vitePlugins: VitePlugin[] = [];

  /** Middleware handlers contributed by CreateMiddlewarePlugin */
  private middlewares: Array<{ path: string; options: MiddlewareOptions }> = [];

  /** Shared state for plugin communication */
  private sharedState: Map<string, unknown> = new Map();

  /** Current plugin priority being registered (set by registry) */
  private currentPluginPriority: number = 0;

  // === Public properties from PluginContext ===

  /** Org-press configuration */
  public readonly config: OrgPressConfig;

  /** Project root directory */
  public readonly projectRoot: string;

  /** Logger instance */
  public readonly logger: Logger;

  /**
   * Create a new PluginContext
   *
   * @param config - Org-press configuration
   * @param projectRoot - Absolute path to project root
   * @param logger - Optional logger instance (defaults to console logger)
   */
  constructor(config: OrgPressConfig, projectRoot: string, logger?: Logger) {
    this.config = config;
    this.projectRoot = projectRoot;
    this.logger = logger ?? defaultLogger;
  }

  // === Internal methods for registry ===

  /**
   * Set the priority for the current plugin being registered
   * Called by PluginRegistry before each plugin's setup()
   */
  _setCurrentPluginPriority(priority: number): void {
    this.currentPluginPriority = priority;
  }

  // === PluginContext Interface Implementation ===

  /**
   * Register a handler for any AST element type
   *
   * @param type - AST node type (e.g., 'drawer', 'src-block', 'link')
   * @param handler - Transform function
   */
  onElement(type: string, handler: ElementHandler): void {
    const normalizedType = type.toLowerCase();
    const handlers = this.elementHandlers.get(normalizedType) ?? [];

    handlers.push({
      handler,
      priority: this.currentPluginPriority,
    });

    // Sort by priority (higher first)
    handlers.sort((a, b) => b.priority - a.priority);

    this.elementHandlers.set(normalizedType, handlers);
    this.logger.debug(`Registered element handler for type: ${type}`);
  }

  /**
   * Register a drawer handler
   *
   * @param name - Drawer name(s) to handle (case-insensitive)
   * @param handler - Transform function
   */
  onDrawer(name: string | string[], handler: DrawerHandler): void {
    const names = Array.isArray(name) ? name : [name];

    for (const drawerName of names) {
      const normalizedName = drawerName.toUpperCase();

      // Only register if not already registered (first registration wins by priority)
      // Since plugins are registered in priority order, earlier registration = higher priority
      if (!this.drawerHandlers.has(normalizedName)) {
        this.drawerHandlers.set(normalizedName, handler);
        this.logger.debug(`Registered drawer handler for: ${drawerName}`);
      } else {
        this.logger.debug(`Drawer handler for ${drawerName} already registered, skipping`);
      }
    }
  }

  /**
   * Register a dynamic drawer handler that matches based on a function
   *
   * @param matches - Function to determine if this handler should process a drawer
   * @param priority - Priority for matching (higher = matched first)
   * @param handler - Transform function
   */
  onDrawerMatch(
    matches: (drawer: DrawerNode) => boolean,
    priority: number,
    handler: DrawerHandler
  ): void {
    this.dynamicDrawerMatchers.push({
      matches,
      handler,
      priority,
    });

    // Keep sorted by priority (higher first)
    this.dynamicDrawerMatchers.sort((a, b) => b.priority - a.priority);

    this.logger.debug(`Registered dynamic drawer matcher with priority: ${priority}`);
  }

  /**
   * Register a code block handler
   *
   * @param language - Language(s) to handle
   * @param handler - Transform function
   */
  onBlock(language: string | string[], handler: BlockHandler): void {
    const languages = Array.isArray(language) ? language : [language];

    for (const lang of languages) {
      const normalizedLang = lang.toLowerCase();

      // Only register if not already registered (first registration wins by priority)
      if (!this.blockHandlers.has(normalizedLang)) {
        this.blockHandlers.set(normalizedLang, handler);
        this.logger.debug(`Registered block handler for: ${lang}`);
      } else {
        this.logger.debug(`Block handler for ${lang} already registered, skipping`);
      }
    }
  }

  /**
   * Hook into pipeline stages
   *
   * @param stage - Pipeline stage
   * @param handler - Hook function
   */
  hook(stage: PipelineStage, handler: StageHandler): void {
    const hooks = this.pipelineHooks.get(stage) ?? [];

    hooks.push({
      handler,
      priority: this.currentPluginPriority,
    });

    // Sort by priority (higher first)
    hooks.sort((a, b) => b.priority - a.priority);

    this.pipelineHooks.set(stage, hooks);
    this.logger.debug(`Registered hook for stage: ${stage}`);
  }

  /**
   * Add a rehype plugin to the render pipeline
   *
   * @param plugin - rehype plugin
   * @param options - Plugin options
   */
  useRehype(plugin: RehypePlugin, options?: unknown): void {
    this.rehypePlugins.push({ plugin, options });

    const name = typeof plugin === "function" && plugin.name ? plugin.name : "anonymous";
    this.logger.debug(`Added rehype plugin: ${name}`);
  }

  /**
   * Add a uniorg plugin to the parse pipeline
   *
   * @param plugin - uniorg plugin
   * @param options - Plugin options
   */
  useUniorg(plugin: UniorgPlugin, options?: unknown): void {
    this.uniorgPlugins.push({ plugin, options });

    const name = typeof plugin === "function" && plugin.name ? plugin.name : "anonymous";
    this.logger.debug(`Added uniorg plugin: ${name}`);
  }

  /**
   * Add a CLI command
   *
   * @param name - Command name
   * @param options - Command configuration
   */
  addCommand(name: string, options: CommandOptions): void {
    if (this.commands.has(name)) {
      this.logger.warn(`Command '${name}' already registered, overwriting`);
    }

    this.commands.set(name, options);
    this.logger.debug(`Added command: ${name}`);
  }

  /**
   * Add a transformer for :use parameter
   *
   * @param name - Transformer name (used in :use)
   * @param options - Transformer configuration
   */
  addTransformer(name: string, options: TransformerOptions): void {
    if (this.transformers.has(name)) {
      this.logger.warn(`Transformer '${name}' already registered, overwriting`);
    }

    this.transformers.set(name, options);
    this.logger.debug(`Added transformer: ${name}`);
  }

  /**
   * Register a Vite plugin to be included in the Vite config
   *
   * @param plugin - Vite plugin to register
   */
  addVitePlugin(plugin: VitePlugin): void {
    this.vitePlugins.push(plugin);
    const name = typeof plugin === "object" && plugin.name ? plugin.name : "anonymous";
    this.logger.debug(`Added Vite plugin: ${name}`);
  }

  /**
   * Register dev server middleware
   *
   * @param path - URL path to match (e.g., '/api/custom')
   * @param options - Middleware configuration
   */
  addMiddleware(path: string, options: MiddlewareOptions): void {
    this.middlewares.push({ path, options });
    this.logger.debug(`Added middleware for path: ${path}`);
  }

  /**
   * Provide a value for other plugins to inject
   *
   * @param key - Unique key
   * @param value - Value to provide
   */
  provide<T>(key: string, value: T): void {
    this.sharedState.set(key, value);
    this.logger.debug(`Provided shared state: ${key}`);
  }

  /**
   * Inject a value provided by another plugin
   *
   * @param key - Key to inject
   * @returns Value or undefined if not provided
   */
  inject<T>(key: string): T | undefined {
    return this.sharedState.get(key) as T | undefined;
  }

  // === Getter methods for pipeline access ===

  /**
   * Get all element handlers for a specific type
   *
   * @param type - AST element type
   * @returns Array of handlers sorted by priority (higher first)
   */
  getElementHandlers(type: string): ElementHandler[] {
    const normalizedType = type.toLowerCase();
    const prioritizedHandlers = this.elementHandlers.get(normalizedType) ?? [];
    return prioritizedHandlers.map((ph) => ph.handler);
  }

  /**
   * Get the drawer handler for a specific drawer name
   *
   * @param name - Drawer name (case-insensitive)
   * @returns Handler or undefined if not registered
   */
  getDrawerHandler(name: string): DrawerHandler | undefined {
    return this.drawerHandlers.get(name.toUpperCase());
  }

  /**
   * Get all dynamic drawer matchers sorted by priority (higher first)
   *
   * @returns Array of matchers with matches function, handler, and priority
   */
  getDynamicDrawerMatchers(): Array<{
    matches: (drawer: DrawerNode) => boolean;
    handler: DrawerHandler;
    priority: number;
  }> {
    return [...this.dynamicDrawerMatchers];
  }

  /**
   * Get the block handler for a specific language
   *
   * @param language - Block language
   * @returns Handler or undefined if not registered
   */
  getBlockHandler(language: string): BlockHandler | undefined {
    return this.blockHandlers.get(language.toLowerCase());
  }

  /**
   * Get all hooks for a specific pipeline stage
   *
   * @param stage - Pipeline stage
   * @returns Array of handlers sorted by priority (higher first)
   */
  getHooks(stage: PipelineStage): StageHandler[] {
    const prioritizedHooks = this.pipelineHooks.get(stage) ?? [];
    return prioritizedHooks.map((ph) => ph.handler);
  }

  /**
   * Get all registered rehype plugins
   *
   * @returns Array of plugins with options in registration order
   */
  getRehypePlugins(): Array<{ plugin: RehypePlugin; options?: unknown }> {
    return [...this.rehypePlugins];
  }

  /**
   * Get all registered uniorg plugins
   *
   * @returns Array of plugins with options in registration order
   */
  getUniorgPlugins(): Array<{ plugin: UniorgPlugin; options?: unknown }> {
    return [...this.uniorgPlugins];
  }

  /**
   * Get a specific CLI command
   *
   * @param name - Command name
   * @returns Command options or undefined if not registered
   */
  getCommand(name: string): CommandOptions | undefined {
    return this.commands.get(name);
  }

  /**
   * Get a specific transformer
   *
   * @param name - Transformer name
   * @returns Transformer options or undefined if not registered
   */
  getTransformer(name: string): TransformerOptions | undefined {
    return this.transformers.get(name);
  }

  /**
   * Get all registered CLI commands
   *
   * @returns Map of command name to options
   */
  getAllCommands(): Map<string, CommandOptions> {
    return new Map(this.commands);
  }

  /**
   * Get all registered transformers
   *
   * @returns Map of transformer name to options
   */
  getAllTransformers(): Map<string, TransformerOptions> {
    return new Map(this.transformers);
  }

  /**
   * Get all registered Vite plugins
   *
   * @returns Array of Vite plugins
   */
  getVitePlugins(): VitePlugin[] {
    return [...this.vitePlugins];
  }

  /**
   * Get all registered middlewares
   *
   * @returns Array of middleware configurations with paths
   */
  getMiddlewares(): Array<{ path: string; options: MiddlewareOptions }> {
    return [...this.middlewares];
  }
}

export default PluginContextImpl;
