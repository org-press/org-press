/**
 * CreateMiddlewarePlugin Factory
 *
 * Register dev server middleware from org-press plugins.
 * Allows plugins to add custom API routes or middleware to the dev server.
 *
 * @example
 * ```typescript
 * import { CreateMiddlewarePlugin } from "org-press";
 *
 * // Simple handler shorthand
 * export const healthCheck = CreateMiddlewarePlugin("/api/health", (req, res) => {
 *   res.setHeader("Content-Type", "application/json");
 *   res.end(JSON.stringify({ status: "ok" }));
 * });
 *
 * // Full options with method filtering
 * export const searchApi = CreateMiddlewarePlugin("/api/search", {
 *   methods: ["GET"],
 *   handler: async (req, res) => {
 *     const url = new URL(req.url!, `http://${req.headers.host}`);
 *     const query = url.searchParams.get("q");
 *
 *     const results = await searchContent(query);
 *
 *     res.setHeader("Content-Type", "application/json");
 *     res.end(JSON.stringify(results));
 *   },
 * });
 * ```
 */

import type { OrgPressPlugin, MiddlewareOptions, MiddlewareHandler } from "../types.ts";

// Re-export types for convenience
export type { MiddlewareOptions, MiddlewareHandler } from "../types.ts";

/**
 * Create an org-press plugin that registers dev server middleware
 *
 * The middleware will be automatically installed in the Vite dev server
 * when org-press is initialized.
 *
 * @param path - URL path to match (e.g., '/api/custom')
 * @param optionsOrHandler - Middleware options or handler function
 * @returns An OrgPressPlugin that registers the middleware
 *
 * @example
 * ```typescript
 * import { CreateMiddlewarePlugin } from "org-press";
 *
 * // Simple handler
 * export const pingApi = CreateMiddlewarePlugin("/api/ping", (req, res) => {
 *   res.end("pong");
 * });
 *
 * // With options
 * export const postApi = CreateMiddlewarePlugin("/api/data", {
 *   methods: ["POST"],
 *   handler: async (req, res, next) => {
 *     // Parse body, process request...
 *     res.setHeader("Content-Type", "application/json");
 *     res.end(JSON.stringify({ received: true }));
 *   },
 * });
 * ```
 */
export function CreateMiddlewarePlugin(
  path: string,
  optionsOrHandler: MiddlewareOptions | MiddlewareHandler
): OrgPressPlugin {
  // Support both function shorthand and options object
  const options: MiddlewareOptions =
    typeof optionsOrHandler === "function"
      ? { handler: optionsOrHandler }
      : optionsOrHandler;

  return {
    name: `middleware:${path}`,
    _type: "middleware",
    _config: { path, ...options },

    setup(ctx) {
      ctx.addMiddleware(path, options);
    },
  };
}
