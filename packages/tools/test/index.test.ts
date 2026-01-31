/**
 * Tests for @org-press/tools
 */

import { describe, it, expect } from "vitest";
import {
  fmtPlugin,
  lintPlugin,
  typeCheckPlugin,
  allPlugins,
  PRETTIER_PARSERS,
  LINT_LANGUAGES,
  TYPECHECK_LANGUAGES,
} from "../src/index.js";

describe("@org-press/tools", () => {
  describe("plugin exports", () => {
    it("exports fmtPlugin with correct structure", () => {
      expect(fmtPlugin.name).toBe("fmt");
      expect(fmtPlugin.defaultExtension).toBe("js");
      expect(fmtPlugin.cli).toBeDefined();
      expect(fmtPlugin.cli?.command).toBe("fmt");
      expect(typeof fmtPlugin.cli?.execute).toBe("function");
    });

    it("exports lintPlugin with correct structure", () => {
      expect(lintPlugin.name).toBe("lint");
      expect(lintPlugin.defaultExtension).toBe("js");
      expect(lintPlugin.cli).toBeDefined();
      expect(lintPlugin.cli?.command).toBe("lint");
      expect(typeof lintPlugin.cli?.execute).toBe("function");
    });

    it("exports typeCheckPlugin with correct structure", () => {
      expect(typeCheckPlugin.name).toBe("type-check");
      expect(typeCheckPlugin.defaultExtension).toBe("ts");
      expect(typeCheckPlugin.cli).toBeDefined();
      expect(typeCheckPlugin.cli?.command).toBe("type-check");
      expect(typeof typeCheckPlugin.cli?.execute).toBe("function");
    });

    it("exports allPlugins array with all 3 plugins", () => {
      expect(allPlugins).toHaveLength(3);
      expect(allPlugins).toContain(fmtPlugin);
      expect(allPlugins).toContain(lintPlugin);
      expect(allPlugins).toContain(typeCheckPlugin);
    });
  });

  describe("type exports", () => {
    it("PRETTIER_PARSERS includes common languages", () => {
      expect(PRETTIER_PARSERS.typescript).toBe("typescript");
      expect(PRETTIER_PARSERS.ts).toBe("typescript");
      expect(PRETTIER_PARSERS.javascript).toBe("babel");
      expect(PRETTIER_PARSERS.js).toBe("babel");
      expect(PRETTIER_PARSERS.json).toBe("json");
      expect(PRETTIER_PARSERS.css).toBe("css");
    });

    it("LINT_LANGUAGES includes JS/TS languages", () => {
      expect(LINT_LANGUAGES).toContain("typescript");
      expect(LINT_LANGUAGES).toContain("ts");
      expect(LINT_LANGUAGES).toContain("tsx");
      expect(LINT_LANGUAGES).toContain("javascript");
      expect(LINT_LANGUAGES).toContain("js");
      expect(LINT_LANGUAGES).toContain("jsx");
    });

    it("TYPECHECK_LANGUAGES includes TypeScript languages", () => {
      expect(TYPECHECK_LANGUAGES).toContain("typescript");
      expect(TYPECHECK_LANGUAGES).toContain("ts");
      expect(TYPECHECK_LANGUAGES).toContain("tsx");
    });
  });
});
