/**
 * Configuration Loader
 *
 * Loads configuration files from the project root for various tools:
 * - Prettier (.prettierrc, prettier.config.js, etc.)
 * - ESLint (.eslintrc, eslint.config.js, etc.)
 * - EditorConfig (.editorconfig)
 * - TypeScript (tsconfig.json)
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

// ============================================================================
// Types
// ============================================================================

/**
 * Prettier configuration options
 */
export interface PrettierConfig {
  printWidth?: number;
  tabWidth?: number;
  useTabs?: boolean;
  semi?: boolean;
  singleQuote?: boolean;
  quoteProps?: "as-needed" | "consistent" | "preserve";
  jsxSingleQuote?: boolean;
  trailingComma?: "none" | "es5" | "all";
  bracketSpacing?: boolean;
  bracketSameLine?: boolean;
  arrowParens?: "always" | "avoid";
  proseWrap?: "always" | "never" | "preserve";
  htmlWhitespaceSensitivity?: "css" | "strict" | "ignore";
  endOfLine?: "lf" | "crlf" | "cr" | "auto";
  [key: string]: unknown;
}

/**
 * ESLint configuration (legacy or flat config reference)
 */
export interface ESLintConfig {
  /** Path to the config file */
  configPath?: string;
  /** Whether this is a flat config (eslint.config.js) */
  isFlatConfig?: boolean;
  /** Raw config object (for legacy configs) */
  config?: Record<string, unknown>;
}

/**
 * EditorConfig section for a file pattern
 */
export interface EditorConfigSection {
  indent_style?: "tab" | "space";
  indent_size?: number | "tab";
  tab_width?: number;
  end_of_line?: "lf" | "crlf" | "cr";
  charset?: string;
  trim_trailing_whitespace?: boolean;
  insert_final_newline?: boolean;
  max_line_length?: number | "off";
}

/**
 * EditorConfig with sections
 */
export interface EditorConfig {
  root?: boolean;
  sections: Map<string, EditorConfigSection>;
}

/**
 * TypeScript compiler options subset
 */
export interface TSConfig {
  compilerOptions?: {
    target?: string;
    module?: string;
    moduleResolution?: string;
    strict?: boolean;
    esModuleInterop?: boolean;
    skipLibCheck?: boolean;
    [key: string]: unknown;
  };
  include?: string[];
  exclude?: string[];
  [key: string]: unknown;
}

/**
 * Combined tool configuration
 */
export interface ToolConfig {
  prettier?: PrettierConfig;
  eslint?: ESLintConfig;
  editorconfig?: EditorConfig;
  typescript?: TSConfig;
  /** Project root where configs were loaded from */
  projectRoot: string;
}

/**
 * Formatter options for a specific language
 */
export interface FormatterOptions {
  parser: string;
  tabWidth: number;
  useTabs: boolean;
  printWidth: number;
  semi: boolean;
  singleQuote: boolean;
  trailingComma: "none" | "es5" | "all";
  [key: string]: unknown;
}

/**
 * Linter options for a specific language
 */
export interface LinterOptions {
  configPath?: string;
  isFlatConfig: boolean;
  extensions: string[];
}

// ============================================================================
// Config File Detection
// ============================================================================

/** Prettier config file names in order of precedence */
const PRETTIER_CONFIG_FILES = [
  "prettier.config.js",
  "prettier.config.mjs",
  "prettier.config.cjs",
  ".prettierrc",
  ".prettierrc.json",
  ".prettierrc.yaml",
  ".prettierrc.yml",
  ".prettierrc.js",
  ".prettierrc.mjs",
  ".prettierrc.cjs",
];

/** ESLint config file names in order of precedence */
const ESLINT_CONFIG_FILES = [
  "eslint.config.js", // Flat config (ESLint 9+)
  "eslint.config.mjs",
  "eslint.config.cjs",
  ".eslintrc.js",
  ".eslintrc.cjs",
  ".eslintrc.yaml",
  ".eslintrc.yml",
  ".eslintrc.json",
  ".eslintrc",
];

/** Flat config file patterns */
const FLAT_CONFIG_PATTERNS = [
  "eslint.config.js",
  "eslint.config.mjs",
  "eslint.config.cjs",
];

// ============================================================================
// Config Loading
// ============================================================================

/** Cache for loaded configs */
const configCache = new Map<string, ToolConfig>();

/**
 * Load all tool configurations from project root
 *
 * @param projectRoot - Project root directory
 * @param useCache - Whether to use cached config (default: true)
 * @returns Combined tool configuration
 */
export async function loadToolConfig(
  projectRoot: string,
  useCache = true
): Promise<ToolConfig> {
  const cacheKey = path.resolve(projectRoot);

  if (useCache && configCache.has(cacheKey)) {
    return configCache.get(cacheKey)!;
  }

  const config: ToolConfig = {
    projectRoot: cacheKey,
  };

  // Load configs in parallel
  const [prettier, eslint, editorconfig, typescript] = await Promise.all([
    loadPrettierConfig(projectRoot),
    loadESLintConfig(projectRoot),
    loadEditorConfig(projectRoot),
    loadTSConfig(projectRoot),
  ]);

  if (prettier) config.prettier = prettier;
  if (eslint) config.eslint = eslint;
  if (editorconfig) config.editorconfig = editorconfig;
  if (typescript) config.typescript = typescript;

  configCache.set(cacheKey, config);
  return config;
}

/**
 * Clear the config cache
 */
export function clearConfigCache(): void {
  configCache.clear();
}

/**
 * Invalidate cache for a specific project
 */
export function invalidateToolConfigCache(projectRoot: string): void {
  const cacheKey = path.resolve(projectRoot);
  configCache.delete(cacheKey);
}

/**
 * @deprecated Use invalidateToolConfigCache instead
 */
export const clearToolConfigCache = clearConfigCache;

// ============================================================================
// Prettier Config Loading
// ============================================================================

/**
 * Load Prettier configuration from project
 */
async function loadPrettierConfig(
  projectRoot: string
): Promise<PrettierConfig | undefined> {
  // First, check package.json for "prettier" key
  const packageJsonPath = path.join(projectRoot, "package.json");
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
      if (packageJson.prettier) {
        return packageJson.prettier as PrettierConfig;
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Search for config files
  for (const configFile of PRETTIER_CONFIG_FILES) {
    const configPath = path.join(projectRoot, configFile);
    if (!fs.existsSync(configPath)) continue;

    try {
      if (configFile.endsWith(".json") || configFile === ".prettierrc") {
        const content = fs.readFileSync(configPath, "utf-8");
        return JSON.parse(content) as PrettierConfig;
      }

      if (configFile.endsWith(".yaml") || configFile.endsWith(".yml")) {
        // Simple YAML parsing for common cases
        const content = fs.readFileSync(configPath, "utf-8");
        return parseSimpleYaml(content) as PrettierConfig;
      }

      if (
        configFile.endsWith(".js") ||
        configFile.endsWith(".mjs") ||
        configFile.endsWith(".cjs")
      ) {
        const configUrl = pathToFileURL(configPath).href;
        const module = await import(configUrl);
        return (module.default || module) as PrettierConfig;
      }
    } catch (error) {
      console.warn(
        `[config-loader] Failed to load ${configFile}:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  return undefined;
}

// ============================================================================
// ESLint Config Loading
// ============================================================================

/**
 * Load ESLint configuration from project
 */
async function loadESLintConfig(
  projectRoot: string
): Promise<ESLintConfig | undefined> {
  for (const configFile of ESLINT_CONFIG_FILES) {
    const configPath = path.join(projectRoot, configFile);
    if (!fs.existsSync(configPath)) continue;

    const isFlatConfig = FLAT_CONFIG_PATTERNS.some((pattern) =>
      configFile.includes(pattern.replace("eslint.config", ""))
    );

    // For ESLint, we primarily just need to know the config path
    // The ESLint API will load the config itself
    return {
      configPath,
      isFlatConfig: FLAT_CONFIG_PATTERNS.includes(configFile),
    };
  }

  // Check package.json for eslintConfig
  const packageJsonPath = path.join(projectRoot, "package.json");
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
      if (packageJson.eslintConfig) {
        return {
          config: packageJson.eslintConfig,
          isFlatConfig: false,
        };
      }
    } catch {
      // Ignore parse errors
    }
  }

  return undefined;
}

// ============================================================================
// EditorConfig Loading
// ============================================================================

/**
 * Load EditorConfig from project
 */
async function loadEditorConfig(
  projectRoot: string
): Promise<EditorConfig | undefined> {
  const configPath = path.join(projectRoot, ".editorconfig");
  if (!fs.existsSync(configPath)) {
    return undefined;
  }

  try {
    const content = fs.readFileSync(configPath, "utf-8");
    return parseEditorConfig(content);
  } catch (error) {
    console.warn(
      `[config-loader] Failed to load .editorconfig:`,
      error instanceof Error ? error.message : error
    );
    return undefined;
  }
}

/**
 * Parse EditorConfig file content
 */
function parseEditorConfig(content: string): EditorConfig {
  const result: EditorConfig = {
    sections: new Map(),
  };

  let currentSection = "*"; // Default section
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith(";")) {
      continue;
    }

    // Section header
    const sectionMatch = trimmed.match(/^\[(.+)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      if (!result.sections.has(currentSection)) {
        result.sections.set(currentSection, {});
      }
      continue;
    }

    // Key-value pair
    const kvMatch = trimmed.match(/^([^=]+)=(.*)$/);
    if (kvMatch) {
      const key = kvMatch[1].trim().toLowerCase().replace(/-/g, "_");
      const value = kvMatch[2].trim().toLowerCase();

      if (key === "root" && currentSection === "*") {
        result.root = value === "true";
        continue;
      }

      if (!result.sections.has(currentSection)) {
        result.sections.set(currentSection, {});
      }
      const section = result.sections.get(currentSection)!;

      // Parse known keys
      switch (key) {
        case "indent_style":
          section.indent_style = value as "tab" | "space";
          break;
        case "indent_size":
          section.indent_size = value === "tab" ? "tab" : parseInt(value, 10);
          break;
        case "tab_width":
          section.tab_width = parseInt(value, 10);
          break;
        case "end_of_line":
          section.end_of_line = value as "lf" | "crlf" | "cr";
          break;
        case "charset":
          section.charset = value;
          break;
        case "trim_trailing_whitespace":
          section.trim_trailing_whitespace = value === "true";
          break;
        case "insert_final_newline":
          section.insert_final_newline = value === "true";
          break;
        case "max_line_length":
          section.max_line_length =
            value === "off" ? "off" : parseInt(value, 10);
          break;
      }
    }
  }

  return result;
}

// ============================================================================
// TypeScript Config Loading
// ============================================================================

/**
 * Load TypeScript configuration from project
 */
async function loadTSConfig(
  projectRoot: string
): Promise<TSConfig | undefined> {
  const configPath = path.join(projectRoot, "tsconfig.json");
  if (!fs.existsSync(configPath)) {
    return undefined;
  }

  try {
    const content = fs.readFileSync(configPath, "utf-8");
    // Remove comments from JSON (TypeScript allows them)
    // Be careful not to remove // inside strings
    const jsonContent = stripJsonComments(content);
    return JSON.parse(jsonContent) as TSConfig;
  } catch (error) {
    console.warn(
      `[config-loader] Failed to load tsconfig.json:`,
      error instanceof Error ? error.message : error
    );
    return undefined;
  }
}

/**
 * Strip comments from JSON content (for tsconfig.json)
 * Handles both line comments and block comments while preserving strings
 */
function stripJsonComments(content: string): string {
  let result = "";
  let i = 0;
  let inString = false;
  let stringChar = "";

  while (i < content.length) {
    const char = content[i];
    const nextChar = content[i + 1];

    // Handle string boundaries
    if ((char === '"' || char === "'") && (i === 0 || content[i - 1] !== "\\")) {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
      }
      result += char;
      i++;
      continue;
    }

    // Skip comments only when not in a string
    if (!inString) {
      // Block comment /* */
      if (char === "/" && nextChar === "*") {
        const endIndex = content.indexOf("*/", i + 2);
        if (endIndex !== -1) {
          i = endIndex + 2;
          continue;
        }
      }

      // Line comment //
      if (char === "/" && nextChar === "/") {
        const endIndex = content.indexOf("\n", i);
        if (endIndex !== -1) {
          i = endIndex;
          continue;
        } else {
          break; // Comment goes to end of file
        }
      }
    }

    result += char;
    i++;
  }

  return result;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Simple YAML parser for basic key-value configs
 * Only handles flat structures (no nested objects or arrays)
 */
function parseSimpleYaml(content: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^([^:]+):\s*(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value: unknown = match[2].trim();

      // Parse value types
      if (value === "true") value = true;
      else if (value === "false") value = false;
      else if (value === "null") value = null;
      else if (/^\d+$/.test(value as string)) value = parseInt(value as string, 10);
      else if (/^\d+\.\d+$/.test(value as string))
        value = parseFloat(value as string);
      // Remove quotes from strings
      else if (
        (value as string).startsWith('"') &&
        (value as string).endsWith('"')
      ) {
        value = (value as string).slice(1, -1);
      } else if (
        (value as string).startsWith("'") &&
        (value as string).endsWith("'")
      ) {
        value = (value as string).slice(1, -1);
      }

      result[key] = value;
    }
  }

  return result;
}

/** Language to Prettier parser mapping */
const LANGUAGE_PARSER_MAP: Record<string, string> = {
  typescript: "typescript",
  ts: "typescript",
  tsx: "typescript",
  javascript: "babel",
  js: "babel",
  jsx: "babel",
  json: "json",
  json5: "json5",
  css: "css",
  scss: "scss",
  less: "less",
  html: "html",
  vue: "vue",
  yaml: "yaml",
  yml: "yaml",
  markdown: "markdown",
  md: "markdown",
  graphql: "graphql",
  gql: "graphql",
};

/** Language to file extension mapping */
const LANGUAGE_EXTENSION_MAP: Record<string, string> = {
  typescript: "ts",
  ts: "ts",
  tsx: "tsx",
  javascript: "js",
  js: "js",
  jsx: "jsx",
  json: "json",
  css: "css",
  scss: "scss",
  less: "less",
  html: "html",
  yaml: "yaml",
  yml: "yaml",
  markdown: "md",
  md: "md",
};

/**
 * Get the Prettier parser for a language
 */
export function getParserForLanguage(language: string): string | undefined {
  return LANGUAGE_PARSER_MAP[language.toLowerCase()];
}

/**
 * Get the file extension for a language
 */
export function getExtensionForLanguage(language: string): string {
  return LANGUAGE_EXTENSION_MAP[language.toLowerCase()] || language;
}

/**
 * Check if a language is supported for formatting
 */
export function isFormattableLanguage(language: string): boolean {
  return language.toLowerCase() in LANGUAGE_PARSER_MAP;
}

/**
 * Check if a language is JavaScript/TypeScript (lintable)
 */
export function isLintableLanguage(language: string): boolean {
  const lang = language.toLowerCase();
  return ["typescript", "ts", "tsx", "javascript", "js", "jsx"].includes(lang);
}

/**
 * Get formatter options for a specific language
 * Merges Prettier config with EditorConfig overrides
 */
export function getFormatterOptions(
  config: ToolConfig,
  language: string,
  filePath?: string
): FormatterOptions | undefined {
  const parser = getParserForLanguage(language);
  if (!parser) return undefined;

  // Start with defaults
  const options: FormatterOptions = {
    parser,
    tabWidth: 2,
    useTabs: false,
    printWidth: 80,
    semi: true,
    singleQuote: false,
    trailingComma: "es5",
  };

  // Apply Prettier config
  if (config.prettier) {
    Object.assign(options, config.prettier);
  }

  // Apply EditorConfig overrides
  if (config.editorconfig && filePath) {
    const editorOptions = getEditorConfigForFile(config.editorconfig, filePath);
    if (editorOptions) {
      if (editorOptions.indent_style === "tab") {
        options.useTabs = true;
      } else if (editorOptions.indent_style === "space") {
        options.useTabs = false;
      }

      if (typeof editorOptions.indent_size === "number") {
        options.tabWidth = editorOptions.indent_size;
      }

      if (typeof editorOptions.max_line_length === "number") {
        options.printWidth = editorOptions.max_line_length;
      }
    }
  }

  return options;
}

/**
 * Get EditorConfig options for a specific file
 */
function getEditorConfigForFile(
  config: EditorConfig,
  filePath: string
): EditorConfigSection | undefined {
  const filename = path.basename(filePath);
  const ext = path.extname(filePath);

  // Try to match sections (simplified glob matching)
  for (const [pattern, section] of config.sections) {
    if (pattern === "*") {
      return section;
    }
    if (pattern === `*${ext}` || pattern === `*.${ext.slice(1)}`) {
      return section;
    }
    if (pattern.includes(filename)) {
      return section;
    }
  }

  // Fall back to default section
  return config.sections.get("*");
}

/**
 * Get linter options for a specific language
 */
export function getLinterOptions(
  config: ToolConfig,
  language: string
): LinterOptions | undefined {
  if (!isLintableLanguage(language)) {
    return undefined;
  }

  return {
    configPath: config.eslint?.configPath,
    isFlatConfig: config.eslint?.isFlatConfig ?? false,
    extensions: [getExtensionForLanguage(language)],
  };
}
