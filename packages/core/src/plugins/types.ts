import type { Position } from "unist";

/**
 * Unified block plugin interface
 *
 * Replaces the dual BlockPlugin/VirtualModuleBlockPlugin system from org-press v1.
 * Provides a clean, unified way to transform code blocks in org-mode files.
 */
export interface BlockPlugin {
  // Metadata
  /** Unique plugin name (used in :use parameter) */
  name: string;

  /** Default file extension for generated modules (js, tsx, css, etc.) */
  defaultExtension: string;

  // Matching logic
  /**
   * Custom matcher function
   * @returns true if this plugin should handle the block
   */
  matches?: (block: CodeBlock) => boolean;

  /**
   * Language names this plugin handles (e.g., ["javascript", "js", "typescript", "ts"])
   * Plugin matches if block.language is in this array
   */
  languages?: string[];

  /**
   * Plugin priority (higher = runs first)
   * Default: 0
   * Built-in plugins use 10
   * User plugins typically use 50-100
   */
  priority?: number;

  // Transformation hooks (all optional, choose what you need)

  /**
   * Transform code block for client-side execution
   * Called during dev mode and build for blocks without :use server
   *
   * @param block - The code block to transform
   * @param context - Transformation context with paths, parameters, etc.
   * @returns Transformed code that will be loaded as a virtual module
   */
  transform?: (
    block: CodeBlock,
    context: TransformContext
  ) => Promise<TransformResult> | TransformResult;

  /**
   * Generate code at build time
   * Called during static site generation for special build-time transformations
   *
   * @param block - The code block to transform
   * @param context - Transformation context
   * @returns Transformed code
   */
  onGenerate?: (
    block: CodeBlock,
    context: TransformContext
  ) => Promise<TransformResult> | TransformResult;

  /**
   * Transform code block for server-side execution
   * Called for blocks with :use server parameter
   *
   * @param block - The code block to transform
   * @param context - Transformation context
   * @returns Transformed code to execute on server
   */
  onServer?: (
    block: CodeBlock,
    context: TransformContext
  ) => Promise<TransformResult> | TransformResult;

  /**
   * CLI command registration (optional)
   * Plugins can provide CLI commands that extend the orgp CLI.
   *
   * Example: A test plugin might register "orgp test" command.
   */
  cli?: {
    /** Command name (e.g., "test") */
    command: string;

    /** Command description for help text */
    description: string;

    /**
     * Execute the command
     * @param args - Command line arguments (after the command name)
     * @param context - CLI context with config and paths
     * @returns Exit code (0 for success, non-zero for failure)
     */
    execute: (args: string[], context: CliContext) => Promise<number>;
  };
}

/**
 * Context provided to plugin CLI commands
 */
export interface CliContext {
  /** Resolved org-press configuration */
  config: any;

  /** Project root directory */
  projectRoot: string;

  /** Content directory path */
  contentDir: string;
}

/**
 * Context provided to plugin transformation hooks
 * Contains all necessary information without requiring file I/O
 */
export interface TransformContext {
  /** Relative path to the .org file (e.g., "content/post/my-post.org") */
  orgFilePath: string;

  /** 0-based index of this block in the file */
  blockIndex: number;

  /** Named block identifier (from #+NAME: directive), if present */
  blockName?: string;

  /** Parsed block parameters (e.g., { use: "preview | withSourceCode", height: "400px" }) */
  parameters: Record<string, string>;

  /** Available plugins (for dependency injection) */
  plugins: BlockPlugin[];

  /** Org-press configuration (for dependency injection) */
  config: any; // Using any to avoid circular dependency with config types

  /** Cache directory path for writing intermediate files */
  cacheDir: string;

  /** Base URL path for the site (e.g., "/" or "/org-press") */
  base: string;

  /** Content directory path */
  contentDir: string;

  /** Build output directory */
  outDir: string;

  /**
   * Content helpers for server execution (optional)
   * Only available when processing server-side blocks
   */
  contentHelpers?: {
    getContentPages: (options?: any) => Promise<any[]>;
    getContentPagesFromDirectory: (directory: string, options?: any) => Promise<any[]>;
    renderPageList: (pages: any[], options?: any) => string;
  };
}

/**
 * Result returned by plugin transformation hooks
 */
export interface TransformResult {
  /** Transformed code */
  code: string;

  // Future: source maps, dependencies, etc.
  // sourceMap?: string;
  // dependencies?: string[];
}

/**
 * Represents a code block from an org-mode file
 */
export interface CodeBlock {
  /** Programming language (e.g., "javascript", "python", "css") */
  language: string;

  /** Block content (source code) */
  value: string;

  /** Meta string containing block parameters (e.g., ":use preview | withSourceCode :height 400px") */
  meta?: string | null;

  /** Position in source file (for error reporting) */
  position?: Position;
}

// ===== Server Plugin Types =====

/**
 * Server execution result with metadata
 *
 * Returned by ServerHandler.onServer() after executing code on the server.
 */
export interface ServerExecutionResult {
  /** The actual result (any type) */
  result: any;
  /** Execution error if any */
  error?: Error;
  /** Time taken to execute in milliseconds */
  executionTime?: number;
  /** Whether this result was served from cache */
  cached?: boolean;
}

/**
 * Context passed to server handler onServer function
 */
export interface ServerHandlerContext {
  /** Content helper functions for querying pages */
  contentHelpers: {
    getContentPages: (options?: any) => Promise<any[]>;
    getContentPagesFromDirectory: (directory: string, options?: any) => Promise<any[]>;
    renderPageList: (pages: any[], options?: any) => string;
  };
  /** Relative path to the .org file */
  orgFilePath: string;
  /** 0-based index of this block in the file */
  blockIndex: number;
  /** Named block identifier (from #+NAME: directive), if present */
  blockName?: string;
  /** Parsed block parameters */
  params: Record<string, string>;
  /** The code block being executed */
  block: CodeBlock;
}

/**
 * Context passed to server handler onClient function
 */
export interface ServerClientContext {
  /** Unique block ID for DOM element targeting */
  blockId: string;
  /** Relative path to the .org file */
  orgFilePath: string;
  /** 0-based index of this block in the file */
  blockIndex: number;
  /** Parsed block parameters */
  params: Record<string, string>;
}

/**
 * Server handler for parameter-based execution
 *
 * Allows custom execution logic based on block parameters.
 * Use createServerHandler() factory for automatic timeout and error handling.
 *
 * @example
 * ```typescript
 * const handler: ServerHandler = {
 *   matches: (params, block) => params.use === 'server' && block.language === 'python',
 *   async onServer(code, context) {
 *     // Execute Python code
 *     return { result: 'output' };
 *   },
 *   onClient(result, context) {
 *     return `document.getElementById('${context.blockId}-result').textContent = ${JSON.stringify(result)};`;
 *   }
 * };
 * ```
 */
export interface ServerHandler {
  /**
   * Predicate to determine if this handler should process the block
   * @param params - Parsed block parameters (e.g., { use: 'server', engine: 'deno' })
   * @param block - The code block
   * @returns true if this handler matches
   */
  matches: (params: Record<string, string>, block: CodeBlock) => boolean;

  /**
   * Execute code on the server, return result
   * @param code - Source code to execute
   * @param context - Execution context with helpers and metadata
   * @returns Execution result with optional metadata
   */
  onServer: (
    code: string,
    context: ServerHandlerContext
  ) => Promise<ServerExecutionResult>;

  /**
   * Generate browser code to display result (optional)
   * If not provided, result is converted to string and displayed.
   * @param result - The result from onServer
   * @param context - Client context with block ID and metadata
   * @returns JavaScript code to execute in browser
   */
  onClient?: (result: any, context: ServerClientContext) => string;

  /**
   * Handler configuration options
   */
  options?: {
    /** Execution timeout in milliseconds (default: 30000) */
    timeout?: number;
    /** Additional custom options */
    [key: string]: any;
  };
}

// ===== Org Import Types =====

/**
 * Structure returned when importing an .org file
 */
export interface OrgImport<TBlocks extends Record<string, OrgBlock> = Record<string, OrgBlock>> {
  /** Rendered HTML content */
  html: string;
  /** Extracted frontmatter/metadata */
  metadata: OrgMetadata;
  /** All code blocks with their exports */
  blocks: OrgBlock[];
  /** Named blocks accessible by name */
  namedBlocks: TBlocks;
}

/**
 * Structure for individual code blocks
 */
export interface OrgBlock<TExports = unknown> {
  /** Block name from #+NAME: directive */
  name?: string;
  /** Original source code */
  code: string;
  /** Language identifier */
  language: string;
  /** Block index in the file */
  index: number;
  /** Block parameters */
  parameters: Record<string, string>;
  /** Runtime exports from executing the block */
  exports: TExports;
}

/**
 * Metadata extracted from org file
 */
export interface OrgMetadata {
  title?: string;
  author?: string;
  date?: string;
  layout?: string;
  status?: string;
  [key: string]: unknown;
}
