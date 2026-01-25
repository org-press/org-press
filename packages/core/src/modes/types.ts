/**
 * Mode Plugin Architecture Types
 *
 * Defines the interfaces for pluggable rendering modes in org-press.
 * Modes handle how code blocks are rendered on the server and hydrated on the client.
 */

/**
 * Block render function
 *
 * Exported as `export function render()` from blocks.
 * Receives the block's result and optionally the container element.
 */
export type RenderFunction = (
  result: unknown,
  element?: HTMLElement
) => string | HTMLElement | void;

/**
 * Context provided to mode plugins during server-side rendering
 */
export interface ModeContext {
  /** Block ID for targeting */
  blockId: string;

  /** Original source code */
  code: string;

  /** Block language */
  language: string;

  /** Parsed parameters */
  params: Record<string, string>;

  /** Block's render function (if exported) */
  render?: RenderFunction;

  /** Org file path */
  orgFilePath: string;

  /** Block index */
  blockIndex: number;
}

/**
 * Extended context for client-side hydration
 */
export interface ClientModeContext extends ModeContext {
  /** Container element ID */
  containerId: string;
}

/**
 * Mode Plugin Interface
 *
 * A ModePlugin defines how a code block is:
 * 1. Rendered on the server (SSR / static generation)
 * 2. Hydrated on the client (browser)
 *
 * @example
 * ```typescript
 * const myMode: ModePlugin = {
 *   name: 'custom',
 *   onServerRender(result, ctx) {
 *     return `<div>${result}</div>`;
 *   },
 *   onClientHydrate(result, ctx, element) {
 *     element.innerHTML = `<div>${result}</div>`;
 *   }
 * };
 * ```
 */
export interface ModePlugin {
  /**
   * Unique mode name (used in :use parameter)
   * @example "dom", "react", "rust"
   */
  name: string;

  /**
   * Render block result to HTML string on the server
   *
   * Called during:
   * - Vite dev server SSR
   * - Static site generation (if onGenerate not provided)
   *
   * @param result - The executed block's default export
   * @param ctx - Block context (file, params, metadata)
   * @returns HTML string to inject into page
   */
  onServerRender(result: unknown, ctx: ModeContext): string | Promise<string>;

  /**
   * Render block during static generation (optional)
   *
   * Called only during `orgp build`. Falls back to onServerRender
   * if not provided. Use this when generate differs from dev SSR
   * (e.g., pre-rendering with different optimizations).
   *
   * @param result - The executed block's default export
   * @param ctx - Block context
   * @returns HTML string for static output
   */
  onGenerate?(result: unknown, ctx: ModeContext): string | Promise<string>;

  /**
   * Hydrate the block in the browser
   *
   * Called when the block's container enters the viewport
   * (or immediately if lazy loading is disabled).
   *
   * @param result - The executed block's default export
   * @param ctx - Block context with additional client info
   * @param element - DOM element to render into
   */
  onClientHydrate(
    result: unknown,
    ctx: ClientModeContext,
    element: HTMLElement
  ): void | Promise<void>;

  /**
   * Check if this mode can handle a result type
   *
   * Used to detect unhandled blocks and show helpful errors.
   *
   * @param result - The block's result
   * @returns true if this mode can render the result
   */
  canHandle?(result: unknown): boolean;

  /**
   * Cleanup when block is removed from DOM (optional)
   *
   * @param element - The container element being removed
   */
  onUnmount?(element: HTMLElement): void;
}
