/**
 * NPM Registry Adapter
 *
 * Deploys packages to npm registry (or compatible registries like Gitea).
 */

import { spawnSync } from "node:child_process";
import type {
  DeployAdapter,
  AdapterConfig,
  ValidationResult,
  DeployContext,
  DeployResult,
} from "../types.ts";

/**
 * NPM adapter configuration options
 */
export interface NpmAdapterOptions {
  /** Target registry URL (default: https://registry.npmjs.org) */
  registry?: string;
  /** Publish tag (default: latest) */
  tag?: string;
  /** Package access level */
  access?: "public" | "restricted";
}

/**
 * NPM Registry Adapter
 *
 * Publishes packages to npm-compatible registries.
 *
 * @example
 * ```typescript
 * const adapter = new NpmAdapter({
 *   registry: 'https://registry.npmjs.org',
 *   tag: 'latest',
 *   access: 'public',
 * });
 *
 * const result = await adapter.deploy(context);
 * ```
 */
export class NpmAdapter implements DeployAdapter {
  readonly name = "npm";
  readonly description = "Publish to npm registry";

  private options: NpmAdapterOptions;

  constructor(options: NpmAdapterOptions = {}) {
    this.options = options;
  }

  /**
   * Validate adapter configuration
   *
   * Checks:
   * - npm is available in PATH
   * - Registry URL is valid (if specified)
   * - Access level is valid
   */
  async validate(config: AdapterConfig): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check npm is available
    const npmCheck = spawnSync("npm", ["--version"], {
      encoding: "utf-8",
      timeout: 5000,
    });

    if (npmCheck.status !== 0) {
      errors.push("npm is not available in PATH");
    }

    // Validate registry URL if specified
    const registry =
      (config.options.registry as string) ||
      this.options.registry ||
      "https://registry.npmjs.org";

    try {
      new URL(registry);
    } catch {
      errors.push(`Invalid registry URL: ${registry}`);
    }

    // Validate access level
    const access =
      (config.options.access as string) || this.options.access;
    if (access && !["public", "restricted"].includes(access)) {
      errors.push(`Invalid access level: ${access}. Must be 'public' or 'restricted'.`);
    }

    // Warn about authentication
    const authToken =
      config.env.NPM_TOKEN ||
      config.env.npm_config_token ||
      config.env.NODE_AUTH_TOKEN;

    if (!authToken && registry.includes("npmjs.org")) {
      warnings.push(
        "No NPM_TOKEN found. Ensure you are logged in or set NPM_TOKEN environment variable."
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Execute deployment to npm registry
   *
   * Runs `npm publish` with appropriate options.
   */
  async deploy(context: DeployContext): Promise<DeployResult> {
    const {
      outDir,
      metadata,
      adapterConfig,
      dryRun,
      logger,
    } = context;

    // Resolve options (context config overrides constructor options)
    const registry =
      (adapterConfig.registry as string) ||
      this.options.registry ||
      "https://registry.npmjs.org";

    const tag =
      (adapterConfig.tag as string) || this.options.tag || "latest";

    const access =
      (adapterConfig.access as "public" | "restricted") ||
      this.options.access;

    logger.info(`Publishing ${metadata.name}@${metadata.version}`);
    logger.info(`Registry: ${registry}`);
    logger.info(`Tag: ${tag}`);
    if (access) {
      logger.info(`Access: ${access}`);
    }

    if (dryRun) {
      logger.info("Dry run mode - skipping actual publish");
      return {
        success: true,
        deploymentId: `dry-run-${Date.now()}`,
        url: this.getPackageUrl(metadata.name, registry),
        logs: ["Dry run completed successfully"],
      };
    }

    // Build npm publish arguments
    const publishArgs = ["publish"];

    publishArgs.push("--tag", tag);

    if (access) {
      publishArgs.push("--access", access);
    }

    // Execute npm publish
    logger.info(`Running: npm ${publishArgs.join(" ")}`);

    const result = spawnSync("npm", publishArgs, {
      cwd: outDir,
      encoding: "utf-8",
      env: {
        ...process.env,
        npm_config_registry: registry,
      },
    });

    if (result.status !== 0) {
      const errorOutput = result.stderr || result.stdout || "Unknown error";
      logger.error(`npm publish failed: ${errorOutput}`);

      return {
        success: false,
        error: `npm publish failed with exit code ${result.status}: ${errorOutput}`,
        logs: [result.stdout, result.stderr].filter(Boolean) as string[],
      };
    }

    logger.info("Published successfully!");

    return {
      success: true,
      deploymentId: `${metadata.name}@${metadata.version}`,
      url: this.getPackageUrl(metadata.name, registry),
      logs: [result.stdout, result.stderr].filter(Boolean) as string[],
    };
  }

  /**
   * Get package URL on registry
   */
  private getPackageUrl(packageName: string, registry: string): string | undefined {
    if (registry.includes("npmjs.org")) {
      return `https://www.npmjs.com/package/${packageName}`;
    }
    // For other registries, we don't know the web URL
    return undefined;
  }
}

/**
 * Factory function to create NpmAdapter
 *
 * @example
 * ```typescript
 * import { npmAdapter } from '@org-press/deploy';
 *
 * export default defineConfig({
 *   deploy: {
 *     adapter: npmAdapter({ registry: 'https://registry.npmjs.org' }),
 *   },
 * });
 * ```
 */
export function npmAdapter(options: NpmAdapterOptions = {}): NpmAdapter {
  return new NpmAdapter(options);
}
