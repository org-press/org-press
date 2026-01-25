/**
 * withCollapse Wrapper
 *
 * Wraps the render output in a collapsible panel.
 */

import type { WrapperFactory, RenderFunction, RenderResult, BlockContext } from "../preview.ts";

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
 * Creates a wrapper that wraps the render output in a collapsible panel
 *
 * Uses the HTML <details>/<summary> elements for native collapse behavior.
 *
 * @example
 * ```typescript
 * // Basic collapsible
 * ":use dom | withCollapse"
 *
 * // With custom summary
 * ":use dom | withCollapse?summary=Show Result"
 *
 * // Start expanded
 * ":use dom | withCollapse?open"
 *
 * // Use block name as summary
 * ":use dom | withCollapse?useBlockName"
 * ```
 */
export const withCollapse: WrapperFactory = (config?: Record<string, unknown>) => {
  const {
    summary = "Result",
    open = false,
    className = "org-collapse",
    useBlockName = false,
  } = (config ?? {}) as WithCollapseConfig;

  return (render: RenderFunction): RenderFunction => {
    return (result: unknown, ctx: BlockContext): RenderResult => {
      const renderResult = render(result, ctx);

      if (renderResult === null) {
        return null;
      }

      const content = typeof renderResult === "string" ? renderResult : "";

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
