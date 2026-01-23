/**
 * Default Configuration Values
 *
 * Central location for all org-press default configuration values.
 * Used by config loader and inline config to ensure consistency.
 */

import * as os from "node:os";
import type { OrgPressConfig } from "./types.ts";

/**
 * Default content directory
 *
 * Where org files are stored.
 * Can be a single file in zero-config mode.
 */
export const DEFAULT_CONTENT_DIR = "content";

/**
 * Default output directory
 *
 * Where built static files are placed.
 */
export const DEFAULT_OUT_DIR = "dist/static";

/**
 * Default base URL path
 *
 * Used for all asset and link URLs.
 */
export const DEFAULT_BASE = "/";

/**
 * Default cache directory
 *
 * Where intermediate build files are stored.
 */
export const DEFAULT_CACHE_DIR = "node_modules/.org-press-cache";

/**
 * Default theme entry path
 *
 * Path to the theme entry file.
 */
export const DEFAULT_THEME = ".org-press/themes/index.tsx";

/**
 * Default :use value for code blocks
 *
 * Used when block has no explicit :use parameter.
 */
export const DEFAULT_USE = "preview";

/**
 * Default :use values per language
 *
 * Empty by default - all languages use defaultUse.
 */
export const DEFAULT_LANGUAGE_DEFAULTS: Record<string, string> = {};

/**
 * Config file search paths
 *
 * Locations to look for config files, in order of precedence.
 */
export const CONFIG_FILE_PATHS = [
  ".org-press/config.ts",
  ".org-press/config.js",
  ".org-press/config.mjs",
] as const;

/**
 * Get default build concurrency
 *
 * Returns the number of CPUs, used for parallel page rendering.
 */
export function getDefaultBuildConcurrency(): number {
  return os.cpus().length;
}

/**
 * Get all default configuration values
 *
 * Returns a fully-populated config object with all defaults.
 * This is used as the baseline before user config is merged.
 */
export function getDefaultConfig(): OrgPressConfig {
  return {
    contentDir: DEFAULT_CONTENT_DIR,
    outDir: DEFAULT_OUT_DIR,
    base: DEFAULT_BASE,
    cacheDir: DEFAULT_CACHE_DIR,
    plugins: [],
    theme: DEFAULT_THEME,
    buildConcurrency: getDefaultBuildConcurrency(),
    uniorg: {},
    vite: {},
    defaultUse: DEFAULT_USE,
    languageDefaults: { ...DEFAULT_LANGUAGE_DEFAULTS },
  };
}

/**
 * Configuration for zero-config mode
 *
 * When running a single file without a config file, these
 * settings are used. The contentDir is set to the directory
 * containing the org file.
 */
export interface ZeroConfigOptions {
  /** The org file being served/built */
  orgFile: string;
  /** Optional output directory override */
  outDir?: string;
  /** Optional base URL override */
  base?: string;
}

/**
 * Get configuration for zero-config mode
 *
 * Used when running a single org file without a config file.
 * The content directory is set to the directory containing the file.
 *
 * @param options - Zero-config options
 * @returns Config suitable for single-file operation
 */
export function getZeroConfig(options: ZeroConfigOptions): OrgPressConfig {
  const defaults = getDefaultConfig();

  return {
    ...defaults,
    // In zero-config mode, use current directory as content dir
    contentDir: ".",
    outDir: options.outDir ?? "dist",
    base: options.base ?? "/",
  };
}

/**
 * Environment variable overrides
 *
 * These environment variables can override config values:
 * - ORGP_OUT_DIR - Override outDir
 * - ORGP_BASE - Override base
 * - ORGP_PORT - Override dev server port (handled in CLI)
 */
export function getEnvOverrides(): Partial<OrgPressConfig> {
  const overrides: Partial<OrgPressConfig> = {};

  if (process.env.ORGP_OUT_DIR) {
    overrides.outDir = process.env.ORGP_OUT_DIR;
  }

  if (process.env.ORGP_BASE) {
    overrides.base = process.env.ORGP_BASE;
  }

  return overrides;
}
