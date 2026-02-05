/**
 * Package metadata extraction from org files
 *
 * Extracts package.json metadata from org keywords.
 * Works with uniorg AST - no file I/O.
 */

import type { OrgData } from "uniorg";
import type { PackageMetadata, NamedBlock } from "../types.ts";

/**
 * Extract package metadata from org AST
 *
 * Maps org keywords to package.json fields:
 * - #+TITLE: -> name
 * - #+VERSION: -> version
 * - #+DESCRIPTION: -> description
 * - #+AUTHOR: -> author
 * - #+LICENSE: -> license (default: MIT)
 * - #+KEYWORDS: -> keywords (comma-separated)
 * - #+REPOSITORY: -> repository
 * - #+HOMEPAGE: -> homepage
 * - #+NODE_VERSION: -> engines.node
 * - #+DEPENDENCIES: -> dependencies (name@version,name@version)
 * - #+PEER_DEPS: -> peerDependencies
 * - #+DEV_DEPS: -> devDependencies
 *
 * @param ast - Parsed org AST from uniorg
 * @param fallbackName - Fallback name if #+TITLE is not specified
 * @returns Package metadata object
 */
export function extractPackageMetadata(
  ast: OrgData,
  fallbackName?: string
): PackageMetadata {
  const rawMetadata = extractAllKeywords(ast);

  const metadata: PackageMetadata = {
    name: rawMetadata.title || fallbackName || "unnamed-package",
    version: rawMetadata.version || "1.0.0",
    description: rawMetadata.description,
    author: rawMetadata.author,
    license: rawMetadata.license || "MIT",
    keywords: rawMetadata.keywords
      ? rawMetadata.keywords.split(",").map((k: string) => k.trim())
      : undefined,
    repository: rawMetadata.repository,
    homepage: rawMetadata.homepage,
    engines: rawMetadata.node_version
      ? { node: rawMetadata.node_version }
      : undefined,
    dependencies: parseDependencies(rawMetadata.dependencies),
    peerDependencies: parseDependencies(rawMetadata.peer_deps),
    devDependencies: parseDependencies(rawMetadata.dev_deps),
  };

  return metadata;
}

/**
 * Extract all keywords from org AST as key-value pairs
 */
function extractAllKeywords(ast: OrgData): Record<string, string> {
  const keywords: Record<string, string> = {};

  if (!ast?.children) return keywords;

  for (const node of ast.children) {
    if (node.type === "keyword" && node.key) {
      const key = node.key.toLowerCase().replace(/-/g, "_");
      const value = node.value?.trim();
      if (value) {
        keywords[key] = value;
      }
    }
  }

  return keywords;
}

/**
 * Parse dependency string into version map
 *
 * Format: "name@version, name@version, ..."
 * If no version specified, uses "*"
 *
 * @example
 * "react@^18.0.0, lodash@4.17.21" -> { react: "^18.0.0", lodash: "4.17.21" }
 * "express, cors" -> { express: "*", cors: "*" }
 */
export function parseDependencies(
  deps: string | undefined
): Record<string, string> | undefined {
  if (!deps) return undefined;

  const result: Record<string, string> = {};
  const parts = deps.split(",").map((p) => p.trim());

  for (const part of parts) {
    if (!part) continue;

    // Handle scoped packages (@scope/name@version)
    let name: string;
    let version: string;

    if (part.startsWith("@")) {
      // Scoped package: @scope/name@version
      const lastAtIndex = part.lastIndexOf("@");
      if (lastAtIndex > 0) {
        // Check if there's a version after the scope
        const potentialVersion = part.slice(lastAtIndex + 1);
        if (potentialVersion.match(/^\d|^\^|^~|^>/)) {
          // Has version
          name = part.slice(0, lastAtIndex);
          version = potentialVersion;
        } else {
          // No version, just scoped name
          name = part;
          version = "*";
        }
      } else {
        name = part;
        version = "*";
      }
    } else {
      // Non-scoped package: name@version
      const atIndex = part.indexOf("@");
      if (atIndex > 0) {
        name = part.slice(0, atIndex);
        version = part.slice(atIndex + 1);
      } else {
        name = part;
        version = "*";
      }
    }

    if (name) {
      result[name] = version || "*";
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Extract named blocks from org AST
 *
 * Looks for blocks with #+NAME: directive that should be exported:
 * - main: package entry point (becomes index.js)
 * - types: type definitions
 * - Any other named block: exported submodule
 *
 * @param ast - Parsed org AST
 * @returns Array of named blocks
 */
export function extractNamedBlocks(ast: OrgData): NamedBlock[] {
  const blocks: NamedBlock[] = [];

  function walk(node: any): void {
    if (!node) return;

    if (node.type === "src-block") {
      const name = node.affiliated?.NAME;

      // Only include blocks with a name (used for export)
      if (name) {
        blocks.push({
          name,
          language: node.language || "javascript",
          code: node.value || "",
        });
      }
    }

    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        walk(child);
      }
    }
  }

  walk(ast);
  return blocks;
}

/**
 * Bump version according to semver
 *
 * @param version - Current version (e.g., "1.2.3")
 * @param type - Bump type (patch, minor, major)
 * @returns New version string
 */
export function bumpVersion(
  version: string,
  type: "patch" | "minor" | "major"
): string {
  const parts = version.split(".").map((p) => parseInt(p, 10) || 0);

  while (parts.length < 3) {
    parts.push(0);
  }

  switch (type) {
    case "major":
      parts[0]++;
      parts[1] = 0;
      parts[2] = 0;
      break;
    case "minor":
      parts[1]++;
      parts[2] = 0;
      break;
    case "patch":
      parts[2]++;
      break;
  }

  return parts.join(".");
}
