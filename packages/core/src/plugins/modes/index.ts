/**
 * Built-in Modes
 *
 * Modes are the first segment in a :use pipe that determine the base rendering behavior.
 * Unlike wrappers which transform RenderFunction, modes create the initial RenderFunction.
 *
 * @example
 * :use dom                - Execute block, render with render function
 * :use sourceOnly         - Show source code, don't execute
 * :use silent             - Execute block but render nothing (side effects only)
 * :use raw                - Execute and output result directly
 */

export { sourceOnlyMode } from "./source-only.ts";
export type { SourceOnlyModeConfig } from "./source-only.ts";
export { silentMode } from "./silent.ts";
export type { SilentModeConfig } from "./silent.ts";
export { rawMode } from "./raw.ts";
export type { RawModeConfig } from "./raw.ts";

// Re-export types
export type { Mode, ModeFactory } from "./types.ts";

import { sourceOnlyMode } from "./source-only.ts";
import { silentMode } from "./silent.ts";
import { rawMode } from "./raw.ts";
import { registerWrapper, type WrapperFactory } from "../wrapper-compose.ts";

/**
 * Map of all built-in modes
 *
 * Modes can be used as the first segment of a :use pipe.
 * They are technically WrapperFactories but serve a different purpose:
 * - Wrappers transform a RenderFunction
 * - Modes create the base RenderFunction (they ignore the input and return their own)
 */
export const builtinModes = {
  sourceOnly: sourceOnlyMode,
  silent: silentMode,
  raw: rawMode,
} as const;

/**
 * Register all built-in modes with the global wrapper registry
 *
 * Modes are registered as wrappers because they share the same WrapperFactory interface.
 * The difference is semantic: modes create base behavior, wrappers transform it.
 */
export function registerBuiltinModes(): void {
  // Modes are WrapperFactories that ignore their input and return a new RenderFunction
  registerWrapper("sourceOnly", sourceOnlyMode as WrapperFactory);
  registerWrapper("silent", silentMode as WrapperFactory);
  registerWrapper("raw", rawMode as WrapperFactory);
}

/**
 * Check if a name is a built-in mode
 */
export function isMode(name: string): boolean {
  return name in builtinModes;
}
