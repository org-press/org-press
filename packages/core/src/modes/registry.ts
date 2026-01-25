/**
 * Mode Registry
 *
 * Central registry for mode plugins. Provides registration, lookup,
 * and block-mode matching functionality.
 */

import type { ModePlugin, ModeContext } from './types';
import { warnUnhandledBlock } from './errors';
import { domMode } from './dom';

/**
 * Internal storage for registered modes
 */
const modes = new Map<string, ModePlugin>();

// Register built-in DOM mode
modes.set('dom', domMode);

/**
 * Check if a value is a React element
 *
 * Detects React elements by checking for the $$typeof symbol.
 * Handles both stable and transitional React element types.
 *
 * @param value - Value to check
 * @returns true if the value is a React element
 */
export function isReactElement(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return false;
  const obj = value as { $$typeof?: symbol };
  return (
    obj.$$typeof === Symbol.for('react.element') ||
    obj.$$typeof === Symbol.for('react.transitional.element')
  );
}

/**
 * Register a mode plugin
 *
 * @param mode - The mode plugin to register
 *
 * @example
 * ```typescript
 * import { useReact } from '@org-press/react';
 * registerMode(useReact());
 * ```
 */
export function registerMode(mode: ModePlugin): void {
  modes.set(mode.name, mode);
}

/**
 * Get a registered mode by name
 *
 * @param name - The mode name
 * @returns The mode plugin or undefined if not found
 */
export function getMode(name: string): ModePlugin | undefined {
  return modes.get(name);
}

/**
 * Check if a mode is registered
 *
 * @param name - The mode name
 * @returns true if the mode is registered
 */
export function hasMode(name: string): boolean {
  return modes.has(name);
}

/**
 * Context required for mode lookup
 */
export interface BlockContext {
  blockId: string;
  language: string;
  orgFilePath: string;
}

/**
 * Get the appropriate mode for a block
 *
 * Handles mode resolution with fallback to DOM mode and unhandled block detection.
 *
 * @param modeName - Explicit mode name from :use parameter (or undefined for default)
 * @param result - The block's execution result
 * @param ctx - Block context for error reporting
 * @returns The mode plugin to use (never undefined - falls back to DOM mode)
 *
 * @example
 * ```typescript
 * const mode = getModeForBlock('react', blockResult, {
 *   blockId: 'block-1',
 *   language: 'tsx',
 *   orgFilePath: '/path/to/file.org'
 * });
 * ```
 */
export function getModeForBlock(
  modeName: string | undefined,
  result: unknown,
  ctx: BlockContext
): ModePlugin {
  // Get DOM mode (must be registered)
  const domMode = modes.get('dom');
  if (!domMode) {
    throw new Error(
      '[org-press] DOM mode is not registered. This is a bug in org-press.'
    );
  }

  // Explicit mode requested
  if (modeName && modeName !== 'dom') {
    const mode = modes.get(modeName);
    if (mode) return mode;

    // Mode not registered - warn and fallback
    warnUnhandledBlock(ctx, modeName);
    return domMode;
  }

  // Default DOM mode - but check for React elements
  if (isReactElement(result) && !modes.has('react')) {
    warnUnhandledBlock(ctx, 'react');
  }

  return domMode;
}

/**
 * List all registered mode names
 *
 * @returns Array of registered mode names
 */
export function listModes(): string[] {
  return Array.from(modes.keys());
}

/**
 * Clear all registered modes (for testing)
 *
 * @internal
 */
export function clearModes(): void {
  modes.clear();
}
