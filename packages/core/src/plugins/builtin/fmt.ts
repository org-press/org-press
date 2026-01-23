/**
 * Format Plugin
 *
 * Provides the `orgp fmt` CLI command for formatting code blocks in org files.
 *
 * Usage:
 *   orgp fmt                      # Format all blocks
 *   orgp fmt --check              # Check only, exit 1 if changes needed
 *   orgp fmt --languages ts,tsx   # Format only TypeScript
 *   orgp fmt content/api.org      # Format specific files
 */

import type { BlockPlugin, CliContext } from "../types.ts";
import { runFmt } from "../../cli/commands/fmt.ts";

/**
 * Format plugin for org-press
 *
 * This plugin only provides CLI functionality - it doesn't transform blocks.
 * The `orgp fmt` command formats code blocks using Prettier.
 */
export const fmtPlugin: BlockPlugin = {
  name: "fmt",
  defaultExtension: "js", // Required by interface but not used

  /**
   * CLI command for formatting code blocks
   */
  cli: {
    command: "fmt",
    description: "Format code blocks in org files using Prettier",

    async execute(args: string[], context: CliContext): Promise<number> {
      return runFmt(args, context);
    },
  },
};
