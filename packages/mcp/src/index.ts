/**
 * @org-press/mcp
 *
 * MCP (Model Context Protocol) server for org-press.
 * Exposes code intelligence and tools to AI assistants.
 *
 * Features:
 * - Code quality tools (test, fmt, lint, type-check, build)
 * - Block exploration (list blocks, get block content)
 * - Diagnostics from TypeScript/LSP
 * - Project configuration
 *
 * @example
 * ```json
 * // mcp.json in project root
 * {
 *   "mcpServers": {
 *     "org-press": {
 *       "command": "npx",
 *       "args": ["org-press-mcp"]
 *     }
 *   }
 * }
 * ```
 */

export { createOrgPressMcpServer, type OrgPressMcpServerOptions } from "./server.js";
export { startStdioServer } from "./stdio.js";

// Re-export tool definitions for extensibility
export { orgPressTools } from "./tools/index.js";
export { orgPressResources } from "./resources/index.js";
