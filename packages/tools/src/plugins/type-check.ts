/**
 * Type-Check Plugin
 *
 * Provides the `orgp type-check` command for type-checking TypeScript blocks.
 */

import type { BlockPlugin } from "org-press";
import { runTypeCheck } from "../commands/type-check.js";

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
export const typeCheckPlugin: BlockPlugin = {
  name: "type-check",
  defaultExtension: "ts",

  cli: {
    command: "type-check",
    description: "Type-check TypeScript blocks in org files",
    execute: (args, ctx) => runTypeCheck(args, ctx),
  },
};
