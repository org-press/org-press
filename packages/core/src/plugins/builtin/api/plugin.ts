/**
 * API Plugin
 *
 * BlockPlugin that enables defining HTTP API endpoints in org files.
 *
 * Usage:
 * ```org
 * #+begin_src javascript :use api :endpoint "/api/hello" :method GET
 * export default async (req, res) => {
 *   res.json({ message: "Hello, World!" });
 * };
 * #+end_src
 * ```
 */

import type { BlockPlugin, CodeBlock, TransformContext, TransformResult } from "../../types.ts";
import type { ApiHandler } from "./types.ts";
import { usesPlugin } from "../../utils.ts";
import { registerRouteFromBlock, setMode, isEndpointRegistered } from "./registry.ts";
import { parseApiBlockParams, validateEndpoint, normalizeMethod } from "./utils.ts";

/**
 * Compile handler code into an executable function
 *
 * The code should export a default async function:
 * ```javascript
 * export default async (req, res) => { ... }
 * ```
 *
 * @param code - Handler source code
 * @param language - Source language (javascript, typescript, etc.)
 * @param sourcePath - Source file for error messages
 * @returns Compiled handler function
 */
async function compileHandler(
  code: string,
  language: string,
  sourcePath: string
): Promise<ApiHandler> {
  try {
    // For now, we use dynamic function creation
    // In the future, this could use esbuild for TypeScript
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

    // Wrap the code to extract the default export
    // The code is expected to have: export default async (req, res) => { ... }
    const wrappedCode = `
      const exports = {};
      const module = { exports };

      // Define export helper
      const __export = (name, value) => {
        if (name === 'default') {
          module.exports.default = value;
        } else {
          exports[name] = value;
        }
      };

      // Transform export statements
      ${code
        .replace(/export\s+default\s+/g, "__export('default', ")
        .replace(/export\s+const\s+(\w+)/g, "const $1 = __export('$1',")
        .replace(/export\s+function\s+(\w+)/g, "function $1() { } __export('$1', $1); function $1")}

      return module.exports.default || module.exports;
    `;

    const factory = new AsyncFunction(wrappedCode);
    const handler = await factory();

    if (typeof handler !== "function") {
      throw new Error(
        `Handler must export a default function. Got: ${typeof handler}`
      );
    }

    return handler as ApiHandler;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[api] Failed to compile handler from ${sourcePath}:`, errorMessage);

    // Return error handler
    return async (_req, res) => {
      res.status(500).json({
        error: `Handler compilation failed: ${errorMessage}`,
        source: sourcePath,
      });
    };
  }
}

/**
 * API Plugin
 *
 * Enables defining HTTP endpoints in org files using `:use api`.
 */
export const apiPlugin: BlockPlugin = {
  name: "api",
  defaultExtension: "js",
  priority: 100, // High priority to handle before default plugins

  /**
   * Match blocks with :use api
   */
  matches(block: CodeBlock): boolean {
    return usesPlugin(block.meta, "api");
  },

  /**
   * Transform: Register route and return no-op for client
   *
   * During dev, this is called when the block is processed.
   * The handler is compiled and registered with the route registry.
   */
  async transform(block: CodeBlock, ctx: TransformContext): Promise<TransformResult> {
    // Set mode for duplicate handling
    setMode(ctx.config?.command === "build" ? "build" : "dev");

    // Parse API parameters
    const params = parseApiBlockParams(block.meta || "");

    // Validate endpoint
    if (!params.endpoint) {
      const error = `[api] :endpoint is required for block in ${ctx.orgFilePath}`;
      console.error(error);

      if (ctx.config?.command === "build") {
        throw new Error(error);
      }

      return {
        code: `export default null; // API error: endpoint required`,
      };
    }

    const endpointError = validateEndpoint(params.endpoint);
    if (endpointError) {
      const error = `[api] ${endpointError} in ${ctx.orgFilePath}`;
      console.error(error);

      if (ctx.config?.command === "build") {
        throw new Error(error);
      }

      return {
        code: `export default null; // API error: ${endpointError}`,
      };
    }

    const method = normalizeMethod(params.method);
    const previewOnly = params.previewOnly === "true";

    // Compile the handler
    const handler = await compileHandler(
      block.value,
      block.language,
      ctx.orgFilePath
    );

    // Register the route
    registerRouteFromBlock({
      endpoint: params.endpoint,
      method,
      handler,
      previewOnly,
      sourcePath: ctx.orgFilePath,
      blockName: ctx.blockName,
    });

    // Return no-op for client-side
    // API handlers run on server only
    return {
      code: `export default null; // API endpoint: ${method} ${params.endpoint}${previewOnly ? " (previewOnly)" : ""}`,
    };
  },

  /**
   * onGenerate: Handle build mode
   *
   * In build mode, previewOnly endpoints are excluded.
   * Non-previewOnly endpoints could be output for serverless deployment.
   */
  async onGenerate(block: CodeBlock, ctx: TransformContext): Promise<TransformResult> {
    const params = parseApiBlockParams(block.meta || "");

    // Skip previewOnly endpoints in build
    if (params.previewOnly === "true") {
      return {
        code: `export default null; // previewOnly API endpoint - excluded from build`,
      };
    }

    // For now, just return no-op
    // Future: Generate serverless function output
    return {
      code: `export default null; // API endpoint: ${params.method || "GET"} ${params.endpoint}`,
    };
  },
};
