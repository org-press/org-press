/**
 * DTS Generation Types
 *
 * Shared type definitions for the DTS (Declaration Type System) generation
 * subsystem. These types are used across manifest generation, position mapping,
 * and the DTS generator.
 */

/**
 * Information about a single code block in an org file
 */
export interface BlockInfo {
  /** Unique block ID: "{relativePath}:{index}" */
  id: string;
  /** Path to the org file (relative to project root) */
  orgFilePath: string;
  /** Block name from #+NAME: directive */
  name?: string;
  /** 0-based block index in the file */
  index: number;
  /** Programming language (e.g., "typescript", "javascript") */
  language: string;
  /** Start line in org file (1-based, points to #+begin_src line) */
  startLine: number;
  /** End line in org file (1-based, points to #+end_src line) */
  endLine: number;
  /** Start column (1-based) */
  startColumn: number;
  /** Block parameters from org-mode (e.g., :use, :tangle, :height) */
  parameters: Record<string, string>;
  /** Virtual module ID for this block */
  virtualModuleId: string;
  /** Block content (the actual code) */
  content: string;
}

/**
 * Block manifest for an entire project
 *
 * Contains all code blocks from org files in the project,
 * indexed for fast lookup by file path or virtual module ID.
 */
export interface BlockManifest {
  /** Version number for cache invalidation */
  version: number;
  /** Timestamp of last generation (ms since epoch) */
  generatedAt: number;
  /** Project root path (absolute) */
  projectRoot: string;
  /** All blocks indexed by org file path (relative) */
  blocksByFile: Map<string, BlockInfo[]>;
  /** All blocks indexed by virtual module ID */
  blocksByVirtualId: Map<string, BlockInfo>;
}

/**
 * Position in a file (0-based line and character)
 * Compatible with LSP Position type
 */
export interface Position {
  /** 0-based line number */
  line: number;
  /** 0-based character offset within the line */
  character: number;
}

/**
 * Range in a file
 * Compatible with LSP Range type
 */
export interface Range {
  /** Start position (inclusive) */
  start: Position;
  /** End position (exclusive) */
  end: Position;
}

/**
 * Location with file URI
 * Compatible with LSP Location type
 */
export interface Location {
  /** File URI (e.g., "file:///path/to/file.org") */
  uri: string;
  /** Range within the file */
  range: Range;
}

/**
 * Result of mapping an org position to a block
 */
export interface OrgToBlockResult {
  /** The block containing this position */
  block: BlockInfo;
  /** Position within the block content (0-based) */
  position: Position;
  /** Virtual module URI for this block */
  virtualUri: string;
}

/**
 * Result of mapping a block position to an org file
 */
export interface BlockToOrgResult {
  /** Org file path (relative to project root) */
  orgFilePath: string;
  /** Position in the org file (0-based) */
  position: Position;
  /** Org file URI */
  orgUri: string;
}

/**
 * Options for DTS generation
 */
export interface DtsGeneratorOptions {
  /** Content directory containing org files */
  contentDir: string;
  /** Project root path (defaults to cwd) */
  projectRoot?: string;
  /** Output directory for generated .d.ts files */
  outDir?: string;
  /** TypeScript compiler options override */
  compilerOptions?: Record<string, unknown>;
}

/**
 * Result of DTS generation
 */
export interface DtsGenerationResult {
  /** Generated declaration files: path -> content */
  declarations: Map<string, string>;
  /** Type errors encountered during generation */
  errors: Array<{ file: string; message: string }>;
  /** The block manifest used for generation */
  manifest: BlockManifest;
}

/**
 * Serializable block info for manifest JSON output
 */
export interface SerializableBlockInfo {
  id: string;
  orgFilePath: string;
  name?: string;
  index: number;
  language: string;
  startLine: number;
  endLine: number;
}

/**
 * Serializable manifest for JSON output
 */
export interface SerializableManifest {
  version: number;
  generatedAt: number;
  blocks: SerializableBlockInfo[];
}
