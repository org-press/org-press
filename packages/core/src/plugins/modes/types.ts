/**
 * Mode Types
 *
 * Modes define the base rendering behavior for a block.
 * They are used as the first segment in a :use pipe.
 */

import type { RenderFunction, BlockContext, RenderResult } from "../preview.ts";

/**
 * A Mode is a function that creates a base RenderFunction.
 *
 * Unlike wrappers which transform a RenderFunction, modes create the initial one.
 * When used as the first segment of a pipe, the input render function is ignored.
 */
export type Mode = (result: unknown, ctx: BlockContext) => RenderResult;

/**
 * A ModeFactory creates a Mode with configuration.
 *
 * ModeFactories have the same signature as WrapperFactories,
 * but they ignore the input RenderFunction and create their own behavior.
 */
export type ModeFactory = (config?: Record<string, unknown>) => (render: RenderFunction) => RenderFunction;

/**
 * Extended BlockContext that includes the block's render export
 */
export interface ModeBlockContext extends BlockContext {
  /** The render function exported by the block (if any) */
  render?: RenderFunction;
}
