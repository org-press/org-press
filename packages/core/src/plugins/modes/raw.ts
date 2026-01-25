/**
 * Raw Mode
 *
 * Outputs the execution result directly without any render transformation.
 * If the result is a string containing HTML, it's output as-is.
 * Otherwise, values are converted to strings.
 */

import type { RenderFunction, RenderResult, BlockContext } from "../preview.ts";

export interface RawModeConfig {
  /** If true, escape HTML in non-string results */
  escapeNonHtml?: boolean;

  /** If true, format objects as JSON */
  formatJson?: boolean;

  /** JSON indentation (default: 2) */
  jsonIndent?: number;
}

/**
 * Raw mode factory
 *
 * This mode outputs the block's result directly without any wrapping.
 * Useful for blocks that produce HTML directly or need full control over output.
 *
 * @example
 * ```org
 * #+begin_src typescript :use raw
 * // This HTML is output directly
 * export default `<div class="custom">Hello</div>`;
 * #+end_src
 * ```
 *
 * @example
 * // Format objects as JSON
 * :use raw?formatJson
 *
 * @example
 * // Escape non-HTML values
 * :use raw?escapeNonHtml
 */
export const rawMode = (config?: Record<string, unknown>) => {
  const {
    escapeNonHtml = false,
    formatJson = false,
    jsonIndent = 2,
  } = (config ?? {}) as RawModeConfig;

  // Return a wrapper that outputs the result directly
  return (_inputRender: RenderFunction): RenderFunction => {
    return (result: unknown, _ctx: BlockContext): RenderResult => {
      // Handle null/undefined
      if (result === null || result === undefined) {
        return null;
      }

      // If result is already a string, return it directly
      if (typeof result === "string") {
        return result;
      }

      // Format as JSON if requested
      if (formatJson || typeof result === "object") {
        try {
          const json = JSON.stringify(result, null, jsonIndent);
          if (escapeNonHtml) {
            return `<pre><code>${escapeHtml(json)}</code></pre>`;
          }
          return `<pre><code>${escapeHtml(json)}</code></pre>`;
        } catch {
          // JSON.stringify can fail for circular references
          const str = String(result);
          return escapeNonHtml ? escapeHtml(str) : str;
        }
      }

      // Convert to string
      const str = String(result);
      return escapeNonHtml ? escapeHtml(str) : str;
    };
  };
};

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
