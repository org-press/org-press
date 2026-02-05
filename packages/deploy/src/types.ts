/**
 * Deploy Adapter Types
 *
 * Core types for the pluggable deploy adapter system.
 * Adapters implement the DeployAdapter interface to support
 * different deployment targets (npm, GitHub Pages, Cloudflare, etc.)
 */

/**
 * Deploy adapter interface
 *
 * Adapters handle the actual deployment to specific targets.
 * Each adapter validates configuration and executes deployment.
 *
 * @example
 * ```typescript
 * const npmAdapter: DeployAdapter = {
 *   name: 'npm',
 *   description: 'Publish to npm registry',
 *   validate: async (config) => ({ valid: true, errors: [], warnings: [] }),
 *   deploy: async (context) => ({ success: true, packageName: 'my-pkg', version: '1.0.0' }),
 * };
 * ```
 */
export interface DeployAdapter {
  /** Unique adapter identifier (e.g., 'npm', 'github-pages', 'cloudflare') */
  name: string;

  /** Human-readable description for help text */
  description: string;

  /**
   * Validate adapter configuration before deploy
   * Called before deploy() to ensure configuration is valid
   */
  validate(config: AdapterConfig): Promise<ValidationResult>;

  /**
   * Execute the deployment
   * Called after successful validation
   */
  deploy(context: DeployContext): Promise<DeployResult>;

  /**
   * Get deployment status/URL after deploy (optional)
   * Some adapters support checking deployment status
   */
  getStatus?(deploymentId: string): Promise<DeploymentStatus>;
}

/**
 * Configuration passed to adapter validation
 */
export interface AdapterConfig {
  /** Adapter-specific options */
  options: Record<string, unknown>;
  /** Environment variables available */
  env: Record<string, string | undefined>;
}

/**
 * Result of adapter configuration validation
 */
export interface ValidationResult {
  /** Whether the configuration is valid */
  valid: boolean;
  /** List of validation errors (deployment cannot proceed) */
  errors: string[];
  /** List of validation warnings (deployment can proceed) */
  warnings: string[];
}

/**
 * Context provided to adapter during deployment
 */
export interface DeployContext {
  /** Built output directory containing deployable artifacts */
  outDir: string;
  /** Original org file path (if deploying from org file) */
  orgFile?: string;
  /** Package metadata extracted from org file */
  metadata: PackageMetadata;
  /** Adapter-specific configuration */
  adapterConfig: Record<string, unknown>;
  /** Deployment environment */
  environment: "production" | "preview" | "development";
  /** Dry run mode - log actions without executing */
  dryRun: boolean;
  /** Logger for deployment output */
  logger: DeployLogger;
}

/**
 * Result of a deployment
 */
export interface DeployResult {
  /** Whether the deployment succeeded */
  success: boolean;
  /** Unique deployment identifier (for status checks) */
  deploymentId?: string;
  /** URL where deployment is accessible */
  url?: string;
  /** Error message if deployment failed */
  error?: string;
  /** Log messages from deployment */
  logs?: string[];
}

/**
 * Status of a deployment (for adapters that support status checks)
 */
export interface DeploymentStatus {
  /** Current state of deployment */
  state: "pending" | "building" | "deploying" | "ready" | "error";
  /** Deployment URL (if ready) */
  url?: string;
  /** Error message (if error state) */
  error?: string;
  /** Timestamp of last status update */
  updatedAt: Date;
}

/**
 * Package metadata extracted from org file
 *
 * Maps org keywords to package.json fields:
 * - #+TITLE: -> name
 * - #+VERSION: -> version
 * - #+DESCRIPTION: -> description
 * - #+AUTHOR: -> author
 * - etc.
 */
export interface PackageMetadata {
  /** Package name (from #+TITLE:) */
  name: string;
  /** Package version (from #+VERSION:) */
  version: string;
  /** Package description (from #+DESCRIPTION:) */
  description?: string;
  /** Package author (from #+AUTHOR:) */
  author?: string;
  /** License (from #+LICENSE:, defaults to MIT) */
  license?: string;
  /** Keywords (from #+KEYWORDS:, comma-separated) */
  keywords?: string[];
  /** Repository URL (from #+REPOSITORY:) */
  repository?: string;
  /** Homepage URL (from #+HOMEPAGE:) */
  homepage?: string;
  /** Node engine requirement (from #+NODE_VERSION:) */
  engines?: { node?: string };
  /** Runtime dependencies (from #+DEPENDENCIES:) */
  dependencies?: Record<string, string>;
  /** Peer dependencies (from #+PEER_DEPS:) */
  peerDependencies?: Record<string, string>;
  /** Dev dependencies (from #+DEV_DEPS:) */
  devDependencies?: Record<string, string>;
}

/**
 * Named code block extracted from org file
 *
 * Blocks with #+NAME: directive are exported:
 * - #+NAME: main -> package entry point (index.js)
 * - #+NAME: types -> type definitions
 * - #+NAME: utils -> utility functions
 */
export interface NamedBlock {
  /** Block name (from #+NAME:) */
  name: string;
  /** Source language (javascript, typescript, etc.) */
  language: string;
  /** Block source code */
  code: string;
}

/**
 * Logger interface for deployment output
 */
export interface DeployLogger {
  /** Log informational message */
  info(message: string): void;
  /** Log warning message */
  warn(message: string): void;
  /** Log error message */
  error(message: string): void;
  /** Log debug message (only shown in verbose mode) */
  debug(message: string): void;
}

/**
 * Deploy options from CLI or config
 */
export interface DeployOptions {
  /** Target adapter name or adapter instance */
  adapter?: string | DeployAdapter;
  /** Target registry (for npm adapter) */
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
  /** Deployment environment */
  environment?: "production" | "preview" | "development";
}

/**
 * Factory function type for creating adapters
 *
 * External adapter packages export a factory function
 * that creates configured adapter instances.
 *
 * @example
 * ```typescript
 * import { githubPagesAdapter } from '@org-press/deploy-github-pages';
 *
 * export default defineConfig({
 *   deploy: {
 *     adapter: githubPagesAdapter({ repo: 'user/repo' }),
 *   },
 * });
 * ```
 */
export type AdapterFactory<T = Record<string, unknown>> = (
  options: T
) => DeployAdapter;
