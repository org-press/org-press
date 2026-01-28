import type { OrgData } from "uniorg";
import type { BlockPlugin } from "../plugins/types.ts";
import type { OrgPressConfig, PageMetadata as ConfigPageMetadata } from "../config/types.ts";
import type { HydrateRegistry } from "../node/build/hydrate-registry.ts";

// Re-export PageMetadata for external use
export type { ConfigPageMetadata as PageMetadata };

/**
 * Parser layer types
 *
 * The parser layer is pure - all dependencies are injected via context.
 * No file I/O, no Vite knowledge, just AST transformations.
 */

/**
 * Context provided to parser functions
 *
 * Contains all necessary information without requiring file I/O.
 * Dependencies are injected from the build layer.
 */
export interface ParseContext {
  /** Relative path to the .org file being parsed */
  orgFilePath: string;

  /** Loaded plugins (sorted by priority) */
  plugins: BlockPlugin[];

  /** Resolved org-press configuration */
  config: OrgPressConfig;

  /** Cache directory for intermediate files */
  cacheDir: string;

  /** Base URL path for the site */
  base: string;

  /** Content directory path */
  contentDir: string;

  /** Build output directory */
  outDir: string;

  /** Environment mode (development or production) */
  mode?: "development" | "production";

  /** Optional hydrate registry for build-time block collection */
  hydrateRegistry?: HydrateRegistry;
}

/**
 * Block collected for hydration manifest
 */
export interface CollectedBlock {
  /** Unique block ID (e.g., "content/index.org:0") */
  id: string;
  /** Container element ID */
  containerId: string;
  /** Path to the source file in cache */
  cachePath: string;
  /** Virtual module ID for Vite resolution (e.g., "virtual:org-press:block:preview:content/index.org:0.tsx") */
  virtualModuleId: string;
  /** Block name (from #+NAME: directive) */
  name?: string;
  /** Original language */
  language: string;
  /** Mode name for rendering (e.g., "dom", "react") */
  modeName: string;
}

/**
 * Result of parsing an org-mode file
 */
export interface ParsedOrg {
  /** Parsed and transformed AST */
  ast: OrgData;

  /** Extracted metadata from org keywords */
  metadata: ConfigPageMetadata;

  /** Virtual modules generated during parsing */
  virtualModules: VirtualModule[];

  /** Cache files written during parsing */
  cacheFiles: CacheFile[];

  /** Blocks that need client-side hydration */
  collectedBlocks: CollectedBlock[];
}

/**
 * Virtual module generated from a code block
 *
 * Virtual modules are Vite's way of creating modules that don't exist as files.
 * The build layer will handle resolving and loading these.
 */
export interface VirtualModule {
  /** Virtual module ID (e.g., "virtual:org-press:block:jscad:content/post.org:0.js") */
  id: string;

  /** Plugin that generated this module */
  pluginName: string;

  /** Block index in the org file */
  blockIndex: number;

  /** Named block identifier (if block has #+NAME:) */
  blockName?: string;

  /** Code to be loaded when this module is imported */
  code: string;

  /** Language/extension */
  extension: string;
}

/**
 * Cache file written during parsing
 *
 * Cache files store extracted code blocks for execution.
 */
export interface CacheFile {
  /** Full path to the cache file */
  path: string;

  /** Code content */
  code: string;

  /** Language */
  language: string;

  /** Block name (if named) */
  blockName?: string;
}

/**
 * Parsed parameters from a code block
 *
 * The `:use` parameter is the primary way to control block behavior:
 * - `:use dom` - Execute and render with render function (default)
 * - `:use sourceOnly` - Show source code without executing
 * - `:use silent` - Execute but don't show output
 * - `:use raw` - Execute and output result directly
 * - `:use server` - Execute on server during SSR/build
 *
 * Wrappers can be piped after the mode:
 * - `:use dom | withSourceCode` - Show both source and result
 * - `:use dom | withCollapse?open` - Collapsible output
 * - `:use server | json` - Server execution with JSON formatting
 */
export interface BlockParameters {
  /** Mode and wrappers pipeline (e.g., "preview | withSourceCode?position=before") */
  use?: string;

  /** Tangle file path (for literate programming) */
  tangle?: string;

  /** Custom height for block display */
  height?: string;

  /** Additional parameters */
  [key: string]: string | undefined;
}

/**
 * Code block with parsed metadata
 *
 * Extends the basic CodeBlock with parsed parameters and context
 */
export interface ParsedCodeBlock {
  /** Programming language */
  language: string;

  /** Block content */
  value: string;

  /** Raw meta string */
  meta?: string | null;

  /** Parsed parameters */
  parameters: BlockParameters;

  /** Block index in file */
  index: number;

  /** Named block identifier (from #+NAME:) */
  name?: string;

  /** Plugin that will handle this block (if matched) */
  plugin?: BlockPlugin;
}

/**
 * Result of executing server-side code
 */
export interface ServerExecutionResult {
  /** Execution output (console.log, return value, etc.) */
  output: string;

  /** Error if execution failed */
  error?: Error;

  /** Execution time in milliseconds */
  executionTime?: number;
}
