/**
 * Types for @org-press/type-check
 */

/**
 * A collected code block from an org file
 */
export interface CollectedBlock {
  /** Relative path to the org file */
  orgFilePath: string;
  /** 0-based index of the block in the file */
  blockIndex: number;
  /** Block name from #+NAME: directive */
  blockName?: string;
  /** The source code content */
  code: string;
  /** Block language (e.g., "typescript", "javascript") */
  language: string;
  /** 1-based line number where the block starts (#+begin_src line) */
  startLine: number;
  /** 1-based line number where the block ends (#+end_src line) */
  endLine: number;
}

/**
 * Options for collecting code blocks
 */
export interface CollectOptions {
  /** Filter by file path patterns */
  files?: string[];
  /** Filter by languages */
  languages?: string[];
}

/**
 * Options for the type-check command
 */
export interface TypeCheckOptions {
  /** Filter by file patterns */
  files?: string[];
}

/**
 * Languages that can be type-checked with TypeScript
 */
export const TYPECHECK_LANGUAGES = ["typescript", "ts", "tsx"];

/**
 * TypeScript compiler options
 */
export interface TsConfig {
  compilerOptions?: Record<string, unknown>;
  include?: string[];
  exclude?: string[];
  files?: string[];
}
