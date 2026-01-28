/**
 * Layout System Tests
 *
 * Tests for theme/layout loading functionality.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as path from "node:path";
import * as fs from "node:fs";
import { loadLayout, loadDefaultLayout, clearLayoutCache } from "./index.ts";

describe("Layout System", () => {
  const testDir = path.join(process.cwd(), ".test-layouts");

  beforeEach(() => {
    // Clear layout cache before each test
    clearLayoutCache();
    // Create test directory
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Cleanup test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    clearLayoutCache();
  });

  describe("loadLayout", () => {
    it("should fall back to default layout when theme file does not exist", async () => {
      // This tests the fix for Issue 6
      // When a custom theme file doesn't exist, it should silently fall back
      // to the default layout instead of throwing an error

      const nonExistentTheme = ".org-press/themes/index.tsx";

      // Should not throw, should return default layout
      const layout = await loadLayout(nonExistentTheme);

      expect(layout).toBeDefined();
      expect(typeof layout).toBe("function");
    });

    it("should not log error when theme file does not exist", async () => {
      const consoleSpy = vi.spyOn(console, "warn");

      const nonExistentTheme = ".org-press/themes/nonexistent.tsx";
      await loadLayout(nonExistentTheme);

      // Should NOT log a warning when file doesn't exist
      // (only log when file exists but has no valid exports)
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("Failed to load theme")
      );

      consoleSpy.mockRestore();
    });

    it("should load theme from file path when it exists", async () => {
      // Create a test theme file
      const themeContent = `
export default function Layout({ children }) {
  return children;
}
`;
      const themePath = path.join(testDir, "theme.tsx");
      fs.writeFileSync(themePath, themeContent);

      // Use relative path from cwd
      const relativePath = path.relative(process.cwd(), themePath);
      const layout = await loadLayout(relativePath);

      expect(layout).toBeDefined();
      expect(typeof layout).toBe("function");
    });
  });

  describe("loadDefaultLayout", () => {
    it("should return a layout component", async () => {
      const layout = await loadDefaultLayout();

      expect(layout).toBeDefined();
      expect(typeof layout).toBe("function");
    });

    it("should cache the default layout", async () => {
      const layout1 = await loadDefaultLayout();
      const layout2 = await loadDefaultLayout();

      // Should be the same instance due to caching
      expect(layout1).toBe(layout2);
    });
  });

  describe("clearLayoutCache", () => {
    it("should clear all cached layouts", async () => {
      // Load a layout to populate cache
      await loadDefaultLayout();

      // Clear cache
      clearLayoutCache();

      // The function should work without throwing
      // (no direct way to verify cache is empty, but loading again should work)
      const layout = await loadDefaultLayout();
      expect(layout).toBeDefined();
    });
  });
});
