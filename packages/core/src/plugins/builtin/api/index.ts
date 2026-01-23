/**
 * API Plugin
 *
 * Enables defining HTTP API endpoints directly in org files.
 *
 * @example
 * ```org
 * #+begin_src javascript :use api :endpoint "/api/hello"
 * export default async (req, res) => {
 *   res.json({ message: "Hello!" });
 * };
 * #+end_src
 * ```
 *
 * @packageDocumentation
 */

// Main plugin export
export { apiPlugin } from "./plugin.ts";

// Types
export type {
  ApiRequest,
  ApiResponse,
  ApiHandler,
  ApiRouteDefinition,
  ApiBlockParams,
} from "./types.ts";

// Registry functions (for advanced use cases)
export {
  registerApiRoute,
  getApiRoutes,
  clearRoutes,
  setMode,
  isEndpointRegistered,
} from "./registry.ts";

// Middleware (for Vite plugin integration)
export { createApiMiddleware } from "./middleware.ts";

// Utilities (for testing/debugging)
export {
  matchRoute,
  parseQueryString,
  parseApiBlockParams,
  validateEndpoint,
  normalizeMethod,
} from "./utils.ts";
