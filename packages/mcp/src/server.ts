/**
 * Org-Press MCP Server
 *
 * Creates an MCP server that exposes org-press capabilities.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "./tools/index.js";
import { registerResources } from "./resources/index.js";

export interface OrgPressMcpServerOptions {
  /** Project root directory (defaults to cwd) */
  projectRoot?: string;
  /** Content directory relative to project root */
  contentDir?: string;
}

/**
 * Create an org-press MCP server
 */
export function createOrgPressMcpServer(
  options: OrgPressMcpServerOptions = {}
): McpServer {
  const projectRoot = options.projectRoot || process.cwd();
  const contentDir = options.contentDir || "content";

  const server = new McpServer({
    name: "org-press",
    version: "0.2.0",
  });

  // Register all tools
  registerTools(server, { projectRoot, contentDir });

  // Register all resources
  registerResources(server, { projectRoot, contentDir });

  return server;
}
