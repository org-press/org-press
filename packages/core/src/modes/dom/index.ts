/**
 * DOM Mode Plugin
 *
 * Default mode for org-press that handles plain JavaScript/TypeScript blocks.
 * Renders results to DOM without requiring React or other frameworks.
 */

import type { ModePlugin, ModeContext, ClientModeContext } from "../types";
import { renderUnhandledError } from "../errors";
import { isReactElement, renderToHtml, renderResult } from "./utils";

/**
 * DOM Mode - Default rendering mode for org-press
 *
 * This mode handles blocks that:
 * - Return primitive values (strings, numbers, booleans)
 * - Return HTML strings
 * - Return HTMLElement or DocumentFragment instances
 * - Export a render function for custom rendering
 *
 * For React elements, it shows an error suggesting @org-press/react.
 */
export const domMode: ModePlugin = {
  name: "dom",

  onServerRender(result: unknown, ctx: ModeContext): string {
    // Check for React elements - show helpful error
    if (isReactElement(result)) {
      return renderUnhandledError(ctx, "react");
    }

    // If block has a render function, we can't pre-render
    // (render may use DOM APIs). Return empty container.
    if (ctx.render) {
      return ""; // Hydrated on client
    }

    // Render simple values as static HTML
    return renderToHtml(result);
  },

  onClientHydrate(
    result: unknown,
    ctx: ClientModeContext,
    element: HTMLElement
  ): void {
    // Check for React elements - show error in container
    if (isReactElement(result)) {
      element.innerHTML = renderUnhandledError(ctx, "react");
      console.error(
        `[org-press] Block "${ctx.blockId}" returns a React element but ` +
          `@org-press/react is not installed. Add it to your config:\n\n` +
          `  import { useReact } from '@org-press/react';\n` +
          `  export default defineConfig({ modes: [useReact()] });`
      );
      return;
    }

    // If block has a render function, use it
    if (ctx.render) {
      const output = ctx.render(result, element);

      if (output instanceof HTMLElement) {
        element.appendChild(output);
      } else if (typeof output === "string") {
        if (output.trim().startsWith("<")) {
          element.innerHTML = output;
        } else {
          element.textContent = output;
        }
      }
      return;
    }

    // Default: render result directly
    renderResult(element, result);
  },

  canHandle(result: unknown): boolean {
    // DOM mode handles everything except React elements
    return !isReactElement(result);
  },
};

export default domMode;
