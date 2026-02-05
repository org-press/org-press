/**
 * Deploy utilities
 *
 * Exported utilities for package metadata extraction and build.
 */

// Metadata extraction
export {
  extractPackageMetadata,
  extractNamedBlocks,
  parseDependencies,
  bumpVersion,
} from "./metadata.ts";

// Build utilities
export {
  buildPackage,
  transpileCode,
  listDirectory,
  formatBytes,
  type BuildOptions,
  type BuildResult,
} from "./build.ts";

// Manifest generation
export { generatePackageJson, validatePackageJson } from "./manifest.ts";

// README generation
export { generateReadme, extractProse } from "./readme.ts";
