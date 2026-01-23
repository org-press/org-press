/**
 * withSourceCode Wrapper
 *
 * Displays source code alongside the preview result.
 * Can show code before, after, or replace the preview.
 */

import type { WrapperFactory, PreviewFn, PreviewResult, BlockContext } from "../preview.ts";

export interface WithSourceCodeConfig {
  /** Where to show the source code: before, after, or replace preview */
  position?: "before" | "after" | "replace";

  /** Custom label for the source code section */
  label?: string;

  /** Whether to show line numbers */
  lineNumbers?: boolean;

  /** CSS class for the source code container */
  className?: string;
}

/**
 * Creates a wrapper that displays source code alongside the preview
 *
 * @example
 * ```typescript
 * // Show code before result
 * ":use preview | withSourceCode?position=before"
 *
 * // Show code after result
 * ":use preview | withSourceCode?position=after"
 *
 * // Show only code (no execution result)
 * ":use preview | withSourceCode?position=replace"
 * ```
 */
export const withSourceCode: WrapperFactory = (config?: Record<string, unknown>) => {
  const {
    position = "after",
    label = "Source",
    lineNumbers = false,
    className = "org-source-code",
  } = (config ?? {}) as WithSourceCodeConfig;

  return (preview: PreviewFn): PreviewFn => {
    return (result: unknown, ctx: BlockContext): PreviewResult => {
      const sourceCode = formatSourceCode(ctx.block.content, {
        language: ctx.block.language,
        lineNumbers,
      });

      const sourceElement = `<div class="${className}">
        ${label ? `<div class="org-source-label">${label}</div>` : ""}
        <pre><code class="language-${ctx.block.language}">${escapeHtml(ctx.block.content)}</code></pre>
      </div>`;

      if (position === "replace") {
        return sourceElement;
      }

      const previewResult = preview(result, ctx);
      const previewHtml = typeof previewResult === "string" ? previewResult : "";

      if (position === "before") {
        return `${sourceElement}\n${previewHtml}`;
      }

      // position === "after"
      return `${previewHtml}\n${sourceElement}`;
    };
  };
};

/**
 * Format source code with optional line numbers
 */
function formatSourceCode(
  code: string,
  options: { language: string; lineNumbers: boolean }
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
