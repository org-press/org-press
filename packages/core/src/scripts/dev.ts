#!/usr/bin/env node --experimental-strip-types
/**
 * Dev server script for org-press
 * Starts Vite dev server with org-press plugin
 */

import { createServer } from "vite";
import { loadConfig } from "../config/loader.ts";
import { orgPress } from "../node/vite-plugin-org-press.ts";

const configPath = process.argv[2] || ".org-press/config.ts";

// Parse port from command line args
let port: number | undefined;
const portArgWithEquals = process.argv.find((arg) => arg.startsWith("--port="));
if (portArgWithEquals) {
  port = parseInt(portArgWithEquals.split("=")[1], 10);
} else {
  const portIndex = process.argv.findIndex((arg) => arg === "--port");
  if (portIndex !== -1 && process.argv[portIndex + 1]) {
    port = parseInt(process.argv[portIndex + 1], 10);
  }
}

console.log(`[org-press] Loading config from: ${configPath}`);

try {
  const config = await loadConfig(configPath);

  console.log(`[org-press] Content directory: ${config.contentDir}`);
  console.log(`[org-press] Cache directory: ${config.cacheDir}`);
  console.log(`[org-press] Base path: ${config.base}`);

  // Create Vite server with org-press plugin
  const server = await createServer({
    configFile: false,
    root: process.cwd(),
    base: config.base,
    plugins: await orgPress(config),
    server: {
      port: port || 5173,
      host: "localhost",
    },
  });

  await server.listen();

  const actualPort =
    typeof server.config.server.port === "number"
      ? server.config.server.port
      : 5173;

  console.log(`
  ✓ Dev server ready at http://localhost:${actualPort}

  Content: ${config.contentDir}/
  Cache:   ${config.cacheDir}/

  Press Ctrl+C to stop
`);
} catch (error) {
  console.error("[org-press] Dev server failed:", error);
  process.exit(1);
}
