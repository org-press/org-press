/**
 * withContainer Wrapper
 *
 * Wraps the render result in a container element with optional styling.
 */

import type { WrapperFactory, RenderFunction, RenderResult, BlockContext } from "../preview.ts";

export interface WithContainerConfig {
  /** CSS class name(s) for the container */
  className?: string;

  /** Inline styles for the container */
  style?: Record<string, string | number>;

  /** Container element tag (default: div) */
  tag?: string;

  /** Data attributes to add */
  data?: Record<string, string>;
}

/**
 * Creates a wrapper that wraps the render output in a container
 *
 * @example
 * ```typescript
 * // Add a CSS class
 * ":use dom | withContainer?className=my-block"
 *
 * // Add multiple classes
 * ":use dom | withContainer?className=block highlight"
 *
 * // With JSON config for styles
 * ':use dom | withContainer:{"className":"my-block","style":{"padding":"1rem"}}'
 * ```
 */
export const withContainer: WrapperFactory = (config?: Record<string, unknown>) => {
  const {
    className = "org-block-container",
    style,
    tag = "div",
    data = {},
  } = (config ?? {}) as WithContainerConfig;

  return (render: RenderFunction): RenderFunction => {
    return (result: unknown, ctx: BlockContext): RenderResult => {
      const renderResult = render(result, ctx);

      if (renderResult === null) {
        return null;
      }

      const content = typeof renderResult === "string" ? renderResult : "";

      const styleAttr = style ? ` style="${formatStyle(style)}"` : "";
      const dataAttrs = formatDataAttributes(data);
      const blockData = formatDataAttributes({
        "block-language": ctx.block.language,
        "block-name": ctx.block.name ?? "",
        "block-index": String(ctx.block.index),
      });

      return `<${tag} class="${className}"${styleAttr}${dataAttrs}${blockData}>${content}</${tag}>`;
    };
  };
};

/**
 * Format a style object to CSS string
 */
function formatStyle(style: Record<string, string | number>): string {
  return Object.entries(style)
    .map(([key, value]) => {
      // Convert camelCase to kebab-case
      const cssKey = key.replace(/([A-Z])/g, "-$1").toLowerCase();
      const cssValue = typeof value === "number" ? `${value}px` : value;
      return `${cssKey}: ${cssValue}`;
    })
    .join("; ");
}

/**
 * Format data attributes
 */
function formatDataAttributes(data: Record<string, string>): string {
  return Object.entries(data)
    .filter(([, value]) => value !== "")
    .map(([key, value]) => ` data-${key}="${escapeAttr(value)}"`)
    .join("");
}

/**
 * Escape attribute value
 */
function escapeAttr(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
