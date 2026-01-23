/**
 * withCollapse Wrapper
 *
 * Wraps the preview in a collapsible panel.
 */

import type { WrapperFactory, PreviewFn, PreviewResult, BlockContext } from "../preview.ts";

export interface WithCollapseConfig {
  /** Summary text shown when collapsed */
  summary?: string;

  /** Whether to start expanded (default: false) */
  open?: boolean;

  /** CSS class for the details element */
  className?: string;

  /** Use block name as summary if no summary provided */
  useBlockName?: boolean;
}

/**
 * Creates a wrapper that wraps the preview in a collapsible panel
 *
 * Uses the HTML <details>/<summary> elements for native collapse behavior.
 *
 * @example
 * ```typescript
 * // Basic collapsible
 * ":use preview | withCollapse"
 *
 * // With custom summary
 * ":use preview | withCollapse?summary=Show Result"
 *
 * // Start expanded
 * ":use preview | withCollapse?open"
 *
 * // Use block name as summary
 * ":use preview | withCollapse?useBlockName"
 * ```
 */
export const withCollapse: WrapperFactory = (config?: Record<string, unknown>) => {
  const {
    summary = "Result",
    open = false,
    className = "org-collapse",
    useBlockName = false,
  } = (config ?? {}) as WithCollapseConfig;

  return (preview: PreviewFn): PreviewFn => {
    return (result: unknown, ctx: BlockContext): PreviewResult => {
      const previewResult = preview(result, ctx);

      if (previewResult === null) {
        return null;
      }

      const content = typeof previewResult === "string" ? previewResult : "";

      // Determine summary text
      let summaryText = summary;
      if (useBlockName && ctx.block.name) {
        summaryText = ctx.block.name;
      }

      const openAttr = open ? " open" : "";

      return `<details class="${className}"${openAttr}>
  <summary>${escapeHtml(summaryText)}</summary>
  <div class="org-collapse-content">${content}</div>
</details>`;
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
