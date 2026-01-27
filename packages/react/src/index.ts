/**
 * @org-press/react - React mode plugin for org-press
 *
 * Provides React rendering and hydration for org-press code blocks.
 *
 * @example
 * ```typescript
 * // .org-press/config.ts
 * import { defineConfig } from 'org-press';
 * import { reactPlugin } from '@org-press/react';
 *
 * export default defineConfig({
 *   plugins: [reactPlugin],
 * });
 * ```
 *
 * @example
 * ```org
 * #+begin_src tsx :use react
 * import { useState } from 'react';
 *
 * export function render() {
 *   const [count, setCount] = useState(0);
 *   return <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>;
 * }
 * #+end_src
 * ```
 */

import type * as React from "react";
import { isReactElement } from "./utils.ts";

// Re-define types from org-press to avoid build dependency issues
// These types match the ModePlugin interface from org-press/src/modes/types.ts

/**
 * Block render function type
 */
export type RenderFunction = (
  result: unknown,
  element?: HTMLElement
) => string | HTMLElement | void;

/**
 * Context provided to mode plugins during server-side rendering
 */
export interface ModeContext {
  blockId: string;
  code: string;
  language: string;
  params: Record<string, string>;
  render?: RenderFunction;
  orgFilePath: string;
  blockIndex: number;
}

/**
 * Extended context for client-side hydration
 */
export interface ClientModeContext extends ModeContext {
  containerId: string;
}

/**
 * Mode Plugin Interface
 *
 * A ModePlugin defines how a code block is:
 * 1. Rendered on the server (SSR / static generation)
 * 2. Hydrated on the client (browser)
 */
export interface ModePlugin {
  name: string;
  onServerRender(result: unknown, ctx: ModeContext): string | Promise<string>;
  onGenerate?(result: unknown, ctx: ModeContext): string | Promise<string>;
  onClientHydrate(
    result: unknown,
    ctx: ClientModeContext,
    element: HTMLElement
  ): void | Promise<void>;
  canHandle?(result: unknown): boolean;
  onUnmount?(element: HTMLElement): void;
}

// Re-export utility
export { isReactElement } from "./utils.ts";

/**
 * React Root type (compatible with react-dom/client createRoot return type)
 */
interface ReactRoot {
  render(children: React.ReactNode): void;
  unmount(): void;
}

/**
 * Map to track React roots for cleanup
 * Keys are DOM elements, values are React root instances
 */
const reactRoots = new Map<HTMLElement, ReactRoot>();

/**
 * React mode plugin for org-press
 *
 * Handles:
 * - Server-side rendering with renderToString
 * - Client-side hydration with createRoot
 * - Cleanup of React roots on unmount
 *
 * Supports both:
 * - Direct React element exports: `export default <Component />`
 * - Render function pattern: `export function render({ result }) { return <View data={result} /> }`
 */
export const reactMode: ModePlugin = {
  name: "react",

  /**
   * Server-side render a React block
   *
   * Lazily imports react-dom/server to avoid bundling React unnecessarily.
   */
  async onServerRender(result: unknown, ctx: ModeContext): Promise<string> {
    // Lazy load React to avoid bundling when not needed
    const { renderToString } = await import("react-dom/server");
    const React = await import("react");

    // If block has a render component, render it with result as prop
    // This enables the pattern:
    //   export function render({ result }) { return <Component data={result} /> }
    //   export default await fetchData();
    if (ctx.render) {
      // Create element from render function (treated as React component)
      // This ensures hooks work correctly
      const element = React.createElement(
        ctx.render as React.ComponentType<{ result: unknown }>,
        { result }
      );
      return renderToString(element);
    }

    // Otherwise render result directly if it's a React element
    if (isReactElement(result)) {
      return renderToString(result as React.ReactElement);
    }

    // Fallback to text for non-React results
    return String(result ?? "");
  },

  /**
   * Hydrate a React block in the browser
   *
   * Creates a React root for the container element and renders the component.
   * Tracks roots for cleanup on unmount.
   */
  async onClientHydrate(
    result: unknown,
    ctx: ClientModeContext,
    element: HTMLElement
  ): Promise<void> {
    // Lazy load React DOM client
    const [ReactDOM, React] = await Promise.all([
      import("react-dom/client"),
      import("react"),
    ]);

    // Get or create React root for this element
    let root = reactRoots.get(element);
    if (!root) {
      root = ReactDOM.createRoot(element);
      reactRoots.set(element, root);
    }

    if (ctx.render) {
      // Render component with result as prop
      // Using createElement ensures hooks work correctly
      // (passing render directly to createElement treats it as a component)
      root.render(
        React.createElement(
          ctx.render as React.ComponentType<{ result: unknown }>,
          { result }
        )
      );
    } else if (isReactElement(result)) {
      // Render the React element directly
      root.render(result as React.ReactElement);
    }
  },

  /**
   * Clean up React root when element is removed from DOM
   */
  onUnmount(element: HTMLElement): void {
    const root = reactRoots.get(element);
    if (root) {
      root.unmount();
      reactRoots.delete(element);
    }
  },

  /**
   * Check if this mode can handle the result
   *
   * React mode handles React elements (identified by $$typeof symbol)
   */
  canHandle(result: unknown): boolean {
    return isReactElement(result);
  },
};

/**
 * Create a React mode plugin instance
 *
 * This is the recommended way to use React mode in your org-press config.
 *
 * @example
 * ```typescript
 * import { defineConfig } from 'org-press';
 * import { useReact } from '@org-press/react';
 *
 * export default defineConfig({
 *   modes: [useReact()],
 * });
 * ```
 *
 * @returns ModePlugin instance for React rendering
 */
export function useReact(): ModePlugin {
  return reactMode;
}

// ============================================================================
// Block Plugin for :use react
// ============================================================================

/**
 * Block Plugin Interface (matches org-press BlockPlugin)
 */
export interface BlockPlugin {
  name: string;
  defaultExtension?: string;
  languages?: string[];
  priority?: number;
  matches?(block: { value: string; language: string; meta: string }): boolean;
  transform(
    block: { value: string; language: string; meta: string },
    context: { orgFilePath: string; blockIndex: number; parameters: Record<string, string> }
  ): Promise<{ code: string; css?: string }> | { code: string; css?: string };
}

/**
 * Parse block parameters from meta string
 */
function parseBlockParameters(meta: string | null | undefined): Record<string, string> {
  if (!meta) return {};
  const params: Record<string, string> = {};
  const regex = /:(\w+)(?:\s+([^\s:]+))?/g;
  let match;
  while ((match = regex.exec(meta)) !== null) {
    const [, key, value] = match;
    params[key] = value ?? "";
  }
  return params;
}

/**
 * Rewrite .org imports to virtual module imports
 */
function rewriteOrgImports(code: string, orgFilePath: string): string {
  // Match import statements with .org files
  return code.replace(
    /from\s+["']([^"']+\.org(?:\?[^"']*)?)['"]/g,
    (match, importPath) => {
      // Keep the import path as-is, Vite plugin handles resolution
      return match;
    }
  );
}

/**
 * Languages supported by React plugin
 */
const REACT_LANGUAGES = ["tsx", "jsx", "typescript", "javascript", "ts", "js"];

/**
 * Default React render wrapper
 *
 * This wraps the user's render function to ensure proper React rendering.
 * The render function should return a React element.
 */
const REACT_RENDER_WRAPPER = `
// React render wrapper - exports render for hydration
export { render };
`.trim();

/**
 * React Plugin for org-press
 *
 * Handles blocks with :use react for React component rendering.
 *
 * Usage:
 * #+begin_src tsx :use react
 * import { useState } from 'react';
 *
 * export function render() {
 *   const [count, setCount] = useState(0);
 *   return <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>;
 * }
 * #+end_src
 */
export const reactPlugin: BlockPlugin = {
  name: "react",
  defaultExtension: "tsx",
  priority: 50, // Same as domPlugin - matches :use parameter

  /**
   * Match blocks with :use react
   */
  matches(block) {
    const params = parseBlockParameters(block.meta);
    const useValue = params.use || "";
    const firstPart = useValue.split("|")[0].trim();
    return firstPart === "react";
  },

  /**
   * Transform React code
   *
   * Expects code to export a `render` function that returns a React element.
   * The render function will be called during hydration.
   */
  async transform(block, context) {
    const language = block.language.toLowerCase();

    if (!REACT_LANGUAGES.includes(language)) {
      // For non-JS languages, just return as string
      return {
        code: `export default ${JSON.stringify(block.value)};`,
      };
    }

    // Rewrite .org imports
    let code = rewriteOrgImports(block.value, context.orgFilePath);

    // Check if code already has a render export
    const hasRenderExport = /export\s+(function|const)\s+render\b/.test(code) ||
                            /export\s*\{[^}]*\brender\b[^}]*\}/.test(code);

    if (!hasRenderExport) {
      // If no render function, check for default export
      const hasDefaultExport = /export\s+default\b/.test(code);

      if (!hasDefaultExport) {
        // Wrap the code to make the last expression the default export
        // This allows simple JSX expressions like: <Button>Click me</Button>
        code = `${code}\n\n// No render function found - code will be executed but not rendered`;
      }
    }

    return { code };
  },
};

// Default export for convenience
export default reactMode;
