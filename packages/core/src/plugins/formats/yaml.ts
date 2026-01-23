/**
 * YAML Format Wrapper
 *
 * Formats execution result as YAML.
 */

import type { PreviewFn, PreviewResult, BlockContext } from "../preview.ts";

export interface YamlFormatConfig {
  /** Indentation spaces (default: 2) */
  indent?: number;

  /** CSS class for the container */
  className?: string;

  /** Whether to add syntax highlighting class */
  highlight?: boolean;

  /** Maximum depth for nested objects (0 = unlimited) */
  maxDepth?: number;
}

/**
 * YAML format wrapper factory
 *
 * Formats the result as YAML.
 *
 * @example
 * ```org
 * #+begin_src javascript :use server | yaml
 * return { name: "Alice", settings: { theme: "dark" } };
 * #+end_src
 * ```
 */
export const yamlFormat = (config?: Record<string, unknown>) => {
  const {
    indent = 2,
    className = "org-yaml",
    highlight = true,
    maxDepth = 0,
  } = (config ?? {}) as YamlFormatConfig;

  return (_inputPreview: PreviewFn): PreviewFn => {
    return (result: unknown, _ctx: BlockContext): PreviewResult => {
      // Handle null/undefined
      if (result === null) {
        return `<pre class="${className}"><code class="${highlight ? "language-yaml" : ""}">null</code></pre>`;
      }

      if (result === undefined) {
        return null;
      }

      try {
        // Apply max depth if specified
        const processed = maxDepth > 0 ? truncateDepth(result, maxDepth) : result;
        const yaml = toYaml(processed, indent);
        const escaped = escapeHtml(yaml);

        return `<pre class="${className}"><code class="${highlight ? "language-yaml" : ""}">${escaped}</code></pre>`;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "YAML conversion error";
        return `<pre class="${className} org-error"><code>Error: ${escapeHtml(errorMsg)}</code></pre>`;
      }
    };
  };
};

/**
 * Convert value to YAML string
 *
 * Simple implementation that handles common types.
 * For more complex cases, consider using a full YAML library.
 */
function toYaml(value: unknown, indent: number, level = 0): string {
  const spaces = " ".repeat(indent * level);

  if (value === null) {
    return "null";
  }

  if (value === undefined) {
    return "~";
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (typeof value === "number") {
    if (Number.isNaN(value)) return ".nan";
    if (value === Infinity) return ".inf";
    if (value === -Infinity) return "-.inf";
    return String(value);
  }

  if (typeof value === "string") {
    // Check if string needs quoting
    if (
      value === "" ||
      value.includes("\n") ||
      value.includes(":") ||
      value.includes("#") ||
      value.startsWith(" ") ||
      value.endsWith(" ") ||
      /^[0-9]/.test(value) ||
      ["true", "false", "null", "yes", "no", "on", "off"].includes(value.toLowerCase())
    ) {
      // Use double quotes for strings with special characters
      if (value.includes("\n")) {
        return `|\n${value.split("\n").map((line) => spaces + "  " + line).join("\n")}`;
      }
      return `"${value.replace(/"/g, '\\"')}"`;
    }
    return value;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "[]";
    }
    return value
      .map((item) => {
        const itemYaml = toYaml(item, indent, level + 1);
        if (typeof item === "object" && item !== null && !Array.isArray(item)) {
          // Object items get nested under the dash
          return `${spaces}- ${itemYaml.trim().replace(/^/, "").replace(/\n/g, `\n${spaces}  `)}`;
        }
        return `${spaces}- ${itemYaml}`;
      })
      .join("\n");
  }

  if (typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return "{}";
    }
    return entries
      .map(([key, val]) => {
        const valYaml = toYaml(val, indent, level + 1);
        if (typeof val === "object" && val !== null && !Array.isArray(val) && Object.keys(val).length > 0) {
          return `${spaces}${key}:\n${valYaml}`;
        }
        if (Array.isArray(val) && val.length > 0) {
          return `${spaces}${key}:\n${valYaml}`;
        }
        return `${spaces}${key}: ${valYaml}`;
      })
      .join("\n");
  }

  return String(value);
}

/**
 * Truncate object at specified depth
 */
function truncateDepth(value: unknown, maxDepth: number, currentDepth = 0): unknown {
  if (currentDepth >= maxDepth) {
    if (Array.isArray(value)) {
      return `[Array(${value.length})]`;
    }
    if (typeof value === "object" && value !== null) {
      return "[Object]";
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => truncateDepth(item, maxDepth, currentDepth + 1));
  }

  if (typeof value === "object" && value !== null) {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = truncateDepth(val, maxDepth, currentDepth + 1);
    }
    return result;
  }

  return value;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
