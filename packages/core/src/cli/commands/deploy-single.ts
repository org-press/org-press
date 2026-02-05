/**
 * Deploy a single org file to npm registry
 *
 * @deprecated Use `@org-press/deploy` package instead. This module is kept for
 * backwards compatibility and will be removed in a future version.
 *
 * Migration:
 * ```typescript
 * // Old (deprecated)
 * import { deploySingleFile } from 'org-press';
 *
 * // New
 * import { deploy } from '@org-press/deploy';
 * ```
 *
 * For CLI usage, install @org-press/deploy and add it to your plugins.
 */

import * as path from "node:path";

/**
 * Deploy options
 * @deprecated Use DeployOptions from @org-press/deploy instead
 */
export interface DeployOptions {
  /** Target registry (npm, gitea, or custom URL) */
  registry?: string;
  /** Publish tag (default: latest) */
  tag?: string;
  /** Dry run mode - preview without publishing */
  dryRun?: boolean;
  /** Package access level */
  access?: "public" | "restricted";
  /** Output directory for build */
  outDir?: string;
  /** Skip README generation */
  noReadme?: boolean;
  /** Skip build and publish existing */
  skipBuild?: boolean;
  /** Auto-bump version (patch, minor, major) */
  bump?: "patch" | "minor" | "major";
}

/**
 * Deploy result
 * @deprecated Use DeployResult from @org-press/deploy instead
 */
export interface DeployResult {
  /** Whether deploy succeeded */
  success: boolean;
  /** Package name */
  packageName: string;
  /** Version deployed */
  version: string;
  /** Registry URL */
  registry: string;
  /** Package URL (if available) */
  url?: string;
  /** Error message (if failed) */
  error?: string;
}

/**
 * Parse deploy command arguments
 * @deprecated Use parseDeployArgs from @org-press/deploy instead
 */
export function parseDeployArgs(args: string[]): DeployOptions {
  const options: DeployOptions = {};

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === "--registry" || arg === "-r") {
      options.registry = args[++i];
      i++;
      continue;
    }

    if (arg.startsWith("--registry=")) {
      options.registry = arg.slice("--registry=".length);
      i++;
      continue;
    }

    if (arg === "--tag" || arg === "-t") {
      options.tag = args[++i];
      i++;
      continue;
    }

    if (arg.startsWith("--tag=")) {
      options.tag = arg.slice("--tag=".length);
      i++;
      continue;
    }

    if (arg === "--dry-run" || arg === "-n") {
      options.dryRun = true;
      i++;
      continue;
    }

    if (arg === "--access" || arg === "-a") {
      const access = args[++i] as "public" | "restricted";
      if (!["public", "restricted"].includes(access)) {
        throw new Error(`Invalid access level: ${access}. Must be public or restricted.`);
      }
      options.access = access;
      i++;
      continue;
    }

    if (arg.startsWith("--access=")) {
      const access = arg.slice("--access=".length) as "public" | "restricted";
      if (!["public", "restricted"].includes(access)) {
        throw new Error(`Invalid access level: ${access}. Must be public or restricted.`);
      }
      options.access = access;
      i++;
      continue;
    }

    if (arg === "--out-dir" || arg === "-o") {
      options.outDir = args[++i];
      i++;
      continue;
    }

    if (arg.startsWith("--out-dir=")) {
      options.outDir = arg.slice("--out-dir=".length);
      i++;
      continue;
    }

    if (arg === "--no-readme") {
      options.noReadme = true;
      i++;
      continue;
    }

    if (arg === "--skip-build") {
      options.skipBuild = true;
      i++;
      continue;
    }

    if (arg === "--bump" || arg === "-b") {
      const bump = args[++i] as "patch" | "minor" | "major";
      if (!["patch", "minor", "major"].includes(bump)) {
        throw new Error(`Invalid bump type: ${bump}. Must be patch, minor, or major.`);
      }
      options.bump = bump;
      i++;
      continue;
    }

    if (arg.startsWith("--bump=")) {
      const bump = arg.slice("--bump=".length) as "patch" | "minor" | "major";
      if (!["patch", "minor", "major"].includes(bump)) {
        throw new Error(`Invalid bump type: ${bump}. Must be patch, minor, or major.`);
      }
      options.bump = bump;
      i++;
      continue;
    }

    // Skip unknown flags
    if (arg.startsWith("-")) {
      i++;
      continue;
    }

    i++;
  }

  return options;
}

/**
 * Deploy a single org file to npm
 *
 * @deprecated Use `deploy()` from @org-press/deploy instead:
 * ```typescript
 * import { deploy } from '@org-press/deploy';
 * const result = await deploy({ orgFile: 'my-file.org', dryRun: true });
 * ```
 */
export async function deploySingleFile(
  file: string,
  options: DeployOptions = {}
): Promise<DeployResult> {
  // Try to use @org-press/deploy if available
  try {
    const deployPkg = await import("@org-press/deploy");

    // Resolve file path
    const filePath = path.isAbsolute(file) ? file : path.resolve(process.cwd(), file);

    // Map old options to new format
    const result = await deployPkg.deploy({
      orgFile: filePath,
      adapter: "npm",
      registry: options.registry,
      tag: options.tag,
      dryRun: options.dryRun,
      access: options.access,
      outDir: options.outDir,
      noReadme: options.noReadme,
      skipBuild: options.skipBuild,
      bump: options.bump,
    });

    // Map new result to old format
    return {
      success: result.success,
      packageName: result.metadata?.name || "",
      version: result.metadata?.version || "",
      registry: options.registry || "https://registry.npmjs.org",
      url: result.url,
      error: result.error,
    };
  } catch (error) {
    // @org-press/deploy not installed, show helpful message
    const isModuleNotFound =
      error instanceof Error &&
      (error.message.includes("Cannot find module") ||
        error.message.includes("ERR_MODULE_NOT_FOUND"));

    if (isModuleNotFound) {
      console.error("[deploy] Error: @org-press/deploy package not installed");
      console.error("");
      console.error("To use the deploy command, install the deploy package:");
      console.error("  pnpm add @org-press/deploy");
      console.error("");
      console.error("Or with npm:");
      console.error("  npm install @org-press/deploy");

      return {
        success: false,
        packageName: "",
        version: "",
        registry: "",
        error: "@org-press/deploy package not installed. Run: pnpm add @org-press/deploy",
      };
    }

    // Re-throw other errors
    throw error;
  }
}
