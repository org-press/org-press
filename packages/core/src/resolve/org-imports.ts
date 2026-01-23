/**
 * Org Import Resolution
 *
 * Pure functions for resolving .org?name= imports.
 * Used by both Vite plugin and LSP - single source of truth.
 */

import { join, dirname, resolve, relative } from "path";
import type { BlockManifest, BlockInfo } from "../dts/types.js";
import { createVirtualModuleId } from "../plugins/utils.js";

/**
 * Extension mapping for block languages
 */
const EXTENSION_MAP: Record<string, string> = {
  typescript: "ts",
  ts: "ts",
  javascript: "js",
  js: "js",
  tsx: "tsx",
  jsx: "jsx",
};

/**
 * Parsed org import query
 */
export interface OrgImportQuery {
  /** Path without query string */
  orgPath: string;
  /** Block name from ?name=X (required) */
  blockName: string;
  /** Has ?data flag */
  isDataImport: boolean;
}

/**
 * Successfully resolved org import
 */
export interface ResolvedOrgImport {
  /** Virtual module ID (same format as Vite plugin) */
  virtualModuleId: string;
  /** Org file path relative to content dir */
  orgFilePath: string;
  /** The resolved block */
  block: BlockInfo;
  /** File extension */
  extension: string;
}

/**
 * Import resolution error
 */
export interface OrgImportError {
  code: "INVALID_SYNTAX" | "ORG_FILE_NOT_FOUND" | "BLOCK_NOT_FOUND" | "MISSING_NAME";
  message: string;
  importPath: string;
}

/**
 * Result of org import resolution
 */
export type OrgImportResult =
  | { ok: true; resolved: ResolvedOrgImport }
  | { ok: false; error: OrgImportError };

/**
 * Check if an import path is an org import
 */
export function isOrgImport(importPath: string): boolean {
  return importPath.includes(".org?") || importPath.endsWith(".org");
}

/**
 * Parse .org import with query string
 * Only supports ?name= syntax (not ?index=)
 *
 * @example
 * parseOrgImportQuery('./lib.org?name=utils')
 * // { orgPath: './lib.org', blockName: 'utils', isDataImport: false }
 */
export function parseOrgImportQuery(importPath: string): OrgImportQuery | null {
  if (!importPath.includes(".org")) {
    return null;
  }

  // Split path and query
  const queryIndex = importPath.indexOf("?");
  if (queryIndex === -1) {
    // No query string - can't resolve without block name
    return null;
  }

  const orgPath = importPath.slice(0, queryIndex);
  const queryString = importPath.slice(queryIndex + 1);

  // Parse query parameters
  const params = new URLSearchParams(queryString);
  const blockName = params.get("name");
  const isDataImport = params.has("data");

  // We only support ?name= imports (not ?index=)
  if (!blockName) {
    return null;
  }

  return {
    orgPath,
    blockName,
    isDataImport,
  };
}

/**
 * Resolve relative/absolute org path to content-relative path
 *
 * @param orgPath - The org file path from import (./file.org, ../file.org, /file.org)
 * @param importerPath - Path of the importing file (can be virtual module ID or org path)
 * @param contentDir - Content directory (where org files live)
 * @returns Resolved path relative to content dir, or null if invalid
 */
export function resolveOrgPath(
  orgPath: string,
  importerPath: string | undefined,
  contentDir: string
): string | null {
  // Handle absolute paths (from content root)
  if (orgPath.startsWith("/")) {
    // /file.org -> file.org (relative to content dir)
    return orgPath.slice(1);
  }

  // For relative paths, we need an importer
  if (!importerPath) {
    return null;
  }

  // Extract the directory of the importer
  let importerDir: string;

  // Check if importer is a virtual module ID
  if (importerPath.includes("virtual:org-press:block:")) {
    // Extract org file path from virtual module ID
    // Format: virtual:org-press:block:parser:path/to/file.org:NAME:blockName.ext
    const match = importerPath.match(/virtual:org-press:block:[^:]+:([^:]+\.org)/);
    if (match) {
      importerDir = dirname(match[1]);
    } else {
      return null;
    }
  } else if (importerPath.endsWith(".org")) {
    // Regular org file path
    importerDir = dirname(importerPath);
  } else if (importerPath.includes(".org-press-cache")) {
    // Cached JS file - map back to content directory
    // Cache structure: .org-press-cache/content/path/to/orgfile/blockname.js
    // where 'orgfile' directory corresponds to 'orgfile.org'
    // So we need dirname TWICE to get to the directory where the org file lives
    // e.g., "node_modules/.org-press-cache/content/examples/block-imports/use-local-helper.js"
    //    -> dirname twice -> "content/examples/"
    const cacheMarker = ".org-press-cache/";
    const cacheIndex = importerPath.indexOf(cacheMarker);
    if (cacheIndex !== -1) {
      // Get the path after the cache marker (e.g., "content/examples/block-imports/file.js")
      const contentRelativePath = importerPath.slice(cacheIndex + cacheMarker.length);
      // First dirname gets us to the org file directory (e.g., "content/examples/block-imports")
      // Second dirname gets us to where the org file actually lives (e.g., "content/examples")
      importerDir = dirname(dirname(contentRelativePath));
    } else {
      return null;
    }
  } else {
    // Unknown importer type
    return null;
  }

  // Resolve relative path
  const resolvedPath = join(importerDir, orgPath);

  // Normalize and ensure it's within content dir bounds
  // Remove any leading slashes
  return resolvedPath.replace(/^\/+/, "");
}

/**
 * Find a block by name in the manifest
 */
function findBlockByName(
  manifest: BlockManifest,
  orgFilePath: string,
  blockName: string
): BlockInfo | null {
  const blocks = manifest.blocksByFile.get(orgFilePath);
  if (!blocks) {
    return null;
  }

  return blocks.find((b) => b.name === blockName) || null;
}

/**
 * Resolve a complete .org?name= import
 * This is the main entry point - used by both Vite plugin and LSP
 *
 * @param importPath - Full import path with query string
 * @param importerPath - Path of the importing file (relative to content dir or virtual module ID)
 * @param contentDir - Content directory
 * @param manifest - Block manifest for looking up blocks
 * @returns Result with resolved import or error
 */
export function resolveOrgImport(
  importPath: string,
  importerPath: string | undefined,
  contentDir: string,
  manifest: BlockManifest
): OrgImportResult {
  // Parse the import query
  const query = parseOrgImportQuery(importPath);

  if (!query) {
    // Check if it's an org import without ?name=
    if (importPath.includes(".org")) {
      return {
        ok: false,
        error: {
          code: "MISSING_NAME",
          message: `Import '${importPath}' is missing ?name= parameter. Use: ${importPath}?name=blockName`,
          importPath,
        },
      };
    }

    return {
      ok: false,
      error: {
        code: "INVALID_SYNTAX",
        message: `Invalid import syntax: ${importPath}`,
        importPath,
      },
    };
  }

  // Resolve the org file path
  const resolvedOrgPath = resolveOrgPath(query.orgPath, importerPath, contentDir);

  if (!resolvedOrgPath) {
    return {
      ok: false,
      error: {
        code: "INVALID_SYNTAX",
        message: `Cannot resolve org path '${query.orgPath}' from '${importerPath || "unknown"}'`,
        importPath,
      },
    };
  }

  // Check if org file exists in manifest
  if (!manifest.blocksByFile.has(resolvedOrgPath)) {
    return {
      ok: false,
      error: {
        code: "ORG_FILE_NOT_FOUND",
        message: `Org file not found: ${resolvedOrgPath}`,
        importPath,
      },
    };
  }

  // Find the block by name
  const block = findBlockByName(manifest, resolvedOrgPath, query.blockName);

  if (!block) {
    return {
      ok: false,
      error: {
        code: "BLOCK_NOT_FOUND",
        message: `Block '${query.blockName}' not found in ${resolvedOrgPath}`,
        importPath,
      },
    };
  }

  // Determine extension
  const extension = EXTENSION_MAP[block.language.toLowerCase()] || "js";

  // Get parser from block parameters (default to "default")
  const parser = block.parameters?.use || "default";

  // Create virtual module ID (same format as Vite plugin)
  const virtualModuleId = createVirtualModuleId(
    parser,
    resolvedOrgPath,
    block.index,
    extension,
    block.name
  );

  return {
    ok: true,
    resolved: {
      virtualModuleId,
      orgFilePath: resolvedOrgPath,
      block,
      extension,
    },
  };
}
