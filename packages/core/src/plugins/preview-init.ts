/**
 * Render API Initialization
 *
 * Registers all built-in wrappers and formats with the global registry.
 * This should be called once at application startup.
 *
 * Note: Modes (dom, sourceOnly, silent, raw) are now built-in plugins
 * and don't need to be registered separately.
 */

import { registerBuiltinWrappers } from "./preview-wrappers/index.ts";
import { registerFormatWrappers } from "./formats/index.ts";

let initialized = false;

/**
 * Initialize the Render API
 *
 * Registers all built-in wrappers and format handlers with the global
 * wrapper registry. Safe to call multiple times (only initializes once).
 *
 * Note: Modes (dom, sourceOnly, silent, raw) are now built-in plugins
 * included in `builtinPlugins` and don't need separate registration.
 *
 * Call this early in your application startup, typically in:
 * - Vite plugin setup
 * - CLI command initialization
 * - Test setup files
 *
 * @example
 * ```typescript
 * import { initializeRenderApi } from 'org-press';
 *
 * // In your application startup
 * initializeRenderApi();
 * ```
 */
export function initializeRenderApi(): void {
  if (initialized) {
    return;
  }

  // Register all built-in wrappers (withSourceCode, withContainer, etc.)
  registerBuiltinWrappers();

  // Register all format wrappers (json, yaml, csv, html)
  registerFormatWrappers();

  initialized = true;
}

/**
 * Reset initialization state (for testing)
 */
export function resetRenderApiInit(): void {
  initialized = false;
}

/**
 * Check if Render API is initialized
 */
export function isRenderApiInitialized(): boolean {
  return initialized;
}
