/**
 * Deploy Plugin
 *
 * Provides the `orgp deploy` command for publishing org files to various targets.
 */

import { CreateCommand } from "org-press";
import type { ParsedArgs, CommandContext } from "org-press";
import { deploy, createConsoleLogger } from "./core.ts";
import { getAdapterNames } from "./adapters/index.ts";
import type { DeployOptions } from "./types.ts";

/**
 * Parse command line arguments for deploy command
 *
 * @param args - Raw command line arguments
 * @returns Parsed deploy options
 */
export function parseDeployArgs(args: ParsedArgs): {
  orgFile: string | undefined;
  options: DeployOptions;
} {
  const positional = args._ || [];
  const orgFile = positional[0];

  // Extract adapter options
  const options: DeployOptions = {
    adapter: args.adapter as string | undefined,
    registry: args.registry as string | undefined,
    tag: args.tag as string | undefined,
    dryRun: args["dry-run"] as boolean | undefined,
    access: args.access as "public" | "restricted" | undefined,
    outDir: args["out-dir"] as string | undefined,
    noReadme: args["no-readme"] as boolean | undefined,
    skipBuild: args["skip-build"] as boolean | undefined,
    bump: args.bump as "patch" | "minor" | "major" | undefined,
    environment: args.environment as "production" | "preview" | "development" | undefined,
  };

  return { orgFile, options };
}

/**
 * Run the deploy command
 *
 * @param args - Parsed command line arguments
 * @param ctx - Command context
 * @returns Exit code (0 for success, 1 for failure)
 */
export async function runDeploy(
  args: ParsedArgs,
  ctx: CommandContext
): Promise<number> {
  const { orgFile, options } = parseDeployArgs(args);

  // Validate org file argument
  if (!orgFile) {
    console.error("[deploy] Error: No org file specified");
    console.error("");
    console.error("Usage: orgp deploy <file.org> [options]");
    console.error("");
    console.error("Examples:");
    console.error("  orgp deploy my-package.org");
    console.error("  orgp deploy my-package.org --dry-run");
    console.error("  orgp deploy my-package.org --adapter npm --tag beta");
    return 1;
  }

  // Create logger with verbose mode if DEBUG is set
  const verbose = !!process.env.DEBUG || args.verbose === true;
  const logger = createConsoleLogger({ verbose });

  // Run deployment
  const result = await deploy({
    orgFile,
    ...options,
    logger,
  });

  if (result.success) {
    console.log("");
    console.log("[deploy] Deployment successful!");
    if (result.url) {
      console.log(`[deploy] URL: ${result.url}`);
    }
    if (result.deploymentId) {
      console.log(`[deploy] Deployment ID: ${result.deploymentId}`);
    }
    return 0;
  } else {
    console.error("");
    console.error(`[deploy] Deployment failed: ${result.error}`);
    return 1;
  }
}

/**
 * Deploy plugin
 *
 * Registers the `deploy` CLI command for publishing org files
 * to npm, GitHub Pages, Cloudflare, or other targets.
 *
 * Usage:
 *   orgp deploy my-package.org              # Deploy with default adapter (npm)
 *   orgp deploy my-package.org --dry-run    # Preview without publishing
 *   orgp deploy my-package.org --adapter npm --tag beta
 *   orgp deploy my-package.org --bump patch # Auto-bump version
 *
 * Available adapters:
 *   npm         - Publish to npm registry (default)
 *   + External adapters can be registered via config
 *
 * @example
 * ```typescript
 * // .org-press/config.ts
 * import { deployPlugin } from '@org-press/deploy';
 *
 * export default {
 *   contentDir: 'content',
 *   plugins: [deployPlugin],
 * };
 * ```
 */
export const deployPlugin = CreateCommand("deploy", {
  description: "Deploy org file to npm, GitHub Pages, or other targets",
  args: [
    {
      name: "adapter",
      alias: "a",
      type: "string",
      description: `Adapter to use (${getAdapterNames().join(", ")})`,
      default: "npm",
    },
    {
      name: "registry",
      alias: "r",
      type: "string",
      description: "Target registry URL (for npm adapter)",
    },
    {
      name: "tag",
      alias: "t",
      type: "string",
      description: "Publish tag (default: latest)",
      default: "latest",
    },
    {
      name: "dry-run",
      alias: "n",
      type: "boolean",
      description: "Preview deployment without publishing",
      default: false,
    },
    {
      name: "access",
      type: "string",
      description: "Package access level (public, restricted)",
    },
    {
      name: "out-dir",
      alias: "o",
      type: "string",
      description: "Output directory for build artifacts",
    },
    {
      name: "no-readme",
      type: "boolean",
      description: "Skip README.md generation",
      default: false,
    },
    {
      name: "skip-build",
      type: "boolean",
      description: "Skip build phase, use existing artifacts",
      default: false,
    },
    {
      name: "bump",
      alias: "b",
      type: "string",
      description: "Auto-bump version (patch, minor, major)",
    },
    {
      name: "environment",
      alias: "e",
      type: "string",
      description: "Deployment environment (production, preview, development)",
      default: "production",
    },
    {
      name: "verbose",
      alias: "v",
      type: "boolean",
      description: "Enable verbose output",
      default: false,
    },
  ],
  execute: runDeploy,
});
