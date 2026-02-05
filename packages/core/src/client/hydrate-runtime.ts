/**
 * Hydration Runtime
 *
 * Runtime functions for client-side block hydration.
 * This module is imported by generated hydrate entry files.
 *
 * By extracting these into a module (instead of generating as string literals),
 * we can properly test them with real function calls.
 */

/**
 * Check if a value is a React element (JSX)
 */
export function isReactElement(value: unknown): boolean {
  if (value === null || typeof value !== "object") return false;
  const v = value as { $$typeof?: symbol };
  return (
    v.$$typeof === Symbol.for("react.element") ||
    v.$$typeof === Symbol.for("react.transitional.element")
  );
}

/**
 * Render a non-JSX result to a DOM element
 *
 * Handles various result types:
 * - null/undefined: no-op
 * - function: call with element id (for canvas/WebGL setup)
 * - HTMLElement: append to container
 * - string: set as innerHTML (if HTML) or textContent
 * - number/boolean: convert to string
 * - object: JSON stringify with formatting
 */
export function renderResult(el: HTMLElement, result: unknown): void {
  if (result === null || result === undefined) return;

  if (typeof result === "function") {
    result(el.id);
  } else if (result instanceof HTMLElement) {
    if (!el.hasChildNodes()) el.appendChild(result);
  } else if (typeof result === "string") {
    if (result.trim().startsWith("<")) {
      el.innerHTML = result;
    } else {
      el.textContent = result;
    }
  } else if (typeof result === "number" || typeof result === "boolean") {
    el.textContent = String(result);
  } else if (typeof result === "object") {
    el.innerHTML = "<pre>" + JSON.stringify(result, null, 2) + "</pre>";
  }
}

/** ReactDOM root cache to avoid re-creating roots */
const reactRoots = new Map<HTMLElement, unknown>();

/**
 * Render a React component with result as prop
 *
 * This ensures hooks are called within React's render context.
 * The component receives { result } as props.
 */
export async function renderReactComponent(
  el: HTMLElement,
  RenderComponent: React.ComponentType<{ result: unknown }>,
  result: unknown
): Promise<void> {
  const [ReactDOM, React] = await Promise.all([
    import("react-dom/client"),
    import("react"),
  ]);

  let root = reactRoots.get(el) as { render: (node: React.ReactNode) => void } | undefined;
  if (!root) {
    root = ReactDOM.createRoot(el);
    reactRoots.set(el, root);
  }

  root.render(React.createElement(RenderComponent, { result }));
}

/**
 * Block module interface - what each imported block provides
 */
export interface BlockModule {
  default: unknown;
  render?: (result: unknown, el: HTMLElement) => unknown;
}

/**
 * Block entry in the blocks registry
 */
export interface BlockRegistryEntry {
  module: BlockModule;
  ext: string;
  isReact: boolean;
  modeName: string;
}

/**
 * Hydrate a single block
 *
 * @param id - Block ID (matches data-org-block attribute)
 * @param entry - Block registry entry with module and metadata
 */
export async function hydrateBlock(
  id: string,
  entry: BlockRegistryEntry
): Promise<void> {
  const { module: mod, isReact } = entry;

  const el = document.querySelector(`[data-org-block="${id}"]`) as HTMLElement | null;
  if (!el) return;

  try {
    // Get the execution result from default export
    let result = mod.default;

    // Await if result is a Promise (from async IIFE wrapper)
    if (result && typeof (result as Promise<unknown>).then === "function") {
      result = await result;
    }

    // Get the render function from the module
    const renderFn = mod.render;

    if (renderFn && typeof renderFn === "function") {
      if (isReact) {
        // For TSX/JSX blocks, render is a React component
        await renderReactComponent(
          el,
          renderFn as unknown as React.ComponentType<{ result: unknown }>,
          result
        );
      } else {
        // Plain JS - call render with result and element
        const output = renderFn(result, el);

        if (output instanceof HTMLElement) {
          if (!el.hasChildNodes()) el.appendChild(output);
        } else if (typeof output === "string") {
          if (output.trim().startsWith("<")) {
            el.innerHTML = output;
          } else {
            el.textContent = output;
          }
        } else if (output !== null && output !== undefined) {
          renderResult(el, output);
        }
      }
    } else {
      // No custom render - use default rendering
      renderResult(el, result);
    }
  } catch (error) {
    console.error(`[org-press] Failed to hydrate block ${id}:`, error);
  }
}

/**
 * Hydrate all blocks in a registry
 */
export async function hydrateBlocks(
  blocks: Record<string, BlockRegistryEntry>
): Promise<void> {
  for (const [id, entry] of Object.entries(blocks)) {
    await hydrateBlock(id, entry);
  }
}

/**
 * Initialize hydration on DOMContentLoaded or immediately if already loaded
 */
export function initHydration(
  blocks: Record<string, BlockRegistryEntry>
): void {
  const hydrate = () => hydrateBlocks(blocks);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", hydrate);
  } else {
    hydrate();
  }
}
