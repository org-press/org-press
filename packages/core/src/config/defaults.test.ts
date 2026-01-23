import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  DEFAULT_CONTENT_DIR,
  DEFAULT_OUT_DIR,
  DEFAULT_BASE,
  DEFAULT_CACHE_DIR,
  DEFAULT_THEME,
  CONFIG_FILE_PATHS,
  getDefaultConfig,
  getZeroConfig,
  getEnvOverrides,
  getDefaultBuildConcurrency,
} from "./defaults.ts";

describe("Config Defaults", () => {
  describe("constants", () => {
    it("should have correct default content dir", () => {
      expect(DEFAULT_CONTENT_DIR).toBe("content");
    });

    it("should have correct default output dir", () => {
      expect(DEFAULT_OUT_DIR).toBe("dist/static");
    });

    it("should have correct default base", () => {
      expect(DEFAULT_BASE).toBe("/");
    });

    it("should have correct default cache dir", () => {
      expect(DEFAULT_CACHE_DIR).toBe("node_modules/.org-press-cache");
    });

    it("should have correct default theme", () => {
      expect(DEFAULT_THEME).toBe(".org-press/themes/index.tsx");
    });

    it("should have correct config file paths", () => {
      expect(CONFIG_FILE_PATHS).toEqual([
        ".org-press/config.ts",
        ".org-press/config.js",
        ".org-press/config.mjs",
      ]);
    });
  });

  describe("getDefaultBuildConcurrency", () => {
    it("should return a positive number", () => {
      const concurrency = getDefaultBuildConcurrency();
      expect(concurrency).toBeGreaterThan(0);
      expect(Number.isInteger(concurrency)).toBe(true);
    });
  });

  describe("getDefaultConfig", () => {
    it("should return all default values", () => {
      const config = getDefaultConfig();

      expect(config.contentDir).toBe(DEFAULT_CONTENT_DIR);
      expect(config.outDir).toBe(DEFAULT_OUT_DIR);
      expect(config.base).toBe(DEFAULT_BASE);
      expect(config.cacheDir).toBe(DEFAULT_CACHE_DIR);
      expect(config.theme).toBe(DEFAULT_THEME);
      expect(config.plugins).toEqual([]);
      expect(config.uniorg).toEqual({});
      expect(config.vite).toEqual({});
      expect(config.buildConcurrency).toBe(getDefaultBuildConcurrency());
    });
  });

  describe("getZeroConfig", () => {
    it("should use current directory as content dir", () => {
      const config = getZeroConfig({ orgFile: "./test.org" });

      expect(config.contentDir).toBe(".");
      expect(config.outDir).toBe("dist");
      expect(config.base).toBe("/");
    });

    it("should allow outDir override", () => {
      const config = getZeroConfig({
        orgFile: "./test.org",
        outDir: "build",
      });

      expect(config.outDir).toBe("build");
    });

    it("should allow base override", () => {
      const config = getZeroConfig({
        orgFile: "./test.org",
        base: "/docs/",
      });

      expect(config.base).toBe("/docs/");
    });
  });

  describe("getEnvOverrides", () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
      // Reset env vars
      delete process.env.ORGP_OUT_DIR;
      delete process.env.ORGP_BASE;
    });

    afterEach(() => {
      // Restore original env
      process.env = { ...originalEnv };
    });

    it("should return empty object when no env vars set", () => {
      const overrides = getEnvOverrides();
      expect(overrides).toEqual({});
    });

    it("should include ORGP_OUT_DIR when set", () => {
      process.env.ORGP_OUT_DIR = "custom-dist";
      const overrides = getEnvOverrides();

      expect(overrides.outDir).toBe("custom-dist");
    });

    it("should include ORGP_BASE when set", () => {
      process.env.ORGP_BASE = "/custom/";
      const overrides = getEnvOverrides();

      expect(overrides.base).toBe("/custom/");
    });

    it("should include both when both set", () => {
      process.env.ORGP_OUT_DIR = "custom-dist";
      process.env.ORGP_BASE = "/custom/";
      const overrides = getEnvOverrides();

      expect(overrides.outDir).toBe("custom-dist");
      expect(overrides.base).toBe("/custom/");
    });
  });
});
