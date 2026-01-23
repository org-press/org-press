/**
 * Mode Types
 *
 * Modes define the base rendering behavior for a block.
 * They are used as the first segment in a :use pipe.
 */

import type { PreviewFn, BlockContext, PreviewResult } from "../preview.ts";

/**
 * A Mode is a function that creates a base PreviewFn.
 *
 * Unlike wrappers which transform a PreviewFn, modes create the initial one.
 * When used as the first segment of a pipe, the input preview is ignored.
 */
export type Mode = (result: unknown, ctx: BlockContext) => PreviewResult;

/**
 * A ModeFactory creates a Mode with configuration.
 *
 * ModeFactories have the same signature as WrapperFactories,
 * but they ignore the input PreviewFn and create their own behavior.
 */
export type ModeFactory = (config?: Record<string, unknown>) => (preview: PreviewFn) => PreviewFn;

/**
 * Extended BlockContext that includes the block's Preview export
 */
export interface ModeBlockContext extends BlockContext {
  /** The Preview function exported by the block (if any) */
  preview?: PreviewFn;
}
