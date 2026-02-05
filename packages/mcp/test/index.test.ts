/**
 * Tests for @org-press/mcp
 */

import { describe, it, expect } from "vitest";
import { createOrgPressMcpServer, orgPressTools, orgPressResources } from "../src/index.js";

describe("@org-press/mcp", () => {
  describe("createOrgPressMcpServer", () => {
    it("creates a server with default options", () => {
      const server = createOrgPressMcpServer();
      expect(server).toBeDefined();
    });

    it("creates a server with custom options", () => {
      const server = createOrgPressMcpServer({
        projectRoot: "/tmp/test",
        contentDir: "docs",
      });
      expect(server).toBeDefined();
    });
  });

  describe("tool definitions", () => {
    it("exports test tool definition", () => {
      expect(orgPressTools.test.name).toBe("org_test");
      expect(orgPressTools.test.description).toContain("tests");
    });

    it("exports fmt tool definition", () => {
      expect(orgPressTools.fmt.name).toBe("org_fmt");
      expect(orgPressTools.fmt.description).toContain("Format");
    });

    it("exports lint tool definition", () => {
      expect(orgPressTools.lint.name).toBe("org_lint");
      expect(orgPressTools.lint.description).toContain("Lint");
    });

    it("exports typeCheck tool definition", () => {
      expect(orgPressTools.typeCheck.name).toBe("org_type_check");
      expect(orgPressTools.typeCheck.description).toContain("Type-check");
    });

    it("exports build tool definition", () => {
      expect(orgPressTools.build.name).toBe("org_build");
      expect(orgPressTools.build.description).toContain("Build");
    });
  });

  describe("resource definitions", () => {
    it("exports blocks resource definition", () => {
      expect(orgPressResources.blocks.uri).toBe("org-press://blocks");
      expect(orgPressResources.blocks.mimeType).toBe("application/json");
    });

    it("exports config resource definition", () => {
      expect(orgPressResources.config.uri).toBe("org-press://config");
      expect(orgPressResources.config.mimeType).toBe("application/json");
    });
  });
});
