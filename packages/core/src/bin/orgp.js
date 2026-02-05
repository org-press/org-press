#!/usr/bin/env node

/**
 * Thin wrapper for orgp CLI
 * Invokes the TypeScript entry point with experimental-strip-types
 */

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tsEntry = path.join(__dirname, "orgp.ts");

const child = spawn(
  process.execPath,
  ["--experimental-strip-types", tsEntry, ...process.argv.slice(2)],
  {
    stdio: "inherit",
    env: process.env,
  }
);

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
