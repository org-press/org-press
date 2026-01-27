/**
 * Lint Plugin
 *
 * Provides the `orgp lint` command for linting code blocks with ESLint.
 */

import type { BlockPlugin } from "org-press";
import { runLint } from "../commands/lint.js";

/**
 * Lint plugin
 *
 * Registers the `lint` CLI command for linting JavaScript/TypeScript
 * code blocks in org files using ESLint.
 *
 * Usage:
 *   orgp lint                     # Lint all JS/TS blocks
 *   orgp lint --fix               # Auto-fix problems
 *   orgp lint --languages ts,tsx  # Lint only TypeScript blocks
 *   orgp lint content/utils.org   # Lint specific file
 */
export const lintPlugin: BlockPlugin = {
  name: "lint",
  defaultExtension: "js",

  cli: {
    command: "lint",
    description: "Lint code blocks in org files using ESLint",
    execute: (args, ctx) => runLint(args, ctx),
  },
};
