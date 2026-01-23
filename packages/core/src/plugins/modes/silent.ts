/**
 * Silent Mode
 *
 * Executes the block but produces no visible output.
 * Useful for blocks that set up state, register handlers, or have side effects.
 */

import type { PreviewFn, PreviewResult, BlockContext } from "../preview.ts";

export interface SilentModeConfig {
  /** If true, show a placeholder comment in dev mode */
  showDevPlaceholder?: boolean;

  /** Custom placeholder text for dev mode */
  devPlaceholder?: string;
}

/**
 * Silent mode factory
 *
 * This mode executes the block but renders nothing (returns null).
 * The block code still runs and its exports are still available.
 *
 * @example
 * ```org
 * #+begin_src typescript :use silent
 * // This code runs but produces no output
 * window.addEventListener('scroll', () => {
 *   console.log('scrolled');
 * });
 * #+end_src
 * ```
 *
 * @example
 * // Show placeholder in development
 * :use silent?showDevPlaceholder
 */
export const silentMode = (config?: Record<string, unknown>) => {
  const {
    showDevPlaceholder = false,
    devPlaceholder = "<!-- silent block: {name} -->",
  } = (config ?? {}) as SilentModeConfig;

  // Return a wrapper that returns null (no visible output)
  return (_inputPreview: PreviewFn): PreviewFn => {
    return (_result: unknown, ctx: BlockContext): PreviewResult => {
      // In dev mode with placeholder enabled, show a comment
      if (showDevPlaceholder && ctx.runtime.isDev) {
        const placeholder = devPlaceholder
          .replace("{name}", ctx.block.name ?? `block-${ctx.block.index}`)
          .replace("{language}", ctx.block.language)
          .replace("{index}", String(ctx.block.index));

        return placeholder;
      }

      // Normal mode: no output
      return null;
    };
  };
};
