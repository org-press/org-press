#!/usr/bin/env node
/**
 * org-press-mcp CLI
 *
 * Starts the org-press MCP server over stdio.
 *
 * Usage:
 *   org-press-mcp [--project-root <path>] [--content-dir <dir>]
 *
 * In mcp.json:
 *   {
 *     "mcpServers": {
 *       "org-press": {
 *         "command": "npx",
 *         "args": ["org-press-mcp"]
 *       }
 *     }
 *   }
 */

import { startStdioServer } from "../src/stdio.js";

function parseArgs(args: string[]): {
  projectRoot?: string;
  contentDir?: string;
} {
  const result: { projectRoot?: string; contentDir?: string } = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--project-root" || arg === "-p") {
      result.projectRoot = args[++i];
    } else if (arg === "--content-dir" || arg === "-c") {
      result.contentDir = args[++i];
    } else if (arg === "--help" || arg === "-h") {
      console.log(`
org-press-mcp - MCP server for org-press

Usage:
  org-press-mcp [options]

Options:
  --project-root, -p <path>  Project root directory (default: cwd)
  --content-dir, -c <dir>    Content directory (default: content)
  --help, -h                 Show this help

In mcp.json:
  {
    "mcpServers": {
      "org-press": {
        "command": "npx",
        "args": ["org-press-mcp"]
      }
    }
  }
`);
      process.exit(0);
    }
  }

  return result;
}

const options = parseArgs(process.argv.slice(2));

startStdioServer(options).catch((err) => {
  console.error("Failed to start org-press MCP server:", err);
  process.exit(1);
});
