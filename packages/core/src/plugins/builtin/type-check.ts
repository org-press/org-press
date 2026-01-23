/**
 * Type-Check Plugin
 *
 * Provides the `orgp type-check` CLI command for type-checking TypeScript
 * code blocks in org files.
 *
 * Usage:
 *   orgp type-check                    # Check all TS/TSX blocks
 *   orgp type-check --watch            # Watch mode
 *   orgp type-check content/api.org    # Check specific files
 */

import type { BlockPlugin, CliContext } from "../types.ts";
import { runTypeCheck } from "../../cli/commands/type-check.ts";

/**
 * Type-check plugin for org-press
 *
 * This plugin only provides CLI functionality - it doesn't transform blocks.
 * The `orgp type-check` command type-checks TypeScript blocks using the
 * TypeScript compiler.
 */
export const typeCheckPlugin: BlockPlugin = {
  name: "type-check",
  defaultExtension: "ts", // Required by interface but not used

  /**
   * CLI command for type-checking code blocks
   */
  cli: {
    command: "type-check",
    description: "Type-check TypeScript blocks in org files",

    async execute(args: string[], context: CliContext): Promise<number> {
      return runTypeCheck(args, context);
    },
  },
};
