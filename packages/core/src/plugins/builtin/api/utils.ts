/**
 * API Plugin Utilities
 *
 * Path matching, parameter extraction, and other helpers.
 */

import type { ApiBlockParams } from "./types.ts";

/**
 * Result of matching a URL against a route pattern
 */
export interface RouteMatch {
  /** Whether the route matched */
  matched: boolean;

  /** Extracted URL parameters */
  params: Record<string, string>;
}

/**
 * Match a URL path against a route pattern
 *
 * Supports:
 * - Exact matches: "/api/users" matches "/api/users"
 * - URL parameters: "/api/users/:id" matches "/api/users/123" -> { id: "123" }
 * - Multiple params: "/api/users/:userId/posts/:postId"
 *
 * @param pattern - Route pattern (e.g., "/api/users/:id")
 * @param pathname - Actual URL path (e.g., "/api/users/123")
 * @returns Match result with extracted parameters
 *
 * @example
 * matchRoute("/api/users/:id", "/api/users/123")
 * // { matched: true, params: { id: "123" } }
 *
 * matchRoute("/api/users", "/api/posts")
 * // { matched: false, params: {} }
 */
export function matchRoute(pattern: string, pathname: string): RouteMatch {
  const patternParts = pattern.split("/").filter(Boolean);
  const pathParts = pathname.split("/").filter(Boolean);

  // Different number of segments = no match
  if (patternParts.length !== pathParts.length) {
    return { matched: false, params: {} };
  }

  const params: Record<string, string> = {};

  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i];
    const pathPart = pathParts[i];

    if (patternPart.startsWith(":")) {
      // URL parameter - extract value
      const paramName = patternPart.slice(1);
      params[paramName] = decodeURIComponent(pathPart);
    } else if (patternPart !== pathPart) {
      // Static segment doesn't match
      return { matched: false, params: {} };
    }
  }

  return { matched: true, params };
}

/**
 * Parse query string into key-value object
 *
 * @param url - URL with query string (e.g., "/api/users?page=1&limit=10")
 * @returns Parsed query parameters
 *
 * @example
 * parseQueryString("/api/users?page=1&limit=10")
 * // { page: "1", limit: "10" }
 */
export function parseQueryString(url: string): Record<string, string> {
  const query: Record<string, string> = {};
  const queryIndex = url.indexOf("?");

  if (queryIndex === -1) {
    return query;
  }

  const queryString = url.slice(queryIndex + 1);
  const params = new URLSearchParams(queryString);

  params.forEach((value, key) => {
    query[key] = value;
  });

  return query;
}

/**
 * Extract pathname from URL (remove query string)
 *
 * @param url - Full URL or path with query string
 * @returns Path without query string
 *
 * @example
 * getPathname("/api/users?page=1")
 * // "/api/users"
 */
export function getPathname(url: string): string {
  const queryIndex = url.indexOf("?");
  return queryIndex === -1 ? url : url.slice(0, queryIndex);
}

/**
 * Parse API block parameters from org-mode meta string
 *
 * Handles quoted values for endpoints with URL parameters:
 * - `:endpoint "/api/users/:id"` -> endpoint: "/api/users/:id"
 * - `:method POST` -> method: "POST"
 * - `:previewOnly true` -> previewOnly: "true"
 *
 * @param meta - Block meta string (e.g., ':use api :endpoint "/api/users/:id" :method GET')
 * @returns Parsed API parameters
 */
export function parseApiBlockParams(meta: string): ApiBlockParams {
  const params: ApiBlockParams = {};

  // Match :endpoint with quoted value (for paths with :params)
  const quotedEndpointMatch = meta.match(/:endpoint\s+"([^"]+)"/);
  if (quotedEndpointMatch) {
    params.endpoint = quotedEndpointMatch[1];
  } else {
    // Match :endpoint with unquoted value
    const endpointMatch = meta.match(/:endpoint\s+(\S+)/);
    if (endpointMatch) {
      params.endpoint = endpointMatch[1];
    }
  }

  // Match :method
  const methodMatch = meta.match(/:method\s+(\S+)/);
  if (methodMatch) {
    params.method = methodMatch[1].toUpperCase();
  }

  // Match :previewOnly
  const previewOnlyMatch = meta.match(/:previewOnly\s+(\S+)/);
  if (previewOnlyMatch) {
    params.previewOnly = previewOnlyMatch[1];
  }

  return params;
}

/**
 * Validate endpoint path format
 *
 * @param endpoint - Endpoint path to validate
 * @returns Error message if invalid, null if valid
 */
export function validateEndpoint(endpoint: string): string | null {
  if (!endpoint) {
    return "Endpoint is required";
  }

  if (!endpoint.startsWith("/")) {
    return `Endpoint must start with "/": ${endpoint}`;
  }

  // Check for invalid characters
  if (!/^[a-zA-Z0-9/:_-]+$/.test(endpoint)) {
    return `Endpoint contains invalid characters: ${endpoint}`;
  }

  return null;
}

/**
 * Validate HTTP method
 *
 * @param method - HTTP method to validate
 * @returns Normalized method or null if invalid
 */
export function normalizeMethod(method: string | undefined): string {
  const normalized = (method || "GET").toUpperCase();

  const validMethods = [
    "GET",
    "POST",
    "PUT",
    "DELETE",
    "PATCH",
    "OPTIONS",
    "HEAD",
    "*",
  ];

  if (!validMethods.includes(normalized)) {
    console.warn(`[api] Invalid HTTP method "${method}", defaulting to GET`);
    return "GET";
  }

  return normalized;
}
