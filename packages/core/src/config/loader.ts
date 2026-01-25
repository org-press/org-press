import { createServer } from "vite";
import * as fs from "node:fs";
import * as path from "node:path";
import type { OrgPressConfig, OrgPressUserConfig } from "./types.ts";
import {
  getDefaultConfig,
  getZeroConfig,
  getEnvOverrides,
  CONFIG_FILE_PATHS,
  type ZeroConfigOptions,
} from "./defaults.ts";
import { extractInlineConfig, mergeInlineConfig } from "./inline.ts";

/**
 * Configuration loader for org-press
 *
 * Handles:
 * - Loading .ts/.js/.mjs config files
 * - Resolving defaults
 * - Caching for performance
 * - Cache invalidation for HMR
 */

/**
 * Cached config with modification time
 */
interface ConfigCache {
  config: OrgPressConfig;
  mtime: number;
  path: string;
}

// Global config cache
let cachedConfig: ConfigCache | null = null;

/**
 * Load and resolve org-press configuration
 *
 * Loads config file using temporary Vite server (supports .ts files),
 * resolves defaults, and caches the result.
 *
 * @param configPath - Path to config file (e.g., ".org-press/config.ts")
 * @param options - Loading options
 * @param options.reload - Force reload even if cached
 * @returns Resolved configuration with all defaults applied
 *
 * @example
 * const config = await loadConfig(".org-press/config.ts");
 * console.log(config.contentDir); // "content" (default or user value)
 *
 * // Force reload
 * const freshConfig = await loadConfig(".org-press/config.ts", { reload: true });
 */
export async function loadConfig(
  configPath: string,
  options: { reload?: boolean } = {}
): Promise<OrgPressConfig> {
  // Check cache
  if (!options.reload && cachedConfig && cachedConfig.path === configPath) {
    try {
      const stats = await fs.promises.stat(configPath);

      if (stats.mtimeMs === cachedConfig.mtime) {
        return cachedConfig.config;
      }
    } catch (error) {
      // File might not exist or be inaccessible, continue to load
    }
  }

  // Load config file using temporary Vite server
  // This allows us to handle .ts files with imports
  const tempServer = await createServer({
    configFile: false,
    logLevel: "error",
    clearScreen: false,
  });

  try {
    // Load the config module
    const loaded = await tempServer.ssrLoadModule(configPath);

    // Extract config (supports both default export and named export)
    let userConfig: OrgPressUserConfig | (() => OrgPressUserConfig) =
      loaded.default || loaded.config || loaded;

    // If config is a function, call it
    if (typeof userConfig === "function") {
      userConfig = await userConfig();
    }

    // Resolve config with defaults
    const resolved = await resolveConfig(userConfig);

    // Cache the result
    try {
      const stats = await fs.promises.stat(configPath);
      cachedConfig = {
        config: resolved,
        mtime: stats.mtimeMs,
        path: configPath,
      };
    } catch (error) {
      // If we can't stat the file, cache without mtime check
      cachedConfig = {
        config: resolved,
        mtime: Date.now(),
        path: configPath,
      };
    }

    return resolved;
  } finally {
    // Always close the temp server
    await tempServer.close();
  }
}

/**
 * Resolve user config with defaults
 *
 * Takes partial user config and fills in all required fields with sensible defaults.
 * Also applies environment variable overrides.
 *
 * @param userConfig - User-provided config (may be partial)
 * @returns Fully resolved config with all fields defined
 *
 * @example
 * const resolved = await resolveConfig({
 *   contentDir: "docs",
 *   // Other fields will use defaults
 * });
 */
export async function resolveConfig(
  userConfig: OrgPressUserConfig
): Promise<OrgPressConfig> {
  // Start with defaults
  const defaults = getDefaultConfig();

  // Merge user config
  const merged: OrgPressConfig = {
    contentDir: userConfig.contentDir ?? defaults.contentDir,
    outDir: userConfig.outDir ?? defaults.outDir,
    base: userConfig.base ?? defaults.base,
    cacheDir: userConfig.cacheDir ?? defaults.cacheDir,
    plugins: userConfig.plugins ?? defaults.plugins,
    theme: userConfig.theme ?? defaults.theme,
    buildConcurrency: userConfig.buildConcurrency ?? defaults.buildConcurrency,
    uniorg: userConfig.uniorg ?? defaults.uniorg,
    vite: userConfig.vite ?? defaults.vite,
    defaultUse: userConfig.defaultUse ?? defaults.defaultUse,
    languageDefaults: userConfig.languageDefaults
      ? { ...defaults.languageDefaults, ...userConfig.languageDefaults }
      : defaults.languageDefaults,
  };

  // Apply environment variable overrides
  const envOverrides = getEnvOverrides();

  return {
    ...merged,
    ...envOverrides,
  };
}

/**
 * Resolve config for zero-config mode (single file)
 *
 * Used when running a single org file without a config file.
 *
 * @param options - Zero-config options including the org file path
 * @returns Resolved config for single-file operation
 */
export async function resolveZeroConfig(
  options: ZeroConfigOptions
): Promise<OrgPressConfig> {
  const zeroConfig = getZeroConfig(options);

  // Apply environment variable overrides
  const envOverrides = getEnvOverrides();

  return {
    ...zeroConfig,
    ...envOverrides,
  };
}

/**
 * Load config from an org file's inline config block
 *
 * Extracts configuration from #+NAME: config blocks within org files.
 *
 * @param orgFilePath - Path to the org file
 * @returns Resolved config or null if no inline config found
 */
export async function loadInlineConfig(
  orgFilePath: string
): Promise<OrgPressConfig | null> {
  const resolvedPath = path.isAbsolute(orgFilePath)
    ? orgFilePath
    : path.resolve(process.cwd(), orgFilePath);

  if (!fs.existsSync(resolvedPath)) {
    return null;
  }

  const content = fs.readFileSync(resolvedPath, "utf-8");
  const inlineResult = extractInlineConfig(content);

  if (!inlineResult) {
    return null;
  }

  // Merge inline config with defaults
  const defaults = getDefaultConfig();
  const merged = mergeInlineConfig(defaults, inlineResult.config as Partial<OrgPressConfig>);

  // Set contentDir to the file's directory for single-file mode
  merged.contentDir = path.dirname(resolvedPath);

  // Apply environment variable overrides
  const envOverrides = getEnvOverrides();

  return {
    ...merged,
    ...envOverrides,
  };
}

/**
 * Invalidate config cache
 *
 * Call this when:
 * - Config file changes (HMR)
 * - Tests need fresh config
 * - Manual cache clearing needed
 *
 * Next call to loadConfig() will reload from disk
 *
 * @example
 * // In HMR handler
 * if (file.endsWith("config.ts")) {
 *   invalidateConfigCache();
 *   const newConfig = await loadConfig(file);
 * }
 */
export function invalidateConfigCache(): void {
  cachedConfig = null;
}

/**
 * Get currently cached config without loading
 *
 * Useful for debugging or tools that need to inspect loaded config
 *
 * @returns Currently cached config or null if not loaded
 */
export function getCachedConfig(): ConfigCache | null {
  return cachedConfig;
}

/**
 * Find config file in standard locations
 *
 * Searches for config files in order:
 * 1. .org-press/config.ts
 * 2. .org-press/config.js
 * 3. .org-press/config.mjs
 *
 * @param cwd - Current working directory (defaults to process.cwd())
 * @returns Path to config file or null if not found
 *
 * @example
 * const configPath = await findConfigFile();
 * if (configPath) {
 *   const config = await loadConfig(configPath);
 * }
 */
export async function findConfigFile(cwd: string = process.cwd()): Promise<string | null> {
  for (const candidate of CONFIG_FILE_PATHS) {
    const fullPath = `${cwd}/${candidate}`;
    try {
      await fs.promises.access(fullPath);
      return fullPath;
    } catch {
      // File doesn't exist, try next candidate
    }
  }

  return null;
}
