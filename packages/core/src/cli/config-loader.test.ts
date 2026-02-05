/**
 * Tests for Configuration Loader
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  loadToolConfig,
  clearConfigCache,
  getParserForLanguage,
  getExtensionForLanguage,
  isFormattableLanguage,
  isLintableLanguage,
  getFormatterOptions,
  getLinterOptions,
} from "./config-loader.ts";

describe("Config Loader", () => {
  let tempDir: string;

  beforeEach(() => {
    clearConfigCache();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "config-loader-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe("loadToolConfig", () => {
    it("should return empty config when no config files exist", async () => {
      const config = await loadToolConfig(tempDir);

      expect(config.projectRoot).toBe(tempDir);
      expect(config.prettier).toBeUndefined();
      expect(config.eslint).toBeUndefined();
      expect(config.editorconfig).toBeUndefined();
      expect(config.typescript).toBeUndefined();
    });

    it("should load .prettierrc.json", async () => {
      fs.writeFileSync(
        path.join(tempDir, ".prettierrc.json"),
        JSON.stringify({
          semi: false,
          singleQuote: true,
          tabWidth: 4,
        })
      );

      const config = await loadToolConfig(tempDir);

      expect(config.prettier).toEqual({
        semi: false,
        singleQuote: true,
        tabWidth: 4,
      });
    });

    it("should load .prettierrc (JSON without extension)", async () => {
      fs.writeFileSync(
        path.join(tempDir, ".prettierrc"),
        JSON.stringify({
          printWidth: 100,
          trailingComma: "all",
        })
      );

      const config = await loadToolConfig(tempDir);

      expect(config.prettier).toEqual({
        printWidth: 100,
        trailingComma: "all",
      });
    });

    it("should load prettier config from package.json", async () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({
          name: "test-project",
          prettier: {
            semi: true,
            tabWidth: 2,
          },
        })
      );

      const config = await loadToolConfig(tempDir);

      expect(config.prettier).toEqual({
        semi: true,
        tabWidth: 2,
      });
    });

    it("should detect ESLint flat config", async () => {
      fs.writeFileSync(
        path.join(tempDir, "eslint.config.js"),
        "export default [];"
      );

      const config = await loadToolConfig(tempDir);

      expect(config.eslint).toBeDefined();
      expect(config.eslint?.isFlatConfig).toBe(true);
      expect(config.eslint?.configPath).toBe(
        path.join(tempDir, "eslint.config.js")
      );
    });

    it("should detect ESLint legacy config", async () => {
      fs.writeFileSync(
        path.join(tempDir, ".eslintrc.json"),
        JSON.stringify({ extends: "eslint:recommended" })
      );

      const config = await loadToolConfig(tempDir);

      expect(config.eslint).toBeDefined();
      expect(config.eslint?.isFlatConfig).toBe(false);
      expect(config.eslint?.configPath).toBe(
        path.join(tempDir, ".eslintrc.json")
      );
    });

    it("should load .editorconfig", async () => {
      fs.writeFileSync(
        path.join(tempDir, ".editorconfig"),
        `
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf

[*.md]
trim_trailing_whitespace = false
`
      );

      const config = await loadToolConfig(tempDir);

      expect(config.editorconfig).toBeDefined();
      expect(config.editorconfig?.root).toBe(true);
      expect(config.editorconfig?.sections.get("*")).toEqual({
        indent_style: "space",
        indent_size: 2,
        end_of_line: "lf",
      });
      expect(config.editorconfig?.sections.get("*.md")).toEqual({
        trim_trailing_whitespace: false,
      });
    });

    it("should load tsconfig.json", async () => {
      fs.writeFileSync(
        path.join(tempDir, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: {
            target: "ES2020",
            module: "ESNext",
            strict: true,
          },
          include: ["src/**/*"],
        })
      );

      const config = await loadToolConfig(tempDir);

      expect(config.typescript).toBeDefined();
      expect(config.typescript?.compilerOptions?.target).toBe("ES2020");
      expect(config.typescript?.compilerOptions?.strict).toBe(true);
      expect(config.typescript?.include).toEqual(["src/**/*"]);
    });

    it("should load tsconfig.json with comments", async () => {
      fs.writeFileSync(
        path.join(tempDir, "tsconfig.json"),
        `{
  // This is a comment
  "compilerOptions": {
    "target": "ES2020" /* inline comment */
  }
}`
      );

      const config = await loadToolConfig(tempDir);

      expect(config.typescript?.compilerOptions?.target).toBe("ES2020");
    });

    it("should cache loaded config", async () => {
      fs.writeFileSync(
        path.join(tempDir, ".prettierrc"),
        JSON.stringify({ semi: false })
      );

      const config1 = await loadToolConfig(tempDir);
      const config2 = await loadToolConfig(tempDir);

      expect(config1).toBe(config2); // Same reference
    });

    it("should bypass cache when useCache is false", async () => {
      fs.writeFileSync(
        path.join(tempDir, ".prettierrc"),
        JSON.stringify({ semi: false })
      );

      const config1 = await loadToolConfig(tempDir);

      // Modify the file
      fs.writeFileSync(
        path.join(tempDir, ".prettierrc"),
        JSON.stringify({ semi: true })
      );

      const config2 = await loadToolConfig(tempDir, false);

      expect(config1.prettier?.semi).toBe(false);
      expect(config2.prettier?.semi).toBe(true);
    });
  });

  describe("getParserForLanguage", () => {
    it("should return typescript parser for ts files", () => {
      expect(getParserForLanguage("typescript")).toBe("typescript");
      expect(getParserForLanguage("ts")).toBe("typescript");
      expect(getParserForLanguage("tsx")).toBe("typescript");
    });

    it("should return babel parser for js files", () => {
      expect(getParserForLanguage("javascript")).toBe("babel");
      expect(getParserForLanguage("js")).toBe("babel");
      expect(getParserForLanguage("jsx")).toBe("babel");
    });

    it("should return correct parser for other languages", () => {
      expect(getParserForLanguage("json")).toBe("json");
      expect(getParserForLanguage("css")).toBe("css");
      expect(getParserForLanguage("html")).toBe("html");
      expect(getParserForLanguage("yaml")).toBe("yaml");
      expect(getParserForLanguage("markdown")).toBe("markdown");
    });

    it("should return undefined for unknown languages", () => {
      expect(getParserForLanguage("unknown")).toBeUndefined();
      expect(getParserForLanguage("rust")).toBeUndefined();
    });

    it("should be case-insensitive", () => {
      expect(getParserForLanguage("TypeScript")).toBe("typescript");
      expect(getParserForLanguage("JAVASCRIPT")).toBe("babel");
    });
  });

  describe("getExtensionForLanguage", () => {
    it("should return correct extensions", () => {
      expect(getExtensionForLanguage("typescript")).toBe("ts");
      expect(getExtensionForLanguage("javascript")).toBe("js");
      expect(getExtensionForLanguage("tsx")).toBe("tsx");
      expect(getExtensionForLanguage("jsx")).toBe("jsx");
    });

    it("should return language name for unknown languages", () => {
      expect(getExtensionForLanguage("rust")).toBe("rust");
      expect(getExtensionForLanguage("python")).toBe("python");
    });
  });

  describe("isFormattableLanguage", () => {
    it("should return true for formattable languages", () => {
      expect(isFormattableLanguage("typescript")).toBe(true);
      expect(isFormattableLanguage("javascript")).toBe(true);
      expect(isFormattableLanguage("json")).toBe(true);
      expect(isFormattableLanguage("css")).toBe(true);
      expect(isFormattableLanguage("html")).toBe(true);
    });

    it("should return false for non-formattable languages", () => {
      expect(isFormattableLanguage("rust")).toBe(false);
      expect(isFormattableLanguage("python")).toBe(false);
      expect(isFormattableLanguage("unknown")).toBe(false);
    });
  });

  describe("isLintableLanguage", () => {
    it("should return true for JS/TS languages", () => {
      expect(isLintableLanguage("typescript")).toBe(true);
      expect(isLintableLanguage("ts")).toBe(true);
      expect(isLintableLanguage("tsx")).toBe(true);
      expect(isLintableLanguage("javascript")).toBe(true);
      expect(isLintableLanguage("js")).toBe(true);
      expect(isLintableLanguage("jsx")).toBe(true);
    });

    it("should return false for non-JS/TS languages", () => {
      expect(isLintableLanguage("json")).toBe(false);
      expect(isLintableLanguage("css")).toBe(false);
      expect(isLintableLanguage("html")).toBe(false);
    });
  });

  describe("getFormatterOptions", () => {
    it("should return options with defaults", async () => {
      const config = await loadToolConfig(tempDir);
      const options = getFormatterOptions(config, "typescript");

      expect(options).toBeDefined();
      expect(options?.parser).toBe("typescript");
      expect(options?.tabWidth).toBe(2);
      expect(options?.useTabs).toBe(false);
      expect(options?.semi).toBe(true);
    });

    it("should merge Prettier config", async () => {
      fs.writeFileSync(
        path.join(tempDir, ".prettierrc"),
        JSON.stringify({
          tabWidth: 4,
          semi: false,
          singleQuote: true,
        })
      );

      const config = await loadToolConfig(tempDir);
      const options = getFormatterOptions(config, "typescript");

      expect(options?.tabWidth).toBe(4);
      expect(options?.semi).toBe(false);
      expect(options?.singleQuote).toBe(true);
    });

    it("should return undefined for unknown language", async () => {
      const config = await loadToolConfig(tempDir);
      const options = getFormatterOptions(config, "rust");

      expect(options).toBeUndefined();
    });
  });

  describe("getLinterOptions", () => {
    it("should return options for lintable language", async () => {
      fs.writeFileSync(
        path.join(tempDir, "eslint.config.js"),
        "export default [];"
      );

      const config = await loadToolConfig(tempDir);
      const options = getLinterOptions(config, "typescript");

      expect(options).toBeDefined();
      expect(options?.isFlatConfig).toBe(true);
      expect(options?.configPath).toBe(path.join(tempDir, "eslint.config.js"));
    });

    it("should return undefined for non-lintable language", async () => {
      const config = await loadToolConfig(tempDir);
      const options = getLinterOptions(config, "json");

      expect(options).toBeUndefined();
    });
  });
});
