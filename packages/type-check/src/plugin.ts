/**
 * Type-Check Plugin
 *
 * Provides the `orgp type-check` command for type-checking TypeScript blocks.
 */

import { CreateCommand } from "org-press";
import type { ParsedArgs, CommandContext } from "org-press";
import { runTypeCheck } from "./command.js";

/**
 * Type-check plugin
 *
 * Registers the `type-check` CLI command for type-checking TypeScript
 * code blocks in org files using the TypeScript compiler.
 *
 * Usage:
 *   orgp type-check               # Check all TS blocks
 *   orgp type-check content/      # Check specific directory
 */
export const typeCheckPlugin = CreateCommand("type-check", {
  description: "Type-check TypeScript blocks in org files",
  execute: (args: ParsedArgs, ctx: CommandContext) => runTypeCheck(args._, ctx),
});
