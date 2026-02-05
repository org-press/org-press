/**
 * API Plugin Types
 *
 * Request/Response interfaces designed to work with:
 * - Express/Fastify (native compatibility)
 * - Serverless functions (AWS Lambda, Vercel, Cloudflare Workers)
 */

/**
 * API Request object
 *
 * Provides a unified interface for HTTP requests across different platforms.
 */
export interface ApiRequest {
  /** HTTP method (GET, POST, PUT, DELETE, etc.) */
  method: string;

  /** Request path (without query string) */
  path: string;

  /** URL parameters extracted from path (e.g., /users/:id -> { id: "123" }) */
  params: Record<string, string>;

  /** Query string parameters (e.g., ?foo=bar -> { foo: "bar" }) */
  query: Record<string, string>;

  /** Request headers */
  headers: Record<string, string | string[] | undefined>;

  /** Parsed request body (for POST/PUT/PATCH) */
  body: unknown;
}

/**
 * API Response object
 *
 * Chainable response builder for sending HTTP responses.
 */
export interface ApiResponse {
  /** Set HTTP status code */
  status(code: number): ApiResponse;

  /** Set response header */
  setHeader(name: string, value: string): ApiResponse;

  /** Send JSON response */
  json(data: unknown): void;

  /** Send raw string/buffer response */
  send(data: string | Buffer): void;

  /** Redirect to another URL */
  redirect(url: string, status?: number): void;
}

/**
 * API Handler function signature
 *
 * Handlers export this as default:
 * ```typescript
 * export default async (req, res) => {
 *   res.json({ message: "Hello" });
 * };
 * ```
 */
export type ApiHandler = (
  req: ApiRequest,
  res: ApiResponse
) => Promise<void> | void;

/**
 * Registered API route definition
 */
export interface ApiRouteDefinition {
  /** URL endpoint pattern (e.g., "/api/users/:id") */
  endpoint: string;

  /** HTTP method (GET, POST, etc. or * for all) */
  method: string;

  /** The compiled handler function */
  handler: ApiHandler;

  /** If true, only available during dev (orgp dev) */
  previewOnly: boolean;

  /** Source org file path (e.g., "content/api/users.org") */
  sourcePath: string;

  /** Block name from #+NAME: directive */
  blockName?: string;
}

/**
 * Parsed API block parameters
 */
export interface ApiBlockParams {
  /** Endpoint path (required) */
  endpoint?: string;

  /** HTTP method (default: GET) */
  method?: string;

  /** Preview only flag */
  previewOnly?: string;
}

/**
 * HTTP methods supported by the API plugin
 */
export const SUPPORTED_METHODS = [
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "PATCH",
  "OPTIONS",
  "HEAD",
  "*", // Wildcard for all methods
] as const;

export type SupportedMethod = (typeof SUPPORTED_METHODS)[number];
