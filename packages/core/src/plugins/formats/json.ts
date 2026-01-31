/**
 * JSON Format Wrapper
 *
 * Formats execution result as JSON with syntax highlighting.
 */

import type { RenderFunction, RenderResult, BlockContext } from "../preview.ts";

export interface JsonFormatConfig {
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
 * JSON format wrapper factory
 *
 * Formats the result as pretty-printed JSON.
 *
 * @example
 * ```org
 * #+begin_src javascript :use server | json
 * return { name: "Alice", settings: { theme: "dark" } };
 * #+end_src
 * ```
 *
 * @example
 * // Custom indentation
 * :use server | json?indent=4
 */
export const jsonFormat = (config?: Record<string, unknown>) => {
  const {
    indent = 2,
    className = "org-json",
    highlight = true,
    maxDepth = 0,
  } = (config ?? {}) as JsonFormatConfig;

  return (_inputRender: RenderFunction): RenderFunction => {
    return (result: unknown, _ctx: BlockContext): RenderResult => {
      // Handle null/undefined
      if (result === null) {
        return `<pre class="${className}"><code class="${highlight ? "language-json" : ""}">null</code></pre>`;
      }

      if (result === undefined) {
        return null;
      }

      try {
        // Apply max depth if specified
        const processed = maxDepth > 0 ? truncateDepth(result, maxDepth) : result;
        const json = JSON.stringify(processed, null, indent);
        const escaped = escapeHtml(json);

        return `<pre class="${className}"><code class="${highlight ? "language-json" : ""}">${escaped}</code></pre>`;
      } catch (error) {
        // Handle circular references or other stringify errors
        const errorMsg = error instanceof Error ? error.message : "JSON stringify error";
        return `<pre class="${className} org-error"><code>Error: ${escapeHtml(errorMsg)}</code></pre>`;
      }
    };
  };
};

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
