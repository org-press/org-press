/**
 * Format Plugin
 *
 * Provides the `orgp fmt` command for formatting code blocks with Prettier.
 */

import { CreateCommand } from "org-press";
import type { ParsedArgs, CommandContext } from "org-press";
import { runFmt } from "./command.js";

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
export const fmtPlugin = CreateCommand("fmt", {
  description: "Format code blocks in org files using Prettier",
  args: [
    { name: "check", type: "boolean", description: "Check if files are formatted" },
    { name: "languages", type: "string", description: "Comma-separated list of languages" },
  ],
  execute: (args: ParsedArgs, ctx: CommandContext) => runFmt(args._, ctx),
});
