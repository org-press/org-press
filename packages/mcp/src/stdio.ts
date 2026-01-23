/**
 * Stdio transport for org-press MCP server
 *
 * This is the standard way to run an MCP server for local use.
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createOrgPressMcpServer, type OrgPressMcpServerOptions } from "./server.js";

/**
 * Start the MCP server over stdio
 *
 * This is the entry point for running the server as a subprocess.
 */
export async function startStdioServer(
  options: OrgPressMcpServerOptions = {}
): Promise<void> {
  const server = createOrgPressMcpServer(options);
  const transport = new StdioServerTransport();

  await server.connect(transport);

  // Keep the process alive
  process.stdin.resume();
}
