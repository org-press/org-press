/**
 * @org-press/deploy
 *
 * Pluggable deploy system for org-press with adapter architecture.
 *
 * Supports multiple deployment targets through adapters:
 * - npm registry (built-in)
 * - GitHub Pages (@org-press/deploy-github-pages)
 * - Cloudflare Pages (@org-press/deploy-cloudflare)
 *
 * @example
 * ```typescript
 * // Use as CLI plugin
 * import { deployPlugin } from '@org-press/deploy';
 *
 * export default {
 *   plugins: [deployPlugin],
 * };
 * ```
 *
 * @example
 * ```typescript
 * // Use programmatically
 * import { deploy } from '@org-press/deploy';
 *
 * const result = await deploy({
 *   orgFile: 'my-package.org',
 *   dryRun: true,
 * });
 * ```
 */

// Core types
export type {
  DeployAdapter,
  AdapterConfig,
  ValidationResult,
  DeployContext,
  DeployResult,
  DeploymentStatus,
  PackageMetadata,
  NamedBlock,
  DeployLogger,
  DeployOptions,
  AdapterFactory,
} from "./types.ts";

// Utilities
export {
  // Metadata extraction
  extractPackageMetadata,
  extractNamedBlocks,
  parseDependencies,
  bumpVersion,
  // Build utilities
  buildPackage,
  transpileCode,
  listDirectory,
  formatBytes,
  type BuildOptions,
  type BuildResult,
  // Manifest generation
  generatePackageJson,
  validatePackageJson,
  // README generation
  generateReadme,
  extractProse,
} from "./utils/index.ts";

// Adapters
export {
  // NPM adapter
  NpmAdapter,
  npmAdapter,
  type NpmAdapterOptions,
  // Adapter registry
  registerAdapter,
  getAdapter,
  getAdapterNames,
  hasAdapter,
  unregisterAdapter,
  clearAdapters,
  initBuiltinAdapters,
} from "./adapters/index.ts";

// Deploy core
export {
  deploy,
  createConsoleLogger,
  createSilentLogger,
  createBufferedLogger,
  type DeployCoreOptions,
  type DeployCoreResult,
} from "./core.ts";

// Deploy plugin (CLI command)
export { deployPlugin, runDeploy, parseDeployArgs } from "./plugin.ts";
