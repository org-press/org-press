/**
 * Target Resolution
 *
 * Resolves CLI targets (file, directory, glob) to org files.
 * Used by dev and build commands to determine what to process.
 */

import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Target type
 */
export type TargetType = "file" | "directory" | "glob" | "project";

/**
 * Resolved target information
 */
export interface ResolvedTarget {
  /** Type of target */
  type: TargetType;

  /** Original target string */
  original: string;

  /** Resolved file paths (absolute) */
  files: string[];

  /** Base directory for relative path calculation */
  baseDir: string;
}

/**
 * Resolve target type from string
 *
 * @param target - Target string (file, directory, or glob pattern)
 * @returns Target type
 */
export function getTargetType(target: string): TargetType {
  // Check for glob patterns
  if (hasGlobPattern(target)) {
    return "glob";
  }

  // Check if target exists
  const resolved = path.resolve(process.cwd(), target);

  if (!fs.existsSync(resolved)) {
    // Doesn't exist - might be a glob or invalid
    // Check if it contains potential glob chars that we missed
    if (target.includes("*") || target.includes("?") || target.includes("[")) {
      return "glob";
    }
    // Treat non-existent paths as files (will error later)
    return "file";
  }

  const stat = fs.statSync(resolved);
  return stat.isDirectory() ? "directory" : "file";
}

/**
 * Check if string contains glob patterns
 */
export function hasGlobPattern(str: string): boolean {
  // Common glob patterns: *, ?, [...], {a,b}, **
  return /[*?[\]{}]/.test(str);
}

/**
 * Resolve target to org files
 *
 * @param target - Target string or undefined for project mode
 * @returns Resolved target with file list
 */
export async function resolveTarget(
  target: string | undefined
): Promise<ResolvedTarget> {
  // No target = project mode (use config)
  if (!target) {
    return {
      type: "project",
      original: "",
      files: [],
      baseDir: process.cwd(),
    };
  }

  const type = getTargetType(target);
  const resolved = path.resolve(process.cwd(), target);

  switch (type) {
    case "file":
      return resolveFileTarget(target, resolved);

    case "directory":
      return resolveDirectoryTarget(target, resolved);

    case "glob":
      return resolveGlobTarget(target);

    default:
      return {
        type: "project",
        original: target,
        files: [],
        baseDir: process.cwd(),
      };
  }
}

/**
 * Resolve single file target
 */
function resolveFileTarget(
  original: string,
  resolved: string
): ResolvedTarget {
  if (!fs.existsSync(resolved)) {
    throw new Error(`File not found: ${resolved}`);
  }

  if (!resolved.endsWith(".org")) {
    throw new Error(`Not an org file: ${resolved}`);
  }

  return {
    type: "file",
    original,
    files: [resolved],
    baseDir: path.dirname(resolved),
  };
}

/**
 * Resolve directory target
 */
function resolveDirectoryTarget(
  original: string,
  resolved: string
): ResolvedTarget {
  const files = findOrgFiles(resolved);

  return {
    type: "directory",
    original,
    files,
    baseDir: resolved,
  };
}

/**
 * Find all org files in directory recursively
 */
function findOrgFiles(dir: string): string[] {
  const files: string[] = [];

  if (!fs.existsSync(dir)) {
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Skip node_modules, .git, etc.
      if (
        entry.name === "node_modules" ||
        entry.name.startsWith(".") ||
        entry.name === "dist"
      ) {
        continue;
      }
      files.push(...findOrgFiles(fullPath));
    } else if (entry.name.endsWith(".org")) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Resolve glob target
 *
 * Uses a simple glob implementation for common patterns.
 */
async function resolveGlobTarget(pattern: string): Promise<ResolvedTarget> {
  const files = await expandGlob(pattern);

  // Find common base directory
  const baseDir = findCommonBase(files) || process.cwd();

  return {
    type: "glob",
    original: pattern,
    files: files.filter((f) => f.endsWith(".org")),
    baseDir,
  };
}

/**
 * Expand glob pattern to file list
 *
 * Simple implementation supporting:
 * - * - match any characters except path separator
 * - ** - match any characters including path separator
 * - ? - match single character
 */
async function expandGlob(pattern: string): Promise<string[]> {
  const baseDir = findGlobBase(pattern);
  const relativePattern = getRelativeGlobPattern(pattern);

  const regex = globToRegex(relativePattern);
  const files: string[] = [];

  function scanDir(dir: string, relativePath: string = ""): void {
    if (!fs.existsSync(dir)) {
      return;
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        // Skip hidden and common ignore directories
        if (
          entry.name.startsWith(".") ||
          entry.name === "node_modules" ||
          entry.name === "dist"
        ) {
          continue;
        }
        scanDir(fullPath, relPath);
      } else {
        if (regex.test(relPath)) {
          files.push(fullPath);
        }
      }
    }
  }

  scanDir(baseDir);
  return files;
}

/**
 * Find base directory from glob pattern (portion before first glob char)
 */
function findGlobBase(pattern: string): string {
  const segments = pattern.split(/[/\\]/);
  const baseSegments: string[] = [];

  for (const segment of segments) {
    if (hasGlobPattern(segment)) {
      break;
    }
    baseSegments.push(segment);
  }

  const base = baseSegments.join(path.sep) || ".";
  return path.resolve(process.cwd(), base);
}

/**
 * Get the relative glob pattern (portion after base directory segments)
 */
function getRelativeGlobPattern(pattern: string): string {
  const segments = pattern.split(/[/\\]/);
  let foundGlob = false;
  const patternSegments: string[] = [];

  for (const segment of segments) {
    if (foundGlob || hasGlobPattern(segment)) {
      foundGlob = true;
      patternSegments.push(segment);
    }
  }

  return patternSegments.join("/");
}

/**
 * Convert glob pattern to regex
 *
 * Process glob patterns BEFORE escaping to preserve them through the transformation.
 */
function globToRegex(pattern: string): RegExp {
  let regexStr = pattern
    // First: replace glob patterns with placeholders (before escaping)
    // **/ at start matches zero or more directory segments
    .replace(/^\*\*\//, "\x00STARSTART\x00")
    // **/ in middle matches zero or more directory segments
    .replace(/\/\*\*\//g, "\x00STARMID\x00")
    // ** matches anything including /
    .replace(/\*\*/g, "\x00STARSTAR\x00")
    // * matches anything except /
    .replace(/\*/g, "\x00STAR\x00")
    // ? matches single char except /
    .replace(/\?/g, "\x00QUESTION\x00")
    // Now: escape regex special chars
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    // Finally: replace placeholders with regex patterns
    .replace(/\x00STARSTART\x00/g, "(.*\\/)?")
    .replace(/\x00STARMID\x00/g, "(\\/.*\\/|\\/)")
    .replace(/\x00STARSTAR\x00/g, ".*")
    .replace(/\x00STAR\x00/g, "[^/]*")
    .replace(/\x00QUESTION\x00/g, "[^/]");

  return new RegExp(`^${regexStr}$`);
}

/**
 * Find common base directory from file list
 */
function findCommonBase(files: string[]): string | null {
  if (files.length === 0) {
    return null;
  }

  if (files.length === 1) {
    return path.dirname(files[0]);
  }

  const segments = files.map((f) => f.split(path.sep));
  const common: string[] = [];

  for (let i = 0; i < segments[0].length; i++) {
    const segment = segments[0][i];
    if (segments.every((s) => s[i] === segment)) {
      common.push(segment);
    } else {
      break;
    }
  }

  return common.length > 0 ? common.join(path.sep) : null;
}

/**
 * Format target for display
 */
export function formatTarget(target: ResolvedTarget): string {
  switch (target.type) {
    case "file":
      return `file: ${target.original}`;
    case "directory":
      return `directory: ${target.original} (${target.files.length} files)`;
    case "glob":
      return `glob: ${target.original} (${target.files.length} files)`;
    case "project":
      return "project mode";
  }
}
