/**
 * SSR Block Renderer
 *
 * Renders client block modules during SSR/SSG using Vite's ssrLoadModule.
 * Sets up a DOM environment (happy-dom) for modules that use browser APIs.
 *
 * Supports multiple export patterns:
 * - `export const Preview = (ctx) => <Component />` - React component
 * - `export default element` - DOM element (serialized to HTML)
 * - `export default "html"` - HTML string
 *
 * Usage:
 * ```typescript
 * const renderer = createBlockRenderer(viteServer);
 * const html = await renderer.render(cachePath, context);
 * ```
 */

import type { ViteDevServer } from "vite";
import { Window } from "happy-dom";
import { renderToString } from "react-dom/server";
import { createElement } from "react";

/**
 * Context passed to Preview components
 */
export interface BlockRenderContext {
  /** Block ID */
  blockId: string;
  /** Container element ID */
  containerId: string;
  /** Block language */
  language: string;
  /** Block name if specified */
  name?: string;
  /** Block parameters */
  params: Record<string, string>;
  /** Base URL */
  base: string;
}

/**
 * Result of SSR block rendering
 */
export interface BlockRenderResult {
  /** Rendered HTML content */
  html: string;
  /** Whether rendering succeeded */
  success: boolean;
  /** Error if rendering failed */
  error?: Error;
}

/**
 * Block renderer that uses Vite's SSR capabilities
 */
export interface BlockRenderer {
  /**
   * Render a block module to HTML
   *
   * @param modulePath - Path to the cached module file
   * @param context - Render context
   * @returns Rendered HTML or error
   */
  render(modulePath: string, context: BlockRenderContext): Promise<BlockRenderResult>;

  /**
   * Clean up resources (DOM environment, etc.)
   */
  dispose(): void;
}

/**
 * Create a block renderer for SSR
 *
 * @param server - Vite dev server (for ssrLoadModule)
 * @returns Block renderer instance
 */
export function createBlockRenderer(server?: ViteDevServer): BlockRenderer {
  // Create a shared happy-dom window for all renders
  // This provides document, window, etc. for modules that use browser APIs
  let window: Window | null = null;

  function getWindow(): Window {
    if (!window) {
      window = new Window({
        url: "http://localhost:3000",
        width: 1920,
        height: 1080,
      });
    }
    return window;
  }

  /**
   * Set up the global DOM environment
   */
  function setupDomEnvironment(): void {
    const win = getWindow();

    // Expose DOM globals
    (globalThis as any).window = win;
    (globalThis as any).document = win.document;
    (globalThis as any).navigator = win.navigator;
    (globalThis as any).HTMLElement = win.HTMLElement;
    (globalThis as any).Element = win.Element;
    (globalThis as any).Node = win.Node;
    (globalThis as any).NodeList = win.NodeList;
    (globalThis as any).Event = win.Event;
    (globalThis as any).CustomEvent = win.CustomEvent;
    (globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(cb, 16);
    (globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id);
    (globalThis as any).matchMedia = (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
    });
  }

  /**
   * Clean up the global DOM environment
   */
  function cleanupDomEnvironment(): void {
    delete (globalThis as any).window;
    delete (globalThis as any).document;
    delete (globalThis as any).navigator;
    delete (globalThis as any).HTMLElement;
    delete (globalThis as any).Element;
    delete (globalThis as any).Node;
    delete (globalThis as any).NodeList;
    delete (globalThis as any).Event;
    delete (globalThis as any).CustomEvent;
    delete (globalThis as any).requestAnimationFrame;
    delete (globalThis as any).cancelAnimationFrame;
    delete (globalThis as any).matchMedia;
  }

  /**
   * Load a module using Vite SSR or direct import
   */
  async function loadModule(modulePath: string): Promise<any> {
    if (server) {
      // Dev mode: use Vite's ssrLoadModule for HMR support
      return await server.ssrLoadModule(modulePath);
    } else {
      // Build mode: direct import (module should be pre-built)
      return await import(modulePath);
    }
  }

  /**
   * Serialize a DOM element to HTML string
   */
  function serializeElement(element: any): string {
    if (typeof element === "string") {
      return element;
    }

    if (element && typeof element.outerHTML === "string") {
      return element.outerHTML;
    }

    if (element && typeof element.innerHTML === "string") {
      return element.innerHTML;
    }

    return String(element);
  }

  return {
    async render(modulePath: string, context: BlockRenderContext): Promise<BlockRenderResult> {
      try {
        // Set up DOM environment before loading module
        setupDomEnvironment();

        // Load the module
        const mod = await loadModule(modulePath);

        // Check for different export patterns
        let html = "";

        // Pattern 1: export const Preview = (ctx) => <Component />
        if (typeof mod.Preview === "function") {
          const PreviewComponent = mod.Preview;
          html = renderToString(createElement(PreviewComponent, { ctx: context }));
        }
        // Pattern 2: export default function render(containerId) { ... }
        else if (typeof mod.default === "function") {
          // Create a container for the render function to use
          const win = getWindow();
          const container = win.document.createElement("div");
          container.id = context.containerId;
          win.document.body.appendChild(container);

          // Call the render function
          mod.default(context.containerId);

          // Extract the rendered HTML
          html = container.innerHTML;

          // Clean up
          container.remove();
        }
        // Pattern 3: export default element (DOM element)
        else if (mod.default && (mod.default.outerHTML || mod.default.innerHTML)) {
          html = serializeElement(mod.default);
        }
        // Pattern 4: export default "html string"
        else if (typeof mod.default === "string") {
          html = mod.default;
        }
        // Fallback: try to serialize whatever was exported
        else if (mod.default) {
          html = serializeElement(mod.default);
        }

        return { html, success: true };
      } catch (error) {
        // SSR failed - return empty result, client will hydrate
        console.warn(`[ssr-block-renderer] Failed to SSR render ${modulePath}:`, error);
        return {
          html: "",
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      } finally {
        // Clean up DOM environment
        cleanupDomEnvironment();
      }
    },

    dispose(): void {
      if (window) {
        window.close();
        window = null;
      }
      cleanupDomEnvironment();
    },
  };
}

/**
 * Render a single block module to HTML (convenience function)
 *
 * Creates a temporary renderer, renders the block, and disposes.
 * Use createBlockRenderer() for multiple renders for better performance.
 *
 * @param modulePath - Path to the cached module file
 * @param context - Render context
 * @param server - Optional Vite dev server
 * @returns Rendered HTML or empty string on error
 */
export async function renderBlockToHtml(
  modulePath: string,
  context: BlockRenderContext,
  server?: ViteDevServer
): Promise<string> {
  const renderer = createBlockRenderer(server);
  try {
    const result = await renderer.render(modulePath, context);
    return result.html;
  } finally {
    renderer.dispose();
  }
}
