import type { OrgPressConfig as PluginOrgPressConfig, OrgPressPlugin } from "./types.ts";
import type { OrgPressConfig as CoreOrgPressConfig } from "../config/types.ts";
import { PluginRegistry } from "./registry.ts";
import type { PluginContextImpl } from "./context.ts";

/**
 * Global key used to store the plugin context on globalThis.
 *
 * Using globalThis instead of a module-level variable ensures that the
 * singleton survives across dual-module boundaries (e.g. dist vs source
 * modules loaded by Vite SSR in dev mode).
 */
const GLOBAL_KEY = "__org_press_plugin_context__" as const;

/**
 * Initialize the plugin context singleton.
 *
 * Creates a PluginRegistry, registers all plugins from config,
 * and stores the resulting context. Each call replaces the previous context.
 *
 * Accepts either config type (core or plugin) for caller convenience.
 */
export async function initPluginContext(
  config: CoreOrgPressConfig | PluginOrgPressConfig,
  projectRoot?: string
): Promise<PluginContextImpl> {
  const plugins = (config as any).plugins ?? [];
  const registry = new PluginRegistry(config as PluginOrgPressConfig, projectRoot ?? process.cwd());
  await registry.register(plugins as OrgPressPlugin[]);
  (globalThis as any)[GLOBAL_KEY] = registry.getContext();
  return (globalThis as any)[GLOBAL_KEY];
}

/** Get the current plugin context, or undefined if not yet initialized. */
export function getPluginContext(): PluginContextImpl | undefined {
  return (globalThis as any)[GLOBAL_KEY] ?? undefined;
}

/** Reset the singleton (for testing). */
export function resetPluginContext(): void {
  delete (globalThis as any)[GLOBAL_KEY];
}
