/**
 * Render API
 *
 * Unified composable render system for block rendering.
 * Replaces the old `export default` + legacy wrapper system.
 *
 * Key concepts:
 * - RenderFunction: `(result, ctx) => RenderResult` - renders block output
 * - Wrapper: `(render) => RenderFunction` - transforms a render function
 * - WrapperFactory: `(config?) => Wrapper` - creates configured wrappers
 *
 * @example
 * ```typescript
 * // In a code block:
 * export function render(result, ctx) {
 *   return <div className="my-render">{JSON.stringify(result)}</div>;
 * };
 * ```
 */

import type { JSX } from "react";

// ===== Core Types =====

/**
 * Result that can be rendered
 */
export type RenderResult = JSX.Element | string | null;

/**
 * Render function signature
 *
 * Takes the execution result and context, returns renderable output.
 */
export type RenderFunction = (result: unknown, ctx: BlockContext) => RenderResult;

/**
 * Wrapper function - transforms a render function
 *
 * Used to add functionality like tabs, error boundaries, etc.
 */
export type Wrapper = (render: RenderFunction) => RenderFunction;

/**
 * Wrapper factory - creates a configured wrapper
 *
 * @example
 * const withTabs = (config) => (render) => (result, ctx) => {
 *   return <Tabs>{render(result, ctx)}</Tabs>;
 * };
 */
export type WrapperFactory = (config?: Record<string, unknown>) => Wrapper;

/**
 * Context provided to render functions
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
 * Detect if code contains a render export
 *
 * Checks for `export function render` or `export { render }` patterns.
 *
 * @param code - Source code to check
 * @returns true if code exports a render function
 */
export function detectRender(code: string): boolean {
  // Match: export const render =
  // Match: export const render: Type =
  // Match: export { render }
  // Match: export { something as render }
  // Match: export function render(
  const patterns = [
    /export\s+const\s+render\s*[=:]/,
    /export\s+\{[^}]*\brender\b[^}]*\}/,
    /export\s+function\s+render\s*\(/,
  ];

  return patterns.some((pattern) => pattern.test(code));
}

/**
 * Extract render function from a module
 *
 * @param module - Module object (result of import or require)
 * @returns Render function if found, null otherwise
 */
export function extractRender(module: unknown): RenderFunction | null {
  if (!module || typeof module !== "object") {
    return null;
  }

  const mod = module as Record<string, unknown>;

  // Check for named render export
  if (typeof mod.render === "function") {
    return mod.render as RenderFunction;
  }

  return null;
}

/**
 * Check if a value is a valid RenderFunction
 */
export function isRenderFunction(value: unknown): value is RenderFunction {
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

// ===== Default Render =====

/**
 * Default render function for blocks without custom render
 *
 * Renders the result as JSON for objects/arrays, or as string for primitives.
 */
export const defaultRender: RenderFunction = (result, _ctx) => {
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

