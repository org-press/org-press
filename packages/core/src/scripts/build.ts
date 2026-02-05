#!/usr/bin/env node --experimental-strip-types
/**
 * Build script for org-press
 * Entry point for building static sites
 */

import { loadConfig } from "../config/loader.ts";
import { build } from "../node/build/build.ts";

const configPath = process.argv[2] || ".org-press/config.ts";

console.log(`[org-press] Loading config from: ${configPath}`);

try {
  const config = await loadConfig(configPath);

  console.log(`[org-press] Content directory: ${config.contentDir}`);
  console.log(`[org-press] Output directory: ${config.outDir}`);
  console.log(`[org-press] Base path: ${config.base}`);

  const result = await build({ config });

  console.log(`\n✓ Build complete!`);
  console.log(`  Pages: ${result.pageCount}`);
  console.log(`  Time: ${result.duration}ms`);
  console.log(`  Output: ${result.outDir}`);
} catch (error) {
  console.error("[org-press] Build failed:", error);
  process.exit(1);
}
