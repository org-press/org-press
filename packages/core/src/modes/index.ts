/**
 * Mode Plugin System
 *
 * Provides a pluggable architecture for rendering code blocks.
 * The default mode is DOM, with React and other modes available as external packages.
 *
 * @example
 * ```typescript
 * // In org-press config
 * import { defineConfig } from 'org-press';
 * import { useReact } from '@org-press/react';
 *
 * export default defineConfig({
 *   modes: [useReact()]
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Using the registry
 * import { registerMode, getMode, getModeForBlock } from 'org-press';
 *
 * const mode = getModeForBlock('react', blockResult, ctx);
 * const html = await mode.onServerRender(result, ctx);
 * ```
 */

// Types
export type {
  ModePlugin,
  ModeContext,
  ClientModeContext,
  RenderFunction,
} from './types';

// Registry
export {
  registerMode,
  getMode,
  hasMode,
  getModeForBlock,
  listModes,
  isReactElement,
  clearModes,
} from './registry';

export type { BlockContext } from './registry';

// Errors
export { renderUnhandledError, warnUnhandledBlock } from './errors';

export type { ErrorContext, SuggestedMode } from './errors';

// DOM Mode (built-in)
export { domMode } from './dom';
