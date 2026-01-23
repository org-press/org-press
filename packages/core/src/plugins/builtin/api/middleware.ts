/**
 * API Middleware
 *
 * Express/Connect-style middleware that handles API requests
 * by matching against registered routes in the registry.
 */

import type { Connect } from "vite";
import type { ServerResponse } from "node:http";
import type { ApiRequest, ApiResponse, ApiRouteDefinition } from "./types.ts";
import { getApiRoutes } from "./registry.ts";
import { matchRoute, parseQueryString, getPathname } from "./utils.ts";

/**
 * Read request body as JSON or raw string
 */
async function readBody(req: Connect.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let data = "";

    req.on("data", (chunk: Buffer) => {
      data += chunk.toString();
    });

    req.on("end", () => {
      if (!data) {
        resolve(null);
        return;
      }

      try {
        resolve(JSON.parse(data));
      } catch {
        // Not JSON, return as string
        resolve(data);
      }
    });

    req.on("error", reject);
  });
}

/**
 * Build ApiRequest from Connect request
 */
function buildApiRequest(
  req: Connect.IncomingMessage,
  pathname: string,
  params: Record<string, string>,
  query: Record<string, string>,
  body: unknown
): ApiRequest {
  return {
    method: req.method?.toUpperCase() || "GET",
    path: pathname,
    params,
    query,
    headers: req.headers as Record<string, string | string[] | undefined>,
    body,
  };
}

/**
 * Build ApiResponse from Connect response
 */
function buildApiResponse(res: ServerResponse): ApiResponse {
  let statusCode = 200;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const apiRes: ApiResponse = {
    status(code: number) {
      statusCode = code;
      return apiRes;
    },

    setHeader(name: string, value: string) {
      headers[name] = value;
      return apiRes;
    },

    json(data: unknown) {
      res.statusCode = statusCode;
      for (const [key, value] of Object.entries(headers)) {
        res.setHeader(key, value);
      }
      res.end(JSON.stringify(data));
    },

    send(data: string | Buffer) {
      res.statusCode = statusCode;
      // Don't set Content-Type for send() - let caller set it
      if (!headers["Content-Type"]) {
        headers["Content-Type"] = "text/plain";
      }
      for (const [key, value] of Object.entries(headers)) {
        res.setHeader(key, value);
      }
      res.end(data);
    },

    redirect(url: string, status: number = 302) {
      res.statusCode = status;
      res.setHeader("Location", url);
      res.end();
    },
  };

  return apiRes;
}

/**
 * Find matching route for a request
 */
function findMatchingRoute(
  pathname: string,
  method: string,
  routes: ApiRouteDefinition[]
): { route: ApiRouteDefinition; params: Record<string, string> } | null {
  for (const route of routes) {
    // Check method
    if (route.method !== "*" && route.method !== method) {
      continue;
    }

    // Check path
    const match = matchRoute(route.endpoint, pathname);
    if (match.matched) {
      return { route, params: match.params };
    }
  }

  return null;
}

/**
 * Create API middleware for Vite dev server
 *
 * This middleware:
 * 1. Gets all registered API routes
 * 2. For each incoming request, checks if it matches a route
 * 3. If matched, executes the handler
 * 4. If not matched, passes to next middleware
 *
 * @returns Connect middleware function
 */
export function createApiMiddleware(): Connect.NextHandleFunction {
  return async (req, res, next) => {
    if (!req.url) {
      return next();
    }

    const pathname = getPathname(req.url);
    const method = req.method?.toUpperCase() || "GET";

    // Get all registered routes
    const routes = getApiRoutes(true); // Include previewOnly in dev

    // Find matching route
    const match = findMatchingRoute(pathname, method, routes);

    if (!match) {
      return next();
    }

    const { route, params } = match;

    console.log(`[api] ${method} ${pathname} -> ${route.sourcePath}${route.blockName ? `#${route.blockName}` : ""}`);

    // Parse query string
    const query = parseQueryString(req.url);

    // Read body for methods that have one
    let body: unknown = null;
    if (["POST", "PUT", "PATCH"].includes(method)) {
      try {
        body = await readBody(req);
      } catch (error) {
        console.error("[api] Failed to read request body:", error);
      }
    }

    // Build request/response objects
    const apiReq = buildApiRequest(req, pathname, params, query, body);
    const apiRes = buildApiResponse(res);

    // Execute handler
    try {
      await route.handler(apiReq, apiRes);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[api] Error in ${route.method} ${route.endpoint}:`, error);

      // Send error response if not already sent
      if (!res.writableEnded) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: errorMessage }));
      }
    }
  };
}
