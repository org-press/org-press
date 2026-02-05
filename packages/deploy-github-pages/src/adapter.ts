/**
 * GitHub Pages Deploy Adapter
 *
 * Deploys static sites to GitHub Pages by pushing to the gh-pages branch.
 */

import { spawnSync } from "node:child_process";
import { writeFileSync, existsSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type {
  DeployAdapter,
  AdapterConfig,
  ValidationResult,
  DeployContext,
  DeployResult,
} from "@org-press/deploy";
import type { GitHubPagesConfig } from "./types.ts";

/**
 * GitHub Pages Deploy Adapter
 *
 * Deploys static files to GitHub Pages by:
 * 1. Initializing a git repo in the output directory
 * 2. Adding .nojekyll and CNAME files as configured
 * 3. Committing all files
 * 4. Force pushing to the gh-pages branch
 *
 * @example
 * ```typescript
 * const adapter = new GitHubPagesAdapter({
 *   repo: 'user/my-site',
 *   cname: 'mysite.com',
 * });
 *
 * const result = await adapter.deploy(context);
 * ```
 */
export class GitHubPagesAdapter implements DeployAdapter {
  readonly name = "github-pages";
  readonly description = "Deploy to GitHub Pages";

  private config: GitHubPagesConfig;

  constructor(config: GitHubPagesConfig = {}) {
    this.config = config;
  }

  /**
   * Validate adapter configuration
   *
   * Checks:
   * - git is available in PATH
   * - Repository format is valid (if specified)
   */
  async validate(adapterConfig: AdapterConfig): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check git is available
    const gitCheck = spawnSync("git", ["--version"], {
      encoding: "utf-8",
      timeout: 5000,
    });

    if (gitCheck.status !== 0) {
      errors.push("git is not available in PATH");
    }

    // Validate repository format if specified
    const repo =
      (adapterConfig.options.repo as string) || this.config.repo;

    if (repo) {
      const repoPattern = /^[\w.-]+\/[\w.-]+$/;
      if (!repoPattern.test(repo)) {
        errors.push(
          `Invalid repository format: "${repo}". Expected format: "user/repo" or "org/repo"`
        );
      }
    }

    // Validate branch name if specified
    const branch =
      (adapterConfig.options.branch as string) ||
      this.config.branch ||
      "gh-pages";

    const branchPattern = /^[\w./-]+$/;
    if (!branchPattern.test(branch)) {
      errors.push(`Invalid branch name: "${branch}"`);
    }

    // Warn if no repo specified and might fail to auto-detect
    if (!repo) {
      warnings.push(
        "No repository specified. Will attempt to auto-detect from git remote."
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Execute deployment to GitHub Pages
   *
   * Initializes a git repository in the output directory,
   * adds all files, and force pushes to the gh-pages branch.
   */
  async deploy(context: DeployContext): Promise<DeployResult> {
    const { outDir, metadata, adapterConfig, dryRun, logger } = context;

    // Resolve configuration (context config overrides constructor config)
    const branch =
      (adapterConfig.branch as string) || this.config.branch || "gh-pages";

    const cname = (adapterConfig.cname as string) ?? this.config.cname;

    const noJekyll =
      (adapterConfig.noJekyll as boolean) ?? this.config.noJekyll ?? true;

    const message =
      (adapterConfig.message as string) ||
      this.config.message ||
      "Deploy to GitHub Pages";

    const remote =
      (adapterConfig.remote as string) || this.config.remote || "origin";

    // Determine repository
    let repo = (adapterConfig.repo as string) || this.config.repo;

    if (!repo) {
      repo = this.autoDetectRepo();
      if (!repo) {
        return {
          success: false,
          error:
            "Could not auto-detect repository. Please specify repo in adapter config.",
        };
      }
      logger.info(`Auto-detected repository: ${repo}`);
    }

    logger.info(`Deploying to GitHub Pages: ${repo}`);
    logger.info(`Branch: ${branch}`);
    if (cname) {
      logger.info(`Custom domain: ${cname}`);
    }

    if (dryRun) {
      logger.info("Dry run mode - skipping actual deployment");
      return {
        success: true,
        deploymentId: `dry-run-${Date.now()}`,
        url: this.getPageUrl(repo, cname),
        logs: ["Dry run completed successfully"],
      };
    }

    try {
      // Add .nojekyll file if configured
      if (noJekyll) {
        const nojekyllPath = join(outDir, ".nojekyll");
        writeFileSync(nojekyllPath, "");
        logger.debug("Added .nojekyll file");
      }

      // Add CNAME file if custom domain configured
      if (cname) {
        const cnamePath = join(outDir, "CNAME");
        writeFileSync(cnamePath, cname);
        logger.debug(`Added CNAME file: ${cname}`);
      }

      // Remove existing .git directory if present
      const gitDir = join(outDir, ".git");
      if (existsSync(gitDir)) {
        rmSync(gitDir, { recursive: true });
      }

      // Initialize git repository
      const initResult = this.runGit(["init"], outDir);
      if (!initResult.success) {
        return {
          success: false,
          error: `Failed to initialize git repository: ${initResult.error}`,
        };
      }
      logger.debug("Initialized git repository");

      // Configure git user for this repo (required for commit)
      this.runGit(
        ["config", "user.email", "github-pages-deploy@org-press"],
        outDir
      );
      this.runGit(["config", "user.name", "org-press deploy"], outDir);

      // Add all files
      const addResult = this.runGit(["add", "-A"], outDir);
      if (!addResult.success) {
        return {
          success: false,
          error: `Failed to add files: ${addResult.error}`,
        };
      }
      logger.debug("Added all files to git");

      // Create commit
      const commitResult = this.runGit(
        ["commit", "-m", message],
        outDir
      );
      if (!commitResult.success) {
        return {
          success: false,
          error: `Failed to create commit: ${commitResult.error}`,
        };
      }
      logger.debug("Created commit");

      // Add remote
      const remoteUrl = `https://github.com/${repo}.git`;
      const remoteAddResult = this.runGit(
        ["remote", "add", remote, remoteUrl],
        outDir
      );
      if (!remoteAddResult.success) {
        // Remote might already exist, try to set the URL
        this.runGit(["remote", "set-url", remote, remoteUrl], outDir);
      }
      logger.debug(`Set remote ${remote} to ${remoteUrl}`);

      // Force push to branch
      logger.info(`Pushing to ${remote}/${branch}...`);
      const pushResult = this.runGit(
        ["push", "-f", remote, `HEAD:${branch}`],
        outDir
      );
      if (!pushResult.success) {
        return {
          success: false,
          error: `Failed to push to GitHub: ${pushResult.error}`,
          logs: pushResult.output ? [pushResult.output] : undefined,
        };
      }

      logger.info("Successfully deployed to GitHub Pages!");

      return {
        success: true,
        deploymentId: `${repo}@${branch}`,
        url: this.getPageUrl(repo, cname),
        logs: pushResult.output ? [pushResult.output] : undefined,
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
   * Auto-detect repository from git remote
   */
  private autoDetectRepo(): string | undefined {
    const result = spawnSync("git", ["remote", "get-url", "origin"], {
      encoding: "utf-8",
      timeout: 5000,
    });

    if (result.status !== 0 || !result.stdout) {
      return undefined;
    }

    const url = result.stdout.trim();

    // Parse GitHub URL formats:
    // https://github.com/user/repo.git
    // https://github.com/user/repo
    // git@github.com:user/repo.git
    // git@github.com:user/repo
    const httpsMatch = url.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
    if (httpsMatch) {
      return `${httpsMatch[1]}/${httpsMatch[2]}`;
    }

    return undefined;
  }

  /**
   * Get the GitHub Pages URL for the repository
   */
  private getPageUrl(repo: string, cname?: string): string {
    if (cname) {
      return `https://${cname}`;
    }

    const [user, repoName] = repo.split("/");

    // Check if it's a user/org pages repo (e.g., user.github.io)
    if (repoName === `${user}.github.io`) {
      return `https://${user}.github.io`;
    }

    // Project pages URL
    return `https://${user}.github.io/${repoName}`;
  }

  /**
   * Run a git command and return the result
   */
  private runGit(
    args: string[],
    cwd: string
  ): { success: boolean; output?: string; error?: string } {
    const result = spawnSync("git", args, {
      cwd,
      encoding: "utf-8",
      timeout: 60000,
    });

    if (result.status !== 0) {
      return {
        success: false,
        output: result.stdout,
        error: result.stderr || result.stdout || "Unknown git error",
      };
    }

    return {
      success: true,
      output: result.stdout,
    };
  }
}

/**
 * Factory function to create GitHubPagesAdapter
 *
 * @example
 * ```typescript
 * import { githubPagesAdapter } from '@org-press/deploy-github-pages';
 *
 * export default defineConfig({
 *   deploy: {
 *     adapter: githubPagesAdapter({
 *       repo: 'user/my-site',
 *       cname: 'mysite.com',
 *     }),
 *   },
 * });
 * ```
 */
export function githubPagesAdapter(
  config: GitHubPagesConfig = {}
): GitHubPagesAdapter {
  return new GitHubPagesAdapter(config);
}
