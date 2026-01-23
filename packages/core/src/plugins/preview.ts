/**
 * Preview API
 *
 * Unified composable Preview system for block rendering.
 * Replaces the old `export default` + legacy wrapper system.
 *
 * Key concepts:
 * - PreviewFn: `(result, ctx) => PreviewResult` - renders block output
 * - Wrapper: `(preview) => PreviewFn` - transforms a preview function
 * - WrapperFactory: `(config?) => Wrapper` - creates configured wrappers
 *
 * @example
 * ```typescript
 * // In a code block:
 * export const Preview = (result, ctx) => {
 *   return <div className="my-preview">{JSON.stringify(result)}</div>;
 * };
 * ```
 */

import type { JSX } from "react";

// ===== Core Types =====

/**
 * Result that can be rendered
 */
export type PreviewResult = JSX.Element | string | null;

/**
 * Preview function signature
 *
 * Takes the execution result and context, returns renderable output.
 */
export type PreviewFn = (result: unknown, ctx: BlockContext) => PreviewResult;

/**
 * Wrapper function - transforms a preview function
 *
 * Used to add functionality like tabs, error boundaries, etc.
 */
export type Wrapper = (preview: PreviewFn) => PreviewFn;

/**
 * Wrapper factory - creates a configured wrapper
 *
 * @example
 * const withTabs = (config) => (preview) => (result, ctx) => {
 *   return <Tabs>{preview(result, ctx)}</Tabs>;
 * };
 */
export type WrapperFactory = (config?: Record<string, unknown>) => Wrapper;

/**
 * Context provided to preview functions
 */
export interface BlockContext {
  /** File information */
  file: {
    /** Relative path from content directory */
    path: string;
    /** Absolute file path */
    absolute: string;
  };

  /** Block information */
  block: {
    /** Raw block content/code */
    content: string;
    /** Block language (javascript, typescript, etc.) */
    language: string;
    /** Block name if specified via #+NAME: */
    name?: string;
    /** Block parameters from the header */
    params: Record<string, string>;
    /** Block index in the file (0-based) */
    index: number;
  };

  /** Runtime information */
  runtime: {
    /** Whether in development mode */
    isDev: boolean;
    /** Base URL for the site */
    baseUrl: string;
  };
}

// ===== Detection Utilities =====

/**
 * Detect if code contains a Preview export
 *
 * Checks for `export const Preview` or `export { Preview }` patterns.
 *
 * @param code - Source code to check
 * @returns true if code exports a Preview
 */
export function detectPreview(code: string): boolean {
  // Match: export const Preview =
  // Match: export const Preview: Type =
  // Match: export { Preview }
  // Match: export { something as Preview }
  // Match: export function Preview(
  const patterns = [
    /export\s+const\s+Preview\s*[=:]/,
    /export\s+\{[^}]*\bPreview\b[^}]*\}/,
    /export\s+function\s+Preview\s*\(/,
  ];

  return patterns.some((pattern) => pattern.test(code));
}

/**
 * Extract Preview function from a module
 *
 * @param module - Module object (result of import or require)
 * @returns Preview function if found, null otherwise
 */
export function extractPreview(module: unknown): PreviewFn | null {
  if (!module || typeof module !== "object") {
    return null;
  }

  const mod = module as Record<string, unknown>;

  // Check for named Preview export
  if (typeof mod.Preview === "function") {
    return mod.Preview as PreviewFn;
  }

  return null;
}

/**
 * Check if a value is a valid PreviewFn
 */
export function isPreviewFn(value: unknown): value is PreviewFn {
  return typeof value === "function";
}

// ===== Context Creation =====

/**
 * Options for creating block context
 */
export interface CreateBlockContextOptions {
  /** Relative file path */
  filePath: string;
  /** Absolute file path */
  absolutePath: string;
  /** Block source code */
  blockContent: string;
  /** Block language */
  blockLanguage: string;
  /** Block name */
  blockName?: string;
  /** Block parameters */
  blockParams: Record<string, string>;
  /** Block index */
  blockIndex: number;
  /** Development mode */
  isDev: boolean;
  /** Base URL */
  baseUrl: string;
}

/**
 * Create a BlockContext from options
 *
 * @param options - Context creation options
 * @returns BlockContext object
 */
export function createBlockContext(options: CreateBlockContextOptions): BlockContext {
  return {
    file: {
      path: options.filePath,
      absolute: options.absolutePath,
    },
    block: {
      content: options.blockContent,
      language: options.blockLanguage,
      name: options.blockName,
      params: options.blockParams,
      index: options.blockIndex,
    },
    runtime: {
      isDev: options.isDev,
      baseUrl: options.baseUrl,
    },
  };
}

// ===== Default Preview =====

/**
 * Default preview function for blocks without custom Preview
 *
 * Renders the result as JSON for objects/arrays, or as string for primitives.
 */
export const defaultPreview: PreviewFn = (result, _ctx) => {
  if (result === null || result === undefined) {
    return null;
  }

  if (typeof result === "string") {
    return result;
  }

  if (typeof result === "number" || typeof result === "boolean") {
    return String(result);
  }

  // For objects and arrays, return JSON string
  // (actual rendering with syntax highlighting can be done by wrappers)
  try {
    return JSON.stringify(result, null, 2);
  } catch {
    return String(result);
  }
};
