/**
 * Lint Plugin
 *
 * Provides the `orgp lint` CLI command for linting code blocks in org files.
 *
 * Usage:
 *   orgp lint                      # Lint all blocks
 *   orgp lint --fix                # Auto-fix problems
 *   orgp lint --languages ts,tsx   # Lint only TypeScript
 *   orgp lint content/api.org      # Lint specific files
 */

import type { BlockPlugin, CliContext } from "../types.ts";
import { runLint } from "../../cli/commands/lint.ts";

/**
 * Lint plugin for org-press
 *
 * This plugin only provides CLI functionality - it doesn't transform blocks.
 * The `orgp lint` command lints code blocks using ESLint.
 */
export const lintPlugin: BlockPlugin = {
  name: "lint",
  defaultExtension: "js", // Required by interface but not used

  /**
   * CLI command for linting code blocks
   */
  cli: {
    command: "lint",
    description: "Lint code blocks in org files using ESLint",

    async execute(args: string[], context: CliContext): Promise<number> {
      return runLint(args, context);
    },
  },
};
