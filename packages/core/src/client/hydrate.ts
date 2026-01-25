/**
 * Org-Press Block Hydration
 *
 * Client-side script that hydrates interactive blocks.
 * Uses a manifest to map block IDs to their bundled JavaScript modules.
 * Leverages the Mode Plugin Architecture for rendering.
 *
 * Features:
 * - Lazy hydration with IntersectionObserver (optional)
 * - Error boundaries for individual blocks
 * - Works in both dev and production modes
 * - Mode-aware rendering (dom, react, etc.)
 */

import type { ClientModeContext, RenderFunction } from "../modes/types";
import { getModeForBlock } from "../modes/registry";
import { isReactElement, renderResult } from "../modes/dom/utils";

/**
 * ReactDOM root cache to avoid re-creating roots
 */
const reactRoots = new Map<HTMLElement, { render: (node: any) => void; unmount: () => void }>();

/**
 * Handle React block hydration directly
 *
 * Uses dynamic imports for React to avoid bundling React in the core package.
 * The render function is called as a React component to ensure hooks work correctly.
 */
async function hydrateReactBlock(
  element: HTMLElement,
  renderFn: Function,
  result: unknown
): Promise<void> {
  // Dynamically import React - these are expected to be in the user's node_modules
  const [ReactDOM, React] = await Promise.all([
    import(/* @vite-ignore */ 'react-dom/client'),
    import(/* @vite-ignore */ 'react'),
  ]);

  let root = reactRoots.get(element);
  if (!root) {
    root = ReactDOM.createRoot(element);
    reactRoots.set(element, root);
  }

  // Render the function as a React component
  // This ensures hooks are called within React's render context
  root.render(React.createElement(renderFn as React.ComponentType<{ result: unknown }>, { result }));
}

/**
 * Block manifest entry
 */
export interface BlockManifestEntry {
  /** Path to the bundled JavaScript module */
  src: string;
  /** Block name (from #+NAME: directive) */
  name?: string;
  /** Original language */
  language?: string;
  /** Mode name for rendering (e.g., "dom", "react") */
  modeName?: string;
}

/**
 * Block manifest - maps block IDs to their module info
 */
export interface BlockManifest {
  [blockId: string]: BlockManifestEntry;
}

/**
 * Hydration options
 */
export interface HydrateOptions {
  /** Use IntersectionObserver for lazy hydration (default: true) */
  lazy?: boolean;
  /** Root margin for IntersectionObserver (default: "100px") */
  rootMargin?: string;
  /** Show loading state while hydrating (default: false) */
  showLoading?: boolean;
}

/**
 * Hydrate a single block element using the Mode Plugin Architecture
 *
 * Uses the mode plugin's onClientHydrate method for rendering:
 * 1. Import block module
 * 2. Get execution result from `module.default`
 * 3. Get the appropriate mode plugin
 * 4. Build ModeContext with render function from module.render
 * 5. Call mode.onClientHydrate(result, ctx, element)
 *
 * Uses the module.render export for custom rendering.
 *
 * @param element - DOM element with data-org-block attribute
 * @param entry - Manifest entry for this block
 */
async function hydrateBlock(
  element: HTMLElement,
  entry: BlockManifestEntry
): Promise<void> {
  const containerId = element.id;
  const blockId = element.dataset.orgBlock || containerId;

  // Determine if this is a React block based on language
  const isReact = entry.language === 'tsx' || entry.language === 'jsx';

  try {
    // Mark as hydrating
    element.dataset.hydrating = "true";

    // Dynamically import the block module
    const module = await import(/* @vite-ignore */ entry.src);

    // Get execution result from default export
    let result = module.default;

    // Await if result is a Promise (from async IIFE wrapper)
    if (result && typeof result.then === "function") {
      result = await result;
    }

    // Remove hydrating state
    delete element.dataset.hydrating;
    element.dataset.hydrated = "true";

    // Get the render function from the module
    const renderFn = module.render;

    // Get the appropriate mode plugin
    const modeName = entry.modeName || 'dom';

    // Handle React blocks specially - use direct React hydration
    // This avoids needing to load @org-press/react package
    if (modeName === 'react' && renderFn) {
      await hydrateReactBlock(element, renderFn, result);
      return;
    }

    // Build the client mode context for other modes
    const ctx: ClientModeContext = {
      blockId,
      code: '', // Source code not available on client
      language: entry.language || '',
      params: {}, // Params not available on client
      render: renderFn as RenderFunction | undefined,
      orgFilePath: '', // Not available on client
      blockIndex: 0, // Not available on client
      containerId,
    };

    const mode = getModeForBlock(modeName, result, {
      blockId,
      language: entry.language || '',
      orgFilePath: '',
    });

    // Use mode's onClientHydrate for rendering
    await mode.onClientHydrate(result, ctx, element);
  } catch (error) {
    console.error(`[org-press] Failed to hydrate block ${containerId}:`, error);
    element.dataset.hydrated = "error";
    element.dataset.hydrateError = error instanceof Error ? error.message : String(error);
  }
}

/**
 * Initialize block hydration
 *
 * Finds all elements with data-org-block attribute and hydrates them
 * using the manifest embedded in the page or fetched from the server.
 *
 * @param manifest - Block manifest (if not provided, reads from window.__ORG_PRESS_MANIFEST__)
 * @param options - Hydration options
 */
export function hydrate(
  manifest?: BlockManifest,
  options: HydrateOptions = {}
): void {
  const { lazy = true, rootMargin = "100px" } = options;

  // Get manifest from parameter or global
  const blockManifest: BlockManifest =
    manifest || (window as any).__ORG_PRESS_MANIFEST__ || {};

  // Find all block containers
  const blocks = document.querySelectorAll<HTMLElement>("[data-org-block]");

  if (blocks.length === 0) {
    return;
  }

  // Hydration function for a single element
  const doHydrate = (element: HTMLElement) => {
    const blockId = element.dataset.orgBlock;
    if (!blockId) return;

    const entry = blockManifest[blockId];
    if (!entry) {
      console.warn(`[org-press] No manifest entry for block ${blockId}`);
      return;
    }

    hydrateBlock(element, entry);
  };

  if (lazy && "IntersectionObserver" in window) {
    // Lazy hydration - only hydrate blocks when they're near the viewport
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            observer.unobserve(entry.target);
            doHydrate(entry.target as HTMLElement);
          }
        });
      },
      { rootMargin }
    );

    blocks.forEach((block) => observer.observe(block));
  } else {
    // Immediate hydration
    blocks.forEach(doHydrate);
  }
}

/**
 * Auto-initialize on DOM ready
 *
 * This runs automatically when the script is loaded.
 * The manifest should be embedded in the page before this script.
 */
if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => hydrate());
  } else {
    // DOM already loaded
    hydrate();
  }
}
