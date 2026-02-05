import type { UserConfig as ViteUserConfig } from "vite";
import type { OrgPressPlugin } from "../plugins/types.ts";

/**
 * User-facing org-press configuration
 *
 * Simplified from org-press v1:
 * - Single `plugins` array (no blockPlugins + virtualBlockPlugins split)
 * - New `presets` field for common plugin sets
 * - Simplified theme config
 * - No manual wrapper registration needed!
 */
export interface OrgPressUserConfig {
  /**
   * Content directory containing .org files
   * @default "content"
   */
  contentDir?: string;

  /**
   * Output directory for built site
   * @default "dist/static"
   */
  outDir?: string;

  /**
   * Base URL path for the site
   * @default "/"
   * @example "/org-press" for docs site
   */
  base?: string;

  /**
   * Cache directory for intermediate files
   * @default "node_modules/.org-press-cache"
   */
  cacheDir?: string;

  /**
   * Plugins to use (unified plugin system)
   *
   * All plugins use the same API - blocks, drawers, transformers, and commands
   * are all handled through a single plugin array.
   *
   * @example
   * import { defaultPlugins } from "org-press";
   *
   * export default {
   *   plugins: [...defaultPlugins],
   * };
   *
   * @example
   * // Cherry-pick plugins
   * import { domPlugin, cssPlugin, CreateDrawer } from "org-press";
   *
   * export default {
   *   plugins: [
   *     domPlugin,
   *     cssPlugin,
   *     CreateDrawer('NOTE', (d) => `<div class="note">${d.html}</div>`),
   *   ],
   * };
   */
  plugins?: OrgPressPlugin[];

  /**
   * Theme configuration
   * Can be a path to theme entry file, or a full theme config object
   * @default ".org-press/themes/index.tsx"
   */
  theme?: string | ThemeConfig;

  /**
   * Number of pages to build concurrently
   * @default os.cpus().length
   */
  buildConcurrency?: number;

  /**
   * Uniorg parser options
   * Advanced: customize org-mode parsing behavior
   */
  uniorg?: Record<string, any>;

  /**
   * Vite configuration overrides
   * Merged with org-press's default Vite config
   */
  vite?: ViteUserConfig;

  /**
   * Default :use value for code blocks without explicit :use
   * @default "preview"
   *
   * @example
   * // Use raw mode by default
   * export default {
   *   defaultUse: "raw"
   * };
   */
  defaultUse?: string;

  /**
   * Default :use values per language
   * Takes precedence over defaultUse for specified languages
   *
   * @example
   * export default {
   *   languageDefaults: {
   *     javascript: "preview | withSourceCode",
   *     css: "sourceOnly",
   *     shell: "silent"
   *   }
   * };
   */
  languageDefaults?: Record<string, string>;
}

/**
 * Resolved org-press configuration
 * All optional fields have been filled with defaults
 */
export interface OrgPressConfig {
  contentDir: string;
  outDir: string;
  base: string;
  cacheDir: string;
  plugins: OrgPressPlugin[];
  theme?: string | ThemeConfig;
  buildConcurrency: number;
  uniorg: Record<string, any>;
  vite: ViteUserConfig;
  defaultUse: string;
  languageDefaults: Record<string, string>;

  /** @internal Plugin context instance (set by vite-plugin-org-press) */
  _pluginContext?: unknown;
}

/**
 * Theme configuration
 */
export interface ThemeConfig {
  /**
   * Path to theme entry file
   * Should export layout components
   */
  entry: string;

  /**
   * Optional: explicit layout map
   * Overrides layouts exported from entry file
   */
  layouts?: LayoutMap;
}

/**
 * Map of layout names to React components
 */
export type LayoutMap = Record<string, React.ComponentType<LayoutProps>>;

/**
 * Props passed to layout components
 */
export interface LayoutProps {
  /** Rendered HTML content */
  children: React.ReactNode;

  /** Page metadata from org-mode keywords */
  metadata: PageMetadata;

  /** Base URL path */
  base: string;
}

/**
 * Page metadata extracted from org-mode file
 */
export interface PageMetadata {
  /** Page title (from #+TITLE:) */
  title?: string;

  /** Author (from #+AUTHOR:) */
  author?: string;

  /** Date (from #+DATE:) */
  date?: string;

  /** Layout name (from #+LAYOUT: or #+PROPERTY: layout) */
  layout?: string;

  /** Status (from #+STATUS: or #+STATE:) - draft/published */
  status?: string;

  /** Custom metadata (any other #+KEY: value pairs) */
  [key: string]: any;
}
