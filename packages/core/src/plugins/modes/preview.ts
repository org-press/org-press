/**
 * Preview Mode
 *
 * Default mode that executes the block and renders with Preview function.
 * If the block exports a Preview function, it's used to render the result.
 * Otherwise, a default preview is applied.
 */

import type { PreviewFn, PreviewResult, BlockContext } from "../preview.ts";
import { defaultPreview } from "../preview.ts";

export interface PreviewModeConfig {
  /** If true, use default preview even if block has Preview export */
  forceDefault?: boolean;
}

/**
 * Preview mode factory
 *
 * This is the default mode for block rendering. It:
 * 1. Executes the block code
 * 2. If block exports a Preview function, uses it to render the result
 * 3. Otherwise, applies a default preview
 *
 * @example
 * ```org
 * #+begin_src typescript :use preview
 * const value = 42;
 * export const Preview = (result) => `<strong>${result}</strong>`;
 * export default value;
 * #+end_src
 * ```
 *
 * @example
 * // Force default preview even if block has one
 * :use preview?forceDefault
 */
export const previewMode = (config?: Record<string, unknown>) => {
  const { forceDefault = false } = (config ?? {}) as PreviewModeConfig;

  // Return a wrapper that ignores the input preview and uses block's Preview
  return (_inputPreview: PreviewFn): PreviewFn => {
    return (result: unknown, ctx: BlockContext): PreviewResult => {
      // Check if context has the block's Preview function
      // (this would be added by the exporter when loading the block's module)
      const blockPreview = getBlockPreview(ctx);

      if (blockPreview && !forceDefault) {
        return blockPreview(result, ctx);
      }

      // Fall back to default preview
      return defaultPreview(result, ctx);
    };
  };
};

/**
 * Extract the Preview function from the context if available
 *
 * The exporter attaches the block's Preview export to the context
 * when the block module is loaded.
 */
function getBlockPreview(ctx: BlockContext): PreviewFn | undefined {
  // The preview would be attached to the context by the exporter
  // when processing a block with `export const Preview`
  const extendedCtx = ctx as BlockContext & { preview?: PreviewFn };
  return extendedCtx.preview;
}
