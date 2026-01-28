/**
 * Config Loader
 *
 * Loads configuration files for Prettier, ESLint, and TypeScript
 * from the project root.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import type { Options as PrettierOptions } from "prettier";

/**
 * Load Prettier configuration from the project root
 *
 * Searches for:
 * - .prettierrc
 * - .prettierrc.json
 * - .prettierrc.js
 * - .prettierrc.cjs
 * - .prettierrc.mjs
 * - prettier.config.js
 * - prettier.config.cjs
 * - prettier.config.mjs
 *
 * @param projectRoot - Project root directory
 * @returns Prettier options or empty object if not found
 */
export async function loadPrettierConfig(
  projectRoot: string
): Promise<PrettierOptions> {
  const configFiles = [
    ".prettierrc",
    ".prettierrc.json",
    ".prettierrc.js",
    ".prettierrc.cjs",
    ".prettierrc.mjs",
    "prettier.config.js",
    "prettier.config.cjs",
    "prettier.config.mjs",
  ];

  for (const configFile of configFiles) {
    const configPath = path.join(projectRoot, configFile);

    if (!fs.existsSync(configPath)) {
      continue;
    }

    try {
      if (configFile.endsWith(".json") || configFile === ".prettierrc") {
        const content = fs.readFileSync(configPath, "utf-8");
        return JSON.parse(content) as PrettierOptions;
      }

      if (
        configFile.endsWith(".js") ||
        configFile.endsWith(".cjs") ||
        configFile.endsWith(".mjs")
      ) {
        const configUrl = pathToFileURL(configPath).href;
        const module = await import(configUrl);
        return (module.default || module) as PrettierOptions;
      }
    } catch (error) {
      console.warn(
        `[tools] Warning: Failed to load ${configFile}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  // Return default options if no config found
  return {};
}

/**
 * TypeScript compiler options
 */
export interface TsConfig {
  compilerOptions?: Record<string, unknown>;
  include?: string[];
  exclude?: string[];
  files?: string[];
}

/**
 * Load TypeScript configuration from the project root
 *
 * @param projectRoot - Project root directory
 * @returns TypeScript compiler options
 */
export async function loadTsConfig(projectRoot: string): Promise<TsConfig> {
  const configPath = path.join(projectRoot, "tsconfig.json");

  if (!fs.existsSync(configPath)) {
    // Return minimal default config
    return {
      compilerOptions: {
        target: "ES2020",
        module: "ESNext",
        moduleResolution: "bundler",
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        noEmit: true,
      },
    };
  }

  try {
    const content = fs.readFileSync(configPath, "utf-8");
    // Remove comments from JSON (TypeScript allows comments in tsconfig.json)
    const jsonContent = content.replace(
      /\/\*[\s\S]*?\*\/|\/\/.*/g,
      ""
    );
    return JSON.parse(jsonContent) as TsConfig;
  } catch (error) {
    console.warn(
      `[tools] Warning: Failed to load tsconfig.json: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return {
      compilerOptions: {
        target: "ES2020",
        module: "ESNext",
        moduleResolution: "bundler",
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        noEmit: true,
      },
    };
  }
}

/**
 * Check if ESLint flat config exists
 *
 * @param projectRoot - Project root directory
 * @returns Path to ESLint config if found, null otherwise
 */
export function findEslintConfig(projectRoot: string): string | null {
  const configFiles = [
    "eslint.config.js",
    "eslint.config.mjs",
    "eslint.config.cjs",
    // Legacy configs
    ".eslintrc.js",
    ".eslintrc.cjs",
    ".eslintrc.json",
    ".eslintrc",
  ];

  for (const configFile of configFiles) {
    const configPath = path.join(projectRoot, configFile);
    if (fs.existsSync(configPath)) {
      return configPath;
    }
  }

  return null;
}
