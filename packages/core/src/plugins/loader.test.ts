/**
 * Unit tests for plugin loader
 *
 * Tests plugin loading, matching, caching, and wrapper registration.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  loadPlugins,
  findMatchingPlugin,
  invalidatePluginCache,
  getCachedPlugins,
} from "./loader.ts";
import type { BlockPlugin, CodeBlock } from "./types.ts";
import type { OrgPressConfig } from "../config/types.ts";

describe("Plugin Loader", () => {
  beforeEach(() => {
    // Clear cache before each test
    invalidatePluginCache();
  });

  describe("loadPlugins", () => {
    it("should load plugins from config", async () => {
      const testPlugin: BlockPlugin = {
        name: "test",
        languages: ["test"],
        async transform(block) {
          return { code: block.value };
        },
      };

      const config: OrgPressConfig = {
        contentDir: "content",
        cacheDir: ".cache",
        outDir: "dist",
        base: "/",
        presets: [],
        plugins: [testPlugin],
      };

      const { plugins } = await loadPlugins(config);

      // Should include test plugin + built-in plugins
      expect(plugins.length).toBeGreaterThan(0);
      expect(plugins.some((p) => p.name === "test")).toBe(true);
    });

    it("should cache loaded plugins", async () => {
      const config: OrgPressConfig = {
        contentDir: "content",
        cacheDir: ".cache",
        outDir: "dist",
        base: "/",
        presets: [],
        plugins: [],
      };

      const result1 = await loadPlugins(config);
      const result2 = await loadPlugins(config);

      // Should return same instance (cached)
      expect(result1).toBe(result2);
    });

    it("should sort plugins by priority", async () => {
      const lowPriority: BlockPlugin = {
        name: "low",
        languages: ["low"],
        priority: 1,
        async transform(block) {
          return { code: block.value };
        },
      };

      const highPriority: BlockPlugin = {
        name: "high",
        languages: ["high"],
        priority: 10,
        async transform(block) {
          return { code: block.value };
        },
      };

      const config: OrgPressConfig = {
        contentDir: "content",
        cacheDir: ".cache",
        outDir: "dist",
        base: "/",
        presets: [],
        plugins: [lowPriority, highPriority],
      };

      const { plugins } = await loadPlugins(config);

      // Find indices of our test plugins
      const highIndex = plugins.findIndex((p) => p.name === "high");
      const lowIndex = plugins.findIndex((p) => p.name === "low");

      // High priority should come before low priority
      expect(highIndex).toBeLessThan(lowIndex);
    });

    it("should load plugins from presets", async () => {
      // Test with minimal preset which should have fewer plugins
      const config: OrgPressConfig = {
        contentDir: "content",
        cacheDir: ".cache",
        outDir: "dist",
        base: "/",
        presets: ["minimal"],
        plugins: [],
      };

      const { plugins } = await loadPlugins(config);

      // Should have loaded plugins from preset + built-ins
      expect(plugins.length).toBeGreaterThan(0);
    });

    it("should handle empty config", async () => {
      const config: OrgPressConfig = {
        contentDir: "content",
        cacheDir: ".cache",
        outDir: "dist",
        base: "/",
        presets: [],
        plugins: [],
      };

      const { plugins } = await loadPlugins(config);

      // Should at least have built-in plugins
      expect(plugins.length).toBeGreaterThan(0);
    });
  });

  describe("findMatchingPlugin", () => {
    const testPlugins: BlockPlugin[] = [
      {
        name: "custom-matcher",
        languages: [],
        matches: (block) => block.value.includes("CUSTOM"),
        async transform(block) {
          return { code: block.value };
        },
      },
      {
        name: "javascript",
        languages: ["javascript", "js"],
        async transform(block) {
          return { code: block.value };
        },
      },
      {
        name: "typescript",
        languages: ["typescript", "ts"],
        async transform(block) {
          return { code: block.value };
        },
      },
    ];

    it("should match by custom matcher function", () => {
      const block: CodeBlock = {
        language: "text",
        value: "This has CUSTOM marker",
        meta: null,
      };

      const plugin = findMatchingPlugin(testPlugins, block);
      expect(plugin?.name).toBe("custom-matcher");
    });

    it("should match by :use parameter", () => {
      const block: CodeBlock = {
        language: "text",
        value: "console.log('hello')",
        meta: ":use javascript",
      };

      const plugin = findMatchingPlugin(testPlugins, block);
      expect(plugin?.name).toBe("javascript");
    });

    it("should match by language", () => {
      const block: CodeBlock = {
        language: "javascript",
        value: "console.log('hello')",
        meta: null,
      };

      const plugin = findMatchingPlugin(testPlugins, block);
      expect(plugin?.name).toBe("javascript");
    });

    it("should match by language alias", () => {
      const block: CodeBlock = {
        language: "js",
        value: "console.log('hello')",
        meta: null,
      };

      const plugin = findMatchingPlugin(testPlugins, block);
      expect(plugin?.name).toBe("javascript");
    });

    it("should return null when no match", () => {
      const block: CodeBlock = {
        language: "unknown",
        value: "some code",
        meta: null,
      };

      const plugin = findMatchingPlugin(testPlugins, block);
      expect(plugin).toBeNull();
    });

    it("should prioritize custom matcher over :use", () => {
      const block: CodeBlock = {
        language: "text",
        value: "CUSTOM code",
        meta: ":use javascript",
      };

      const plugin = findMatchingPlugin(testPlugins, block);
      // Custom matcher should match first
      expect(plugin?.name).toBe("custom-matcher");
    });

    it("should prioritize :use over language", () => {
      const block: CodeBlock = {
        language: "typescript",
        value: "console.log('hello')",
        meta: ":use javascript",
      };

      const plugin = findMatchingPlugin(testPlugins, block);
      // :use should override language
      expect(plugin?.name).toBe("javascript");
    });

    it("should handle empty plugins array", () => {
      const block: CodeBlock = {
        language: "javascript",
        value: "console.log('hello')",
        meta: null,
      };

      const plugin = findMatchingPlugin([], block);
      expect(plugin).toBeNull();
    });

    it("should handle block with undefined meta", () => {
      const block: CodeBlock = {
        language: "javascript",
        value: "console.log('hello')",
        meta: undefined,
      };

      const plugin = findMatchingPlugin(testPlugins, block);
      expect(plugin?.name).toBe("javascript");
    });
  });

  describe("invalidatePluginCache", () => {
    it("should clear cached plugins", async () => {
      const config: OrgPressConfig = {
        contentDir: "content",
        cacheDir: ".cache",
        outDir: "dist",
        base: "/",
        presets: [],
        plugins: [],
      };

      // Load plugins (caches result)
      const result1 = await loadPlugins(config);
      expect(getCachedPlugins()).not.toBeNull();

      // Invalidate cache
      invalidatePluginCache();
      expect(getCachedPlugins()).toBeNull();

      // Next load should create new instance
      const result2 = await loadPlugins(config);
      expect(result2).not.toBe(result1);
    });

    it("should allow reloading with different config", async () => {
      const config1: OrgPressConfig = {
        contentDir: "content",
        cacheDir: ".cache",
        outDir: "dist",
        base: "/",
        presets: [],
        plugins: [],
      };

      await loadPlugins(config1);
      const cachedCount1 = getCachedPlugins()?.plugins.length ?? 0;

      invalidatePluginCache();

      const testPlugin: BlockPlugin = {
        name: "new-plugin",
        languages: ["test"],
        async transform(block) {
          return { code: block.value };
        },
      };

      const config2: OrgPressConfig = {
        ...config1,
        plugins: [testPlugin],
      };

      await loadPlugins(config2);
      const cachedCount2 = getCachedPlugins()?.plugins.length ?? 0;

      // Should have one more plugin
      expect(cachedCount2).toBe(cachedCount1 + 1);
    });
  });

  describe("getCachedPlugins", () => {
    it("should return null when no cache", () => {
      invalidatePluginCache();
      expect(getCachedPlugins()).toBeNull();
    });

    it("should return cached plugins after loading", async () => {
      const config: OrgPressConfig = {
        contentDir: "content",
        cacheDir: ".cache",
        outDir: "dist",
        base: "/",
        presets: [],
        plugins: [],
      };

      await loadPlugins(config);
      const cached = getCachedPlugins();

      expect(cached).not.toBeNull();
      expect(cached?.plugins).toBeDefined();
    });

    it("should return same instance as loadPlugins", async () => {
      const config: OrgPressConfig = {
        contentDir: "content",
        cacheDir: ".cache",
        outDir: "dist",
        base: "/",
        presets: [],
        plugins: [],
      };

      const loaded = await loadPlugins(config);
      const cached = getCachedPlugins();

      expect(cached).toBe(loaded);
    });
  });
});
