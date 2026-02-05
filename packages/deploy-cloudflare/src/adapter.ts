/**
 * Cloudflare Pages Deploy Adapter
 *
 * Deploys static sites to Cloudflare Pages using the wrangler CLI.
 */

import { spawnSync } from "node:child_process";
import type {
  DeployAdapter,
  AdapterConfig,
  ValidationResult,
  DeployContext,
  DeployResult,
} from "@org-press/deploy";
import type { CloudflareConfig } from "./types.ts";

/**
 * Cloudflare Pages Deploy Adapter
 *
 * Deploys static files to Cloudflare Pages using wrangler:
 * 1. Validates wrangler is available and configured
 * 2. Runs `wrangler pages deploy` with the output directory
 * 3. Parses the deployment URL from wrangler output
 *
 * @example
 * ```typescript
 * const adapter = new CloudflareAdapter({
 *   project: 'my-site',
 *   branch: 'preview',
 * });
 *
 * const result = await adapter.deploy(context);
 * ```
 */
export class CloudflareAdapter implements DeployAdapter {
  readonly name = "cloudflare";
  readonly description = "Deploy to Cloudflare Pages";

  private config: CloudflareConfig;

  constructor(config: CloudflareConfig) {
    this.config = config;
  }

  /**
   * Validate adapter configuration
   *
   * Checks:
   * - wrangler is available (via npx)
   * - Project name is valid
   * - API token is available in environment
   */
  async validate(adapterConfig: AdapterConfig): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check wrangler is available via npx
    const wranglerCheck = spawnSync("npx", ["wrangler", "--version"], {
      encoding: "utf-8",
      timeout: 30000,
    });

    if (wranglerCheck.status !== 0) {
      errors.push(
        "wrangler is not available. Install with: npm install -D wrangler"
      );
    }

    // Validate project name
    const project =
      (adapterConfig.options.project as string) || this.config.project;

    if (!project) {
      errors.push("Cloudflare Pages project name is required");
    } else {
      // Project names must be lowercase alphanumeric with hyphens
      const projectPattern = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;
      if (!projectPattern.test(project)) {
        errors.push(
          `Invalid project name: "${project}". Must be lowercase alphanumeric with hyphens, not starting or ending with hyphen.`
        );
      }
    }

    // Check for API token in environment
    const apiToken =
      adapterConfig.env.CLOUDFLARE_API_TOKEN || adapterConfig.env.CF_API_TOKEN;

    if (!apiToken) {
      warnings.push(
        "No CLOUDFLARE_API_TOKEN or CF_API_TOKEN found. Wrangler will prompt for authentication or use cached credentials."
      );
    }

    // Check for account ID
    const accountId =
      (adapterConfig.options.accountId as string) ||
      this.config.accountId ||
      adapterConfig.env.CF_ACCOUNT_ID;

    if (!accountId) {
      warnings.push(
        "No account ID specified. Wrangler will attempt to auto-detect or prompt for selection."
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Execute deployment to Cloudflare Pages
   *
   * Uses wrangler pages deploy command to upload and deploy the site.
   */
  async deploy(context: DeployContext): Promise<DeployResult> {
    const { outDir, adapterConfig, dryRun, logger } = context;

    // Resolve configuration (context config overrides constructor config)
    const project =
      (adapterConfig.project as string) || this.config.project;

    const branch = (adapterConfig.branch as string) || this.config.branch;

    const commitMessage =
      (adapterConfig.commitMessage as string) ||
      this.config.commitMessage ||
      "Deploy from org-press";

    const accountId =
      (adapterConfig.accountId as string) ||
      this.config.accountId ||
      process.env.CF_ACCOUNT_ID;

    logger.info(`Deploying to Cloudflare Pages: ${project}`);
    if (branch) {
      logger.info(`Branch deployment: ${branch}`);
    } else {
      logger.info("Production deployment");
    }

    if (dryRun) {
      logger.info("Dry run mode - skipping actual deployment");
      const previewUrl = branch
        ? `https://${branch}.${project}.pages.dev`
        : `https://${project}.pages.dev`;

      return {
        success: true,
        deploymentId: `dry-run-${Date.now()}`,
        url: previewUrl,
        logs: ["Dry run completed successfully"],
      };
    }

    try {
      // Build wrangler command arguments
      const args = ["wrangler", "pages", "deploy", outDir];

      args.push("--project-name", project);

      if (branch) {
        args.push("--branch", branch);
      }

      if (commitMessage) {
        args.push("--commit-message", commitMessage);
      }

      // Prepare environment with API token
      const env: Record<string, string> = { ...process.env } as Record<
        string,
        string
      >;
      if (accountId) {
        env.CLOUDFLARE_ACCOUNT_ID = accountId;
      }

      logger.info(`Running: npx ${args.join(" ")}`);

      const result = spawnSync("npx", args, {
        encoding: "utf-8",
        timeout: 300000, // 5 minute timeout for uploads
        env,
      });

      if (result.status !== 0) {
        const errorOutput = result.stderr || result.stdout || "Unknown error";
        logger.error(`Wrangler failed: ${errorOutput}`);
        return {
          success: false,
          error: `Wrangler deployment failed: ${errorOutput}`,
          logs: result.stdout ? [result.stdout] : undefined,
        };
      }

      // Parse deployment URL from wrangler output
      const output = result.stdout || "";
      const url = this.parseDeploymentUrl(output, project, branch);

      logger.info("Successfully deployed to Cloudflare Pages!");
      if (url) {
        logger.info(`Deployment URL: ${url}`);
      }

      return {
        success: true,
        deploymentId: this.parseDeploymentId(output) || `cf-${Date.now()}`,
        url,
        logs: output ? [output] : undefined,
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      logger.error(`Deployment failed: ${error}`);
      return {
        success: false,
        error: `Deployment failed: ${error}`,
      };
    }
  }

  /**
   * Parse deployment URL from wrangler output
   *
   * Wrangler outputs the URL in various formats:
   * - "Published to https://xxx.project.pages.dev"
   * - "Deployment complete! https://xxx.project.pages.dev"
   */
  private parseDeploymentUrl(
    output: string,
    project: string,
    branch?: string
  ): string | undefined {
    // Try to find URL in output
    // Matches URLs like:
    // - https://my-site.pages.dev
    // - https://abc123.my-site.pages.dev
    // - https://preview.my-site.pages.dev
    const urlMatch = output.match(
      /https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.pages\.dev/i
    );

    if (urlMatch) {
      return urlMatch[0];
    }

    // Fallback to constructing expected URL
    if (branch) {
      return `https://${branch}.${project}.pages.dev`;
    }

    return `https://${project}.pages.dev`;
  }

  /**
   * Parse deployment ID from wrangler output
   */
  private parseDeploymentId(output: string): string | undefined {
    // Wrangler may output deployment ID in various formats
    const idMatch = output.match(/deployment[:\s]+([a-f0-9-]{36})/i);
    return idMatch ? idMatch[1] : undefined;
  }
}

/**
 * Factory function to create CloudflareAdapter
 *
 * @example
 * ```typescript
 * import { cloudflareAdapter } from '@org-press/deploy-cloudflare';
 *
 * export default defineConfig({
 *   deploy: {
 *     adapter: cloudflareAdapter({
 *       project: 'my-site',
 *       branch: 'preview',
 *     }),
 *   },
 * });
 * ```
 */
export function cloudflareAdapter(config: CloudflareConfig): CloudflareAdapter {
  return new CloudflareAdapter(config);
}
