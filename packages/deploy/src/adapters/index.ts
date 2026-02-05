/**
 * Adapter Registry
 *
 * Registry for deploy adapters. Built-in adapters are registered by default.
 * External adapters can be registered at runtime.
 */

import type { DeployAdapter } from "../types.ts";
import { NpmAdapter } from "./npm.ts";

// Export adapters
export { NpmAdapter, npmAdapter, type NpmAdapterOptions } from "./npm.ts";

/**
 * Registry of available adapters
 */
const adapters = new Map<string, DeployAdapter>();

/**
 * Register a deploy adapter
 *
 * @param adapter - The adapter to register
 * @throws If an adapter with the same name is already registered
 */
export function registerAdapter(adapter: DeployAdapter): void {
  if (adapters.has(adapter.name)) {
    throw new Error(`Adapter '${adapter.name}' is already registered`);
  }
  adapters.set(adapter.name, adapter);
}

/**
 * Get an adapter by name
 *
 * @param name - Adapter name
 * @returns The adapter or undefined if not found
 */
export function getAdapter(name: string): DeployAdapter | undefined {
  return adapters.get(name);
}

/**
 * Get all registered adapter names
 *
 * @returns Array of adapter names
 */
export function getAdapterNames(): string[] {
  return Array.from(adapters.keys());
}

/**
 * Check if an adapter is registered
 *
 * @param name - Adapter name
 * @returns True if registered
 */
export function hasAdapter(name: string): boolean {
  return adapters.has(name);
}

/**
 * Unregister an adapter
 *
 * @param name - Adapter name
 * @returns True if the adapter was unregistered
 */
export function unregisterAdapter(name: string): boolean {
  return adapters.delete(name);
}

/**
 * Clear all registered adapters
 *
 * Mainly useful for testing.
 */
export function clearAdapters(): void {
  adapters.clear();
}

/**
 * Initialize built-in adapters
 *
 * Registers the npm adapter by default.
 */
export function initBuiltinAdapters(): void {
  if (!adapters.has("npm")) {
    registerAdapter(new NpmAdapter());
  }
}

// Initialize built-in adapters on module load
initBuiltinAdapters();
