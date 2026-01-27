/**
 * Server Plugin Factory
 *
 * Provides a factory function for creating server execution plugins
 * with customizable handlers for different languages and runtimes.
 *
 * Usage in org-mode:
 * #+begin_src javascript :use server
 * const pages = await content.getContentPages();
 * return `Found ${pages.length} pages`;
 * #+end_src
 *
 * Server execution:
 * - Runs during SSR/build, not in browser
 * - Has access to content helpers via `content` global
 * - Has access to Node.js `require`
 * - Results are injected as static HTML or client-side script
 */

import type { BlockPlugin, ServerHandler, TransformContext } from "../types.ts";
import { parseBlockParameters, createBlockId } from "../utils.ts";
import {
  cacheServerResult,
  readCachedServerResult,
} from "../../cache.ts";
import { createDefaultJavaScriptHandler } from "./javascript-handler.ts";

/**
 * Create server execution plugin with custom handlers
 *
 * Factory function that creates a server plugin supporting
 * multiple handlers with parameter-based matching.
 *
 * @param handlers - Array of server handlers
 * @returns Server plugin instance
 *
 * @example
 * ```typescript
 * import { createServerPlugin, createServerHandler } from 'org-press';
 *
 * const serverPlugin = createServerPlugin([
 *   createServerHandler(
 *     (params, block) => params.use === 'server' && block.language === 'javascript',
 *     {
 *       onServer: async (code, ctx) => { /* execute *\/ },
 *       onClient: (result, ctx) => { /* display *\/ },
 *       options: { timeout: 30000 }
 *     }
 *   )
 * ]);
 * ```
 */
export function createServerPlugin(handlers: ServerHandler[]): BlockPlugin {
  return {
    name: "server",
    defaultExtension: "js",
    priority: 15, // Higher than javascript plugin (10)

    /**
     * Custom matching logic - at least one handler must match
     */
    matches(block) {
      const params = parseBlockParameters(block.meta);

      // Check if any handler matches this block
      return handlers.some((handler) => handler.matches(params, block));
    },

    /**
     * Client-side transformation
     * Returns empty code since server blocks don't execute in browser
     */
    async transform(block, context) {
      return {
        code: "// Server-side execution (no client code)",
      };
    },

    /**
     * Server-side execution hook
     *
     * Finds appropriate handler, executes code, caches result,
     * and generates display code for browser.
     */
    async onServer(block, context) {
      const params = parseBlockParameters(block.meta);

      // Find first matching handler
      const handler = handlers.find((h) => h.matches(params, block));

      if (!handler) {
        console.error(
          `[server-plugin] No handler matched for block. ` +
          `Language: ${block.language}, Parameters: ${JSON.stringify(params)}`
        );
        return {
          code: block.value,
          executeOnServer: true,
        };
      }

      // Generate block ID for result container
      const blockId = createBlockId(context.orgFilePath, context.blockIndex);

      // Check if contentHelpers is available
      if (!context.contentHelpers) {
        console.error(
          `[server-plugin] contentHelpers not available in context for ${context.orgFilePath}`
        );
        return {
          code: `
            console.error('Server execution failed: contentHelpers not available');
          `,
          executeOnServer: true,
        };
      }

      // Check cache first
      let result;
      let cached = false;

      const cachedResult = await readCachedServerResult(
        context.orgFilePath,
        context.blockIndex
      );

      if (cachedResult !== null) {
        result = cachedResult;
        cached = true;
      } else {
        // Execute via handler
        const executionResult = await handler.onServer(block.value, {
          contentHelpers: context.contentHelpers,
          orgFilePath: context.orgFilePath,
          blockIndex: context.blockIndex,
          blockName: context.blockName,
          params: params,
          block: block,
        });

        if (executionResult.error) {
          // Return error display code
          const errorMessage = executionResult.error.message.replace(/'/g, "\\'");
          const errorStack = (executionResult.error.stack || "").replace(/'/g, "\\'").replace(/\n/g, "\\n");
          return {
            code: `
              const container = document.getElementById('${blockId}-result');
              if (container) {
                container.innerHTML = '<pre class="error">' +
                  'Execution Error: ${errorMessage}\\n' +
                  '${errorStack}' +
                  '</pre>';
              }
            `,
            executeOnServer: true,
          };
        }

        result = executionResult.result;

        // Cache result
        await cacheServerResult(
          context.orgFilePath,
          context.blockIndex,
          result
        );
      }

      // Generate display code
      let displayCode;

      if (handler.onClient) {
        displayCode = handler.onClient(result, {
          blockId,
          orgFilePath: context.orgFilePath,
          blockIndex: context.blockIndex,
          params: params,
        });
      } else {
        // Default display: convert to string
        displayCode = `
          const container = document.getElementById('${blockId}-result');
          if (container) {
            container.textContent = ${JSON.stringify(String(result))};
          }
        `;
      }

      return {
        code: displayCode,
        executeOnServer: true,
      };
    },
  };
}

/**
 * Default server plugin with JavaScript handler
 *
 * Convenience export for the common case.
 * Uses createDefaultJavaScriptHandler() with default options.
 *
 * @example
 * ```typescript
 * import { serverPlugin } from 'org-press';
 *
 * const config = {
 *   plugins: [serverPlugin]
 * };
 * ```
 */
export const serverPlugin = createServerPlugin([
  createDefaultJavaScriptHandler(),
]);

/**
 * Alternative: Server-only plugin (no client fallback)
 *
 * Variant that throws an error if accessed in the browser.
 * Useful for blocks that should NEVER run client-side.
 */
export const serverOnlyPlugin: BlockPlugin = {
  name: "server-only",
  defaultExtension: "js",
  languages: [], // Not auto-matched, must use :use server-only
  priority: 5,

  async transform(block, context) {
    // Throw error if accessed in browser
    const code = `
throw new Error(
  "This block is server-only and should not be executed in the browser. " +
  "Check your :use parameter (should be :use server)."
);
`;

    return { code };
  },

  async onServer(block, context) {
    return {
      code: block.value,
      executeOnServer: true,
    };
  },
};
