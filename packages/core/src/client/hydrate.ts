/**
 * Org-Press Block Hydration
 *
 * Client-side script that hydrates interactive blocks.
 * Uses a manifest to map block IDs to their bundled JavaScript modules.
 *
 * Features:
 * - Lazy hydration with IntersectionObserver (optional)
 * - Error boundaries for individual blocks
 * - Works in both dev and production modes
 */

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
 * Hydrate a single block element
 *
 * @param element - DOM element with data-org-block attribute
 * @param entry - Manifest entry for this block
 */
async function hydrateBlock(
  element: HTMLElement,
  entry: BlockManifestEntry
): Promise<void> {
  const containerId = element.id;

  try {
    // Mark as hydrating
    element.dataset.hydrating = "true";

    // Dynamically import the block module
    const module = await import(/* @vite-ignore */ entry.src);
    let result = module.default;

    // Await if result is a Promise (from async IIFE wrapper)
    if (result && typeof result.then === "function") {
      result = await result;
    }

    // Remove hydrating state
    delete element.dataset.hydrating;
    element.dataset.hydrated = "true";

    // Handle different result types
    if (typeof result === "function") {
      // Plugin exports a render function - call it with container ID
      result(containerId);
    } else if (result !== undefined && result !== null) {
      renderResult(element, result);
    }
  } catch (error) {
    console.error(`[org-press] Failed to hydrate block ${containerId}:`, error);
    element.dataset.hydrated = "error";
    element.dataset.hydrateError = error instanceof Error ? error.message : String(error);
  }
}

/**
 * Render a result value into the container
 */
function renderResult(container: HTMLElement, result: unknown): void {
  if (result instanceof Element || result instanceof HTMLElement) {
    container.appendChild(result);
  } else if (result instanceof DocumentFragment) {
    container.appendChild(result);
  } else if (Array.isArray(result) && result.length > 0 && result[0] instanceof Element) {
    result.forEach((el) => container.appendChild(el));
  } else if (typeof result === "string") {
    if (result.trim().startsWith("<")) {
      container.innerHTML = result;
    } else {
      container.textContent = result;
    }
  } else if (typeof result === "object") {
    container.innerHTML = "<pre>" + JSON.stringify(result, null, 2) + "</pre>";
  } else {
    container.textContent = String(result);
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
