/**
 * Unified Plugin API
 *
 * Core types for the plugin system where everything is a plugin.
 *
 * Design principles:
 * 1. Core is just orchestration - pipeline stages + plugin registration
 * 2. Everything is a plugin - TOC, headings, highlight, code blocks, drawers
 * 3. Simple things are simple - factory functions for common patterns
 * 4. Complex things are possible - full setup(ctx) API as escape hatch
 * 5. Leverage existing ecosystem - rehype/uniorg plugins work directly
 */

import type { OrgData } from "uniorg";
import type { Plugin as UnifiedPlugin } from "unified";

// ===== Core Plugin Interface =====

/**
 * Base plugin interface returned by all factory functions
 */
export interface OrgPressPlugin {
  /** Unique plugin name */
  name: string;

  /**
   * Plugin priority (higher = runs first)
   * Default: 0
   * Built-in plugins use 10
   * User plugins typically use 50-100
   */
  priority?: number;

  /**
   * Setup function called during plugin initialization
   * Use this for complex plugins that need full PluginContext access
   */
  setup?: (ctx: PluginContext) => void | Promise<void>;

  // Internal markers set by factory functions
  _type?: PluginType;
  _config?: unknown;
}

export type PluginType =
  | "drawer"
  | "block"
  | "element"
  | "transformer"
  | "rehype"
  | "uniorg"
  | "command"
  | "vite"
  | "middleware"
  | "generic";

// ===== PluginContext API =====

/**
 * Context provided to plugin setup functions
 *
 * This is the escape hatch for complex plugins that need full control.
 */
export interface PluginContext {
  // === Element Handlers ===

  /**
   * Register a handler for any AST element type
   * @param type - AST node type (e.g., 'drawer', 'src-block', 'link')
   * @param handler - Transform function
   */
  onElement(type: string, handler: ElementHandler): void;

  /**
   * Register a drawer handler (convenience for onElement('drawer', ...))
   * @param name - Drawer name(s) to handle (case-insensitive)
   * @param handler - Transform function
   */
  onDrawer(name: string | string[], handler: DrawerHandler): void;

  /**
   * Register a dynamic drawer handler that matches based on a function
   *
   * Use this for drawers that should be matched by properties or other
   * conditions rather than just by name.
   *
   * @param matches - Function to determine if this handler should process a drawer
   * @param priority - Priority for matching (higher = matched first). Default: 10
   * @param handler - Transform function
   *
   * @example
   * // Match any drawer with a :SUMMARY: property
   * ctx.onDrawerMatch(
   *   (drawer) => !!drawer.properties?.SUMMARY,
   *   5,
   *   (drawer, ctx) => `<details><summary>${drawer.properties.SUMMARY}</summary>${drawer.html}</details>`
   * );
   */
  onDrawerMatch(
    matches: (drawer: DrawerNode) => boolean,
    priority: number,
    handler: DrawerHandler
  ): void;

  /**
   * Register a code block handler (convenience for onElement('src-block', ...))
   * @param language - Language(s) to handle
   * @param handler - Transform function
   */
  onBlock(language: string | string[], handler: BlockHandler): void;

  // === Pipeline Hooks ===

  /**
   * Hook into pipeline stages
   * @param stage - Pipeline stage
   * @param handler - Hook function
   */
  hook(stage: PipelineStage, handler: StageHandler): void;

  // === Unified Ecosystem ===

  /**
   * Add a rehype plugin to the render pipeline
   * @param plugin - rehype plugin
   * @param options - Plugin options
   */
  useRehype(plugin: RehypePlugin, options?: unknown): void;

  /**
   * Add a uniorg plugin to the parse pipeline
   * @param plugin - uniorg plugin
   * @param options - Plugin options
   */
  useUniorg(plugin: UniorgPlugin, options?: unknown): void;

  // === Extensions ===

  /**
   * Add a CLI command
   * @param name - Command name
   * @param options - Command configuration
   */
  addCommand(name: string, options: CommandOptions): void;

  /**
   * Add a transformer (for :use parameter)
   * @param name - Transformer name (used in :use)
   * @param options - Transformer configuration
   */
  addTransformer(name: string, options: TransformerOptions): void;

  // === Vite Integration ===

  /**
   * Register a Vite plugin to be included in the Vite config
   * @param plugin - Vite plugin to register
   */
  addVitePlugin(plugin: import("vite").Plugin): void;

  /**
   * Register dev server middleware
   * @param path - URL path to match (e.g., '/api/custom')
   * @param options - Middleware configuration
   */
  addMiddleware(path: string, options: MiddlewareOptions): void;

  // === Shared State ===

  /**
   * Provide a value for other plugins to inject
   * @param key - Unique key
   * @param value - Value to provide
   */
  provide<T>(key: string, value: T): void;

  /**
   * Inject a value provided by another plugin
   * @param key - Key to inject
   * @returns Value or undefined if not provided
   */
  inject<T>(key: string): T | undefined;

  // === Utilities ===

  /** Org-press configuration */
  config: OrgPressConfig;

  /** Project root directory */
  projectRoot: string;

  /** Logger instance */
  logger: Logger;
}

// ===== Pipeline Stages =====

export type PipelineStage =
  | "parse:before" // Before uniorg parsing
  | "parse:after" // After uniorg, before transforms
  | "transform:before" // Before element transforms
  | "transform:after" // After element transforms
  | "render:before" // Before rehype processing
  | "render:after" // After HTML generation
  | "build:start" // Build started
  | "build:end"; // Build finished

// ===== Handler Types =====

export interface ElementHandler {
  /**
   * Optional filter - return true to handle this element
   */
  match?: (node: unknown) => boolean;

  /**
   * Transform the element
   * @returns HTML string, null to remove, or undefined to pass through
   */
  transform: (node: unknown, ctx: TransformContext) => string | null | undefined;
}

export interface DrawerHandler {
  (drawer: DrawerNode, ctx: TransformContext): string | null | Promise<string | null>;
}

export interface BlockHandler {
  (block: CodeBlockNode, ctx: BlockTransformContext): TransformResult | Promise<TransformResult>;
}

export interface StageHandler {
  (payload: StagePayload): void | Promise<void>;
}

// ===== Node Types =====

export interface DrawerNode {
  /** Drawer name (e.g., "AI", "NOTE", "PROPERTIES") */
  name: string;

  /** Raw children from AST */
  children: unknown[];

  /** Pre-rendered HTML content of the drawer body (excluding properties) */
  html: string;

  /**
   * Extracted drawer properties (e.g., :SUMMARY:, :AUTHOR:)
   *
   * Properties are key-value pairs defined inside the drawer using
   * :PROPERTY: value syntax. Keys are normalized to UPPERCASE.
   *
   * @example
   * ```org
   * :AI:
   * :SUMMARY: This was AI generated
   * Content here...
   * :END:
   * ```
   * Results in: { SUMMARY: "This was AI generated" }
   */
  properties: Record<string, string>;
}

export interface CodeBlockNode {
  /** Programming language */
  language: string;

  /** Block content (source code) */
  value: string;

  /** Meta string containing block parameters */
  meta?: string | null;

  /** Position in source file */
  position?: {
    start: { line: number; column: number; offset?: number };
    end: { line: number; column: number; offset?: number };
  };
}

/**
 * Alias for CodeBlockNode (compatibility)
 */
export type CodeBlock = CodeBlockNode;

// ===== Server Execution Types =====

/**
 * Context for server-side code execution
 */
export interface ServerHandlerContext {
  /** Path to the .org file */
  orgFilePath: string;

  /** Block index in file */
  blockIndex: number;

  /** Named block identifier (from #+NAME: directive) */
  blockName?: string;

  /** Parsed block parameters */
  params: Record<string, string>;

  /** The code block being executed */
  block: CodeBlock;

  /** Content helpers for accessing other org files */
  contentHelpers?: ContentHelpers;
}

/**
 * Context for client-side code generation
 */
export interface ServerClientContext {
  /** Unique identifier for this block */
  blockId: string;

  /** Path to the .org file */
  orgFilePath: string;

  /** Block index in file */
  blockIndex: number;

  /** Parsed block parameters */
  params: Record<string, string>;
}

/**
 * Result of server-side code execution
 */
export interface ServerExecutionResult {
  /** Execution result value */
  result: unknown;

  /** Error if execution failed */
  error?: Error;

  /** Execution time in milliseconds */
  executionTime: number;
}

/**
 * Handler for server-side block execution
 */
export interface ServerHandler {
  /** Function to determine if this handler matches a block */
  matches: (params: Record<string, string>, block: CodeBlock) => boolean;

  /** Options for execution */
  options?: {
    timeout?: number;
    [key: string]: unknown;
  };

  /** Server-side execution */
  onServer: (code: string, context: ServerHandlerContext) => Promise<ServerExecutionResult>;

  /** Client-side code generation (optional) */
  onClient?: (result: unknown, context: ServerClientContext) => string;
}

// ===== Transform Types =====

export interface TransformContext {
  /** Relative path to the .org file */
  orgFilePath: string;

  /** Base URL path for the site */
  base: string;

  /** Org-press configuration */
  config: OrgPressConfig;
}

/**
 * Alias for TransformContext (used in drawer plugins)
 */
export type DrawerTransformContext = TransformContext;

export interface BlockTransformContext extends TransformContext {
  /** 0-based index of this block in the file */
  blockIndex: number;

  /** Named block identifier (from #+NAME: directive) */
  blockName?: string;

  /** Parsed block parameters */
  parameters: Record<string, string>;

  /** Available plugins */
  plugins: OrgPressPlugin[];

  /** Cache directory path */
  cacheDir: string;

  /** Content directory path */
  contentDir: string;

  /** Build output directory */
  outDir: string;

  /** Content helpers for server execution */
  contentHelpers?: ContentHelpers;

  /** Build command: 'build' for production build, 'serve' for dev server */
  command?: "build" | "serve";
}

export interface TransformResult {
  /** Transformed code or HTML */
  code?: string;

  /** HTML output */
  html?: string;

  /** Additional script to inject */
  script?: string;

  /** Additional CSS to inject */
  css?: string;
}

// ===== Transformer Types (for :use parameter) =====

export interface TransformerOptions {
  /**
   * Build-time transform (Node.js environment)
   * Runs during SSG/SSR
   */
  onBuild?: (input: TransformerInput, ctx: BuildContext) => TransformerOutput;

  /**
   * Server-side execution (Node.js environment)
   * Runs for :use server blocks
   */
  onServer?: (code: string, ctx: ServerContext) => Promise<unknown>;

  /**
   * Client-side code (browser environment)
   *
   * Can be either:
   * - Function returning dynamic import (for complex cases with proper bundling)
   * - String of inline JS (for simple cases)
   */
  client?: (() => Promise<ClientModule>) | string;
}

export interface TransformerInput {
  /** Original source code */
  code: string;

  /** Block language */
  language: string;

  /** Block parameters */
  params: Record<string, string>;

  /** HTML from previous transformer in pipeline */
  html?: string;

  /** Result from onServer */
  result?: unknown;

  /** Data to pass to client */
  clientData?: unknown;
}

export interface TransformerOutput {
  /** HTML output */
  html?: string;

  /** Result for passing to next transformer */
  result?: unknown;

  /** Data for client hydration */
  clientData?: unknown;

  /** Additional script to inject */
  script?: string;

  /** Additional styles to inject */
  css?: string;
}

export interface BuildContext {
  /** Unique block ID for DOM targeting */
  id: string;

  /** Original source code */
  code: string;

  /** Relative path to org file */
  orgFilePath: string;

  /** Block index */
  blockIndex: number;

  /** Named block identifier (from #+NAME: directive) */
  blockName?: string;

  /** Block parameters */
  params: Record<string, string>;
}

export interface ServerContext extends BuildContext {
  /**
   * Execute code in sandboxed environment
   */
  execute: (code: string) => Promise<unknown>;

  /** Content helpers */
  contentHelpers?: ContentHelpers;
}

export interface ClientModule {
  /**
   * Called when element is mounted in DOM
   * @returns Optional cleanup function
   */
  onMount?: (element: HTMLElement, ctx: ClientContext) => void | (() => void);

  /**
   * Called when element is unmounted
   */
  onUnmount?: (element: HTMLElement) => void;

  /**
   * Called when element data updates (HMR)
   */
  onUpdate?: (element: HTMLElement, ctx: ClientContext) => void;
}

export interface ClientContext {
  /** Unique block ID */
  blockId: string;

  /** Data passed from server */
  data?: unknown;

  /** Block parameters */
  params: Record<string, string>;
}

// ===== Command Types =====

export interface CommandOptions {
  /** Command description for help text */
  description: string;

  /** Command argument definitions */
  args?: ArgDefinition[];

  /**
   * Execute the command
   * @returns Exit code (0 for success)
   */
  execute: (args: ParsedArgs, ctx: CommandContext) => Promise<number>;
}

export interface ArgDefinition {
  name: string;
  type: "string" | "boolean" | "number";
  description?: string;
  required?: boolean;
  default?: string | boolean | number;
  /** Short alias for the argument (single character, e.g., 'v' for --verbose) */
  alias?: string;
}

export interface ParsedArgs {
  [key: string]: string | boolean | number | string[] | undefined;
  /** Positional arguments */
  _: string[];
}

export interface CommandContext {
  /** Org-press configuration */
  config: OrgPressConfig;

  /** Project root directory */
  projectRoot: string;

  /** Content directory path */
  contentDir: string;
}

// ===== Middleware Types =====

/**
 * HTTP methods supported by middleware
 */
export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS";

/**
 * Middleware handler function signature
 */
export type MiddlewareHandler = (
  req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse,
  next: () => void
) => void | Promise<void>;

/**
 * Configuration options for middleware plugins
 */
export interface MiddlewareOptions {
  /** HTTP methods to handle. Default: all methods */
  methods?: HttpMethod[];

  /** Handler function */
  handler: MiddlewareHandler;
}

// ===== Stage Payload Types =====

export interface StagePayload {
  stage: PipelineStage;

  // Available depending on stage
  source?: string; // parse:before
  ast?: OrgData; // parse:after, transform:*
  html?: string; // render:after
  metadata?: Record<string, unknown>; // All stages after parse
}

// ===== Unified Ecosystem Types =====

export type RehypePlugin = UnifiedPlugin;
export type UniorgPlugin = UnifiedPlugin;

// ===== Utility Types =====

export interface Logger {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
}

export interface ContentHelpers {
  getContentPages: (options?: unknown) => Promise<unknown[]>;
  getContentPagesFromDirectory: (directory: string, options?: unknown) => Promise<unknown[]>;
  renderPageList: (pages: unknown[], options?: unknown) => string;
}

// Placeholder - will be imported from config module
export interface OrgPressConfig {
  contentDir: string;
  cacheDir: string;
  outDir: string;
  base: string;
  plugins?: OrgPressPlugin[];
  [key: string]: unknown;
}
