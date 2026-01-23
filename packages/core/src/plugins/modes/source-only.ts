/**
 * Source Only Mode
 *
 * Displays source code without executing the block.
 * Useful for documentation blocks or examples that shouldn't run.
 */

import type { PreviewFn, PreviewResult, BlockContext } from "../preview.ts";

export interface SourceOnlyModeConfig {
  /** Whether to show line numbers */
  lineNumbers?: boolean;

  /** Custom label for the source section */
  label?: string;

  /** CSS class for the container */
  className?: string;

  /** Whether to highlight syntax (default: true) */
  highlight?: boolean;
}

/**
 * Source Only mode factory
 *
 * This mode ignores block execution and just renders the source code.
 *
 * @example
 * ```org
 * #+begin_src typescript :use sourceOnly
 * // This code won't be executed, just displayed
 * const secret = process.env.SECRET_KEY;
 * doSomethingDangerous(secret);
 * #+end_src
 * ```
 *
 * @example
 * // With line numbers
 * :use sourceOnly?lineNumbers
 *
 * @example
 * // With custom label
 * :use sourceOnly?label=Example
 */
export const sourceOnlyMode = (config?: Record<string, unknown>) => {
  const {
    lineNumbers = false,
    label = "",
    className = "org-source-only",
    highlight = true,
  } = (config ?? {}) as SourceOnlyModeConfig;

  // Return a wrapper that ignores both input preview and result
  return (_inputPreview: PreviewFn): PreviewFn => {
    return (_result: unknown, ctx: BlockContext): PreviewResult => {
      const sourceCode = formatSourceCode(ctx.block.content, {
        lineNumbers,
        language: ctx.block.language,
      });

      const langClass = highlight ? `language-${ctx.block.language}` : "";

      const labelHtml = label
        ? `<div class="org-source-label">${escapeHtml(label)}</div>`
        : "";

      return `<div class="${className}">
  ${labelHtml}
  <pre><code class="${langClass}">${escapeHtml(sourceCode)}</code></pre>
</div>`;
    };
  };
};

/**
 * Format source code with optional line numbers
 */
function formatSourceCode(
  code: string,
  options: { lineNumbers: boolean; language: string }
): string {
  if (!options.lineNumbers) {
    return code;
  }

  const lines = code.split("\n");
  const padWidth = String(lines.length).length;

  return lines
    .map((line, i) => `${String(i + 1).padStart(padWidth, " ")} | ${line}`)
    .join("\n");
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
