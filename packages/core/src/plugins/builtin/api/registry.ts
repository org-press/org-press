/**
 * API Route Registry
 *
 * Singleton that stores registered API routes.
 * Routes are registered during org file processing and
 * consumed by the middleware to handle requests.
 */

import type { ApiRouteDefinition, ApiHandler } from "./types.ts";

/**
 * Registry of all API routes
 */
const routes: Map<string, ApiRouteDefinition> = new Map();

/**
 * Current mode (dev or build)
 */
let currentMode: "dev" | "build" = "dev";

/**
 * Generate unique key for a route
 */
function routeKey(method: string, endpoint: string): string {
  return `${method.toUpperCase()}:${endpoint}`;
}

/**
 * Set the current mode (dev or build)
 *
 * In build mode, duplicate routes throw errors.
 * In dev mode, duplicates log warnings.
 */
export function setMode(mode: "dev" | "build"): void {
  currentMode = mode;
}

/**
 * Get the current mode
 */
export function getMode(): "dev" | "build" {
  return currentMode;
}

/**
 * Register an API route
 *
 * @param route - Route definition to register
 * @throws In build mode, throws if endpoint already registered
 */
export function registerApiRoute(route: ApiRouteDefinition): void {
  const key = routeKey(route.method, route.endpoint);
  const existing = routes.get(key);

  if (existing) {
    const message = `[api] Duplicate endpoint: ${route.method} ${route.endpoint} (already registered from ${existing.sourcePath})`;

    if (currentMode === "build") {
      throw new Error(message);
    } else {
      console.error(message);
      console.error(`[api] Overwriting with handler from ${route.sourcePath}`);
    }
  }

  routes.set(key, route);

  console.log(
    `[api] Registered: ${route.method} ${route.endpoint}` +
      (route.previewOnly ? " (previewOnly)" : "") +
      ` from ${route.sourcePath}${route.blockName ? `#${route.blockName}` : ""}`
  );
}

/**
 * Check if an endpoint is already registered
 *
 * @param endpoint - Endpoint path
 * @param method - HTTP method
 * @returns True if already registered
 */
export function isEndpointRegistered(endpoint: string, method: string): boolean {
  return routes.has(routeKey(method, endpoint));
}

/**
 * Get all registered routes
 *
 * @param includePreviewOnly - Include preview-only routes (default: true)
 * @returns Array of route definitions
 */
export function getApiRoutes(includePreviewOnly: boolean = true): ApiRouteDefinition[] {
  const allRoutes = Array.from(routes.values());

  if (includePreviewOnly) {
    return allRoutes;
  }

  return allRoutes.filter((route) => !route.previewOnly);
}

/**
 * Get a specific route by endpoint and method
 *
 * @param endpoint - Endpoint path
 * @param method - HTTP method
 * @returns Route definition or undefined
 */
export function getRoute(endpoint: string, method: string): ApiRouteDefinition | undefined {
  return routes.get(routeKey(method, endpoint));
}

/**
 * Unregister a route
 *
 * @param endpoint - Endpoint path
 * @param method - HTTP method
 * @returns True if route was removed
 */
export function unregisterRoute(endpoint: string, method: string): boolean {
  return routes.delete(routeKey(method, endpoint));
}

/**
 * Clear all registered routes
 *
 * Useful for testing or HMR.
 */
export function clearRoutes(): void {
  routes.clear();
}

/**
 * Get count of registered routes
 */
export function getRouteCount(): number {
  return routes.size;
}

/**
 * Register a route from parsed block data
 *
 * Convenience function that creates the route definition.
 */
export function registerRouteFromBlock(options: {
  endpoint: string;
  method: string;
  handler: ApiHandler;
  previewOnly: boolean;
  sourcePath: string;
  blockName?: string;
}): void {
  registerApiRoute({
    endpoint: options.endpoint,
    method: options.method,
    handler: options.handler,
    previewOnly: options.previewOnly,
    sourcePath: options.sourcePath,
    blockName: options.blockName,
  });
}
