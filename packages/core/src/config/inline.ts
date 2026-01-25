/**
 * Inline Config Extraction
 *
 * Extracts configuration from org files using #+NAME: config blocks.
 * Supports both JSON and TypeScript/JavaScript config blocks.
 *
 * @example JSON config block
 * ```org
 * #+NAME: config
 * #+begin_src json
 * {
 *   "outDir": "dist",
 *   "base": "/docs/"
 * }
 * #+end_src
 * ```
 *
 * @example TypeScript config block
 * ```org
 * #+NAME: config
 * #+begin_src typescript
 * export default {
 *   outDir: "dist",
 *   base: process.env.BASE_URL || "/",
 * };
 * #+end_src
 * ```
 */

import type { OrgPressUserConfig } from "./types.ts";

/**
 * Result of extracting inline config
 */
export interface InlineConfigResult {
  /** The extracted config object */
  config: Partial<OrgPressUserConfig>;
  /** The language of the config block */
  language: "json" | "typescript" | "javascript";
  /** Start line of the config block (1-based) */
  startLine: number;
  /** End line of the config block (1-based) */
  endLine: number;
}

/**
 * Extract inline configuration from org file content
 *
 * Looks for a code block named "config" and parses it as JSON or evaluates
 * it as JavaScript/TypeScript.
 *
 * @param content - Raw org file content
 * @returns Extracted config or null if no config block found
 *
 * @example
 * const result = extractInlineConfig(orgContent);
 * if (result) {
 *   console.log(result.config.outDir);
 * }
 */
export function extractInlineConfig(content: string): InlineConfigResult | null {
  const lines = content.split("\n");

  let configBlockName: string | null = null;
  let inConfigBlock = false;
  let blockLanguage: string | null = null;
  let blockContent: string[] = [];
  let startLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1; // 1-based

    // Check for #+NAME: config (case insensitive)
    const nameMatch = line.match(/^#\+(?:NAME|name):\s*config\s*$/i);
    if (nameMatch) {
      configBlockName = "config";
      continue;
    }

    // Check for #+begin_src after #+NAME: config
    if (configBlockName === "config" && !inConfigBlock) {
      const beginMatch = line.match(/^#\+begin_src\s+(\w+)/i);
      if (beginMatch) {
        blockLanguage = beginMatch[1].toLowerCase();
        inConfigBlock = true;
        startLine = lineNum;
        blockContent = [];
        continue;
      }
      // If we hit anything else after #+NAME: config, reset
      if (line.trim() && !line.startsWith("#+")) {
        configBlockName = null;
      }
    }

    // Collect block content
    if (inConfigBlock) {
      // Check for #+end_src
      if (line.match(/^#\+end_src$/i)) {
        const endLine = lineNum;

        // Parse the config based on language
        const config = parseConfigBlock(blockContent.join("\n"), blockLanguage!);

        if (config) {
          const normalizedLang = normalizeLanguage(blockLanguage!);
          if (normalizedLang) {
            return {
              config,
              language: normalizedLang,
              startLine,
              endLine,
            };
          }
        }

        // Reset state
        configBlockName = null;
        inConfigBlock = false;
        blockLanguage = null;
        blockContent = [];
        continue;
      }

      blockContent.push(line);
    }
  }

  return null;
}

/**
 * Normalize language name to supported type
 */
function normalizeLanguage(lang: string): "json" | "typescript" | "javascript" | null {
  const lower = lang.toLowerCase();

  if (lower === "json") {
    return "json";
  }

  if (lower === "typescript" || lower === "ts") {
    return "typescript";
  }

  if (lower === "javascript" || lower === "js") {
    return "javascript";
  }

  return null;
}

/**
 * Parse config block content based on language
 */
function parseConfigBlock(
  content: string,
  language: string
): Partial<OrgPressUserConfig> | null {
  const normalizedLang = normalizeLanguage(language);

  if (!normalizedLang) {
    console.warn(`[inline-config] Unsupported config language: ${language}`);
    return null;
  }

  try {
    if (normalizedLang === "json") {
      return parseJsonConfig(content);
    }

    // TypeScript or JavaScript
    return parseJsConfig(content);
  } catch (error) {
    console.error(
      `[inline-config] Failed to parse ${normalizedLang} config:`,
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

/**
 * Parse JSON config block
 */
function parseJsonConfig(content: string): Partial<OrgPressUserConfig> | null {
  const trimmed = content.trim();

  if (!trimmed) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed);

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      console.warn("[inline-config] JSON config must be an object");
      return null;
    }

    return parsed as Partial<OrgPressUserConfig>;
  } catch (error) {
    throw new Error(`Invalid JSON: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Parse JavaScript/TypeScript config block
 *
 * Supports:
 * - export default { ... }
 * - module.exports = { ... }
 * - Plain object expression
 */
function parseJsConfig(content: string): Partial<OrgPressUserConfig> | null {
  const trimmed = content.trim();

  if (!trimmed) {
    return null;
  }

  try {
    // Create a function that evaluates the config
    // We need to handle different export patterns

    // Pattern 1: export default { ... }
    if (trimmed.includes("export default")) {
      const transformed = trimmed.replace(
        /export\s+default\s+/,
        "return "
      );
      const fn = new Function(transformed);
      return fn();
    }

    // Pattern 2: module.exports = { ... }
    if (trimmed.includes("module.exports")) {
      const transformed = trimmed.replace(
        /module\.exports\s*=\s*/,
        "return "
      );
      const fn = new Function(transformed);
      return fn();
    }

    // Pattern 3: Plain object - wrap and return
    // Check if it looks like an object literal
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      const fn = new Function(`return ${trimmed}`);
      return fn();
    }

    // Pattern 4: Try to evaluate as-is (for simple expressions)
    const fn = new Function(`return (${trimmed})`);
    return fn();
  } catch (error) {
    throw new Error(`Invalid JavaScript: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Check if an org file has an inline config block
 *
 * @param content - Raw org file content
 * @returns true if a config block exists
 */
export function hasInlineConfig(content: string): boolean {
  return extractInlineConfig(content) !== null;
}

/**
 * Merge inline config with base config
 *
 * Inline config values override base config values.
 *
 * @param base - Base configuration
 * @param inline - Inline configuration (partial)
 * @returns Merged configuration
 */
export function mergeInlineConfig<T extends object>(
  base: T,
  inline: Partial<T>
): T {
  return {
    ...base,
    ...inline,
  };
}
