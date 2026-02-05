/**
 * Lint Plugin
 *
 * Provides the `orgp lint` command for linting code blocks with ESLint.
 */

import { CreateCommand } from "org-press";
import type { ParsedArgs, CommandContext } from "org-press";
import { runLint } from "./command.js";

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
export const lintPlugin = CreateCommand("lint", {
  description: "Lint code blocks in org files using ESLint",
  args: [
    { name: "fix", type: "boolean", description: "Auto-fix problems" },
    { name: "languages", type: "string", description: "Comma-separated list of languages" },
  ],
  execute: (args: ParsedArgs, ctx: CommandContext) => runLint(args._, ctx),
});
