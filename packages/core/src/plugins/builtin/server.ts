/**
 * Server Plugin
 *
 * Provides server-side code execution for blocks with :use server.
 * Uses CreateBlock and CreateTransformer from the API.
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

import type { ServerHandler, TransformContext, BlockTransformContext } from "../types.ts";
import type { OrgPressPlugin, CodeBlockNode, TransformResult } from "../types.ts";
import { CreateTransformer, CreateBlock } from "../index.ts";
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
export function createServerPlugin(handlers: ServerHandler[]): OrgPressPlugin {
  const plugin: OrgPressPlugin = {
    name: "server",
    priority: 15, // Higher than javascript plugin (10)
    _type: "block",
    _config: {
      defaultExtension: "js",
      handlers,
    },

    // Setup function - registers block handler for :use server
    setup(ctx) {
      ctx.onBlock("server", async (block: CodeBlockNode, transformCtx) => {
        const params = parseBlockParameters(block.meta);
        const handler = handlers.find((h) => h.matches(params, block as any));

        if (!handler) {
          return { code: "// Server-side execution (no client code)" };
        }

        const blockId = createBlockId(transformCtx.orgFilePath, transformCtx.blockIndex);

        // Generate container HTML
        return {
          code: `
            // Server result will be populated during SSR
            const container = document.getElementById('${blockId}-result');
            if (!container) {
              console.error('[server-plugin] Result container not found');
            }
          `,
        };
      });
    },
  };

  // Expose v1-compatible properties for backward compatibility
  (plugin as any).defaultExtension = "js";
  // Note: languages is intentionally undefined - serverPlugin only matches via :use server
  // Having languages would cause it to match ALL JS blocks before other plugins

  /**
   * Custom matching logic - at least one handler must match
   */
  (plugin as any).matches = (block: { meta?: string | null; language: string }) => {
    const params = parseBlockParameters(block.meta);
    return handlers.some((handler) => handler.matches(params, block as any));
  };

  /**
   * Client-side transformation
   * Returns empty code since server blocks don't execute in browser
   */
  (plugin as any).transform = async (
    block: { value: string; language: string; meta?: string | null },
    _context: TransformContext
  ): Promise<TransformResult> => {
    return {
      code: "// Server-side execution (no client code)",
    };
  };

  /**
   * Server-side execution hook
   *
   * Finds appropriate handler, executes code, caches result,
   * and generates display code for browser.
   */
  (plugin as any).onServer = async (
    block: { value: string; language: string; meta?: string | null },
    context: BlockTransformContext
  ): Promise<TransformResult & { executeOnServer?: boolean }> => {
    const params = parseBlockParameters(block.meta);

    // Find first matching handler
    const handler = handlers.find((h) => h.matches(params, block as any));

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
        block: block as any,
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
  };

  return plugin;
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
 * Server transformer using CreateTransformer API
 *
 * This transformer can be used in the unified plugin system.
 * It wraps the existing serverPlugin functionality.
 */
export const serverTransformer = CreateTransformer("server", {
  onServer: async (code, ctx) => {
    // Execute code - this would be handled by the handler system
    // For now, we return the code as-is and let the handler execute it
    return { code };
  },
  onBuild: (input, ctx) => {
    // Generate HTML container for result display
    return {
      html: `<div id="${ctx.id}-result" class="server-result"></div>`,
    };
  },
});

/**
 * All languages supported by server-only plugin
 */
const SERVER_ONLY_LANGUAGES = [
  "javascript", "js",
  "typescript", "ts",
];

/**
 * Alternative: Server-only plugin using CreateBlock
 *
 * Variant that throws an error if accessed in the browser.
 * Useful for blocks that should NEVER run client-side.
 */
export const serverOnlyPlugin = CreateBlock(SERVER_ONLY_LANGUAGES, {
  priority: 5,
  defaultExtension: "js",

  /**
   * Match blocks with :use server-only
   * Note: This plugin is not auto-matched by language, must use :use server-only
   */
  matches: (_block, ctx) => {
    const useValue = ctx.params.use || "";
    const firstPart = useValue.split("|")[0].trim();
    return firstPart === "server-only";
  },

  transform: (_code, _ctx) => {
    // Throw error if accessed in browser
    const code = `
throw new Error(
  "This block is server-only and should not be executed in the browser. " +
  "Check your :use parameter (should be :use server)."
);
`;
    return { code };
  },
});

// Override the plugin name for clarity
serverOnlyPlugin.name = "server-only";

// Expose v1-compatible properties for backward compatibility
(serverOnlyPlugin as any).defaultExtension = "js";
(serverOnlyPlugin as any).languages = [];

// v1-compatible transform function
(serverOnlyPlugin as any).transform = async (
  _block: { value: string; language: string; meta?: string | null },
  _context: TransformContext
): Promise<TransformResult> => {
  // Throw error if accessed in browser
  const code = `
throw new Error(
  "This block is server-only and should not be executed in the browser. " +
  "Check your :use parameter (should be :use server)."
);
`;
  return { code };
};

// v1-compatible onServer function
(serverOnlyPlugin as any).onServer = async (
  block: { value: string; language: string; meta?: string | null },
  _context: TransformContext
): Promise<TransformResult & { executeOnServer?: boolean }> => {
  return {
    code: block.value,
    executeOnServer: true,
  };
};
