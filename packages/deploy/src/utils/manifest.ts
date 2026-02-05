/**
 * Package.json manifest generation
 *
 * Generates a complete package.json from metadata and named blocks.
 */

import type { PackageMetadata, NamedBlock } from "../types.ts";

/**
 * Generate package.json from metadata and named blocks
 *
 * Creates a complete package.json with:
 * - Basic metadata (name, version, description, etc.)
 * - ESM exports map based on named blocks
 * - Dependencies from metadata
 *
 * @param metadata - Package metadata from org file
 * @param namedBlocks - Named code blocks for exports
 * @returns Package.json as object
 */
export function generatePackageJson(
  metadata: PackageMetadata,
  namedBlocks: NamedBlock[]
): Record<string, unknown> {
  const mainBlock = namedBlocks.find((b) => b.name === "main");
  const exports: Record<string, unknown> = {};

  // Build exports map
  if (mainBlock) {
    exports["."] = {
      import: "./dist/index.js",
    };
  }

  for (const block of namedBlocks) {
    if (block.name !== "main") {
      exports[`./${block.name}`] = {
        import: `./dist/${block.name}.js`,
      };
    }
  }

  const packageJson: Record<string, unknown> = {
    name: metadata.name,
    version: metadata.version,
    description: metadata.description,
    type: "module",
    main: "./dist/index.js",
    exports: Object.keys(exports).length > 0 ? exports : undefined,
    files: ["dist", "README.md"],
    keywords: metadata.keywords,
    author: metadata.author,
    license: metadata.license,
    repository: metadata.repository
      ? { type: "git", url: metadata.repository }
      : undefined,
    homepage: metadata.homepage,
    engines: metadata.engines,
    dependencies: metadata.dependencies,
    peerDependencies: metadata.peerDependencies,
    devDependencies: metadata.devDependencies,
  };

  // Remove undefined values
  for (const key of Object.keys(packageJson)) {
    if (packageJson[key] === undefined) {
      delete packageJson[key];
    }
  }

  return packageJson;
}

/**
 * Validate package.json structure
 *
 * Checks that required fields are present and valid.
 *
 * @param packageJson - Package.json object to validate
 * @returns Array of validation errors (empty if valid)
 */
export function validatePackageJson(
  packageJson: Record<string, unknown>
): string[] {
  const errors: string[] = [];

  // Required fields
  if (!packageJson.name || typeof packageJson.name !== "string") {
    errors.push("Missing or invalid 'name' field");
  } else {
    // Validate package name format
    const name = packageJson.name as string;
    if (!isValidPackageName(name)) {
      errors.push(
        `Invalid package name '${name}'. Must be lowercase, may contain hyphens, and scoped names must start with @`
      );
    }
  }

  if (!packageJson.version || typeof packageJson.version !== "string") {
    errors.push("Missing or invalid 'version' field");
  } else {
    // Validate semver format
    const version = packageJson.version as string;
    if (!isValidSemver(version)) {
      errors.push(`Invalid version '${version}'. Must be valid semver (e.g., 1.0.0)`);
    }
  }

  return errors;
}

/**
 * Check if package name is valid
 */
function isValidPackageName(name: string): boolean {
  // Scoped packages: @scope/name
  if (name.startsWith("@")) {
    const parts = name.split("/");
    if (parts.length !== 2) return false;
    const scope = parts[0].slice(1);
    const pkgName = parts[1];
    return (
      isValidNamePart(scope) && isValidNamePart(pkgName)
    );
  }

  // Regular packages
  return isValidNamePart(name);
}

/**
 * Check if name part is valid (lowercase, hyphens allowed)
 */
function isValidNamePart(name: string): boolean {
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(name) || /^[a-z0-9]$/.test(name);
}

/**
 * Check if version is valid semver
 */
function isValidSemver(version: string): boolean {
  // Basic semver: major.minor.patch with optional prerelease
  return /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/.test(version);
}
