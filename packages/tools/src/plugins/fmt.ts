/**
 * Format Plugin
 *
 * Provides the `orgp fmt` command for formatting code blocks with Prettier.
 */

import type { BlockPlugin } from "org-press";
import { runFmt } from "../commands/fmt.js";

/**
 * Format plugin
 *
 * Registers the `fmt` CLI command for formatting code blocks
 * in org files using Prettier.
 *
 * Usage:
 *   orgp fmt                      # Format all blocks
 *   orgp fmt --check              # Check if blocks are formatted
 *   orgp fmt --languages ts,tsx   # Format only TypeScript blocks
 *   orgp fmt content/api.org      # Format specific file
 */
export const fmtPlugin: BlockPlugin = {
  name: "fmt",
  defaultExtension: "js",

  cli: {
    command: "fmt",
    description: "Format code blocks in org files using Prettier",
    execute: (args, ctx) => runFmt(args, ctx),
  },
};
