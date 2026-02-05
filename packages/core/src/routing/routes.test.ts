import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  resolveRoutes,
  routeToOutputPath,
  findRoute,
  getChildRoutes,
  getRoutesAtDepth,
  buildRouteTree,
} from "./routes.ts";

describe("File-Based Routing", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "routing-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true });
  });

  function createFile(relativePath: string, content = ""): void {
    const fullPath = path.join(tempDir, relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
  }

  describe("resolveRoutes", () => {
    it("should return empty array for non-existent directory", () => {
      const routes = resolveRoutes("/non/existent/path");
      expect(routes).toEqual([]);
    });

    it("should resolve root index.org to /", () => {
      createFile("index.org");
      const routes = resolveRoutes(tempDir);

      expect(routes).toHaveLength(1);
      expect(routes[0].path).toBe("/");
      expect(routes[0].file).toBe("index.org");
      expect(routes[0].isIndex).toBe(true);
      expect(routes[0].depth).toBe(0);
      expect(routes[0].parent).toBeNull();
    });

    it("should resolve page.org to /page", () => {
      createFile("about.org");
      const routes = resolveRoutes(tempDir);

      expect(routes).toHaveLength(1);
      expect(routes[0].path).toBe("/about");
      expect(routes[0].file).toBe("about.org");
      expect(routes[0].isIndex).toBe(false);
    });

    it("should resolve nested directories", () => {
      createFile("guide/index.org");
      createFile("guide/intro.org");
      createFile("guide/advanced.org");
      const routes = resolveRoutes(tempDir);

      expect(routes).toHaveLength(3);

      const guideIndex = routes.find((r) => r.file === "guide/index.org");
      expect(guideIndex?.path).toBe("/guide");
      expect(guideIndex?.isIndex).toBe(true);
      expect(guideIndex?.depth).toBe(1);
      expect(guideIndex?.parent).toBe("/");

      const intro = routes.find((r) => r.file === "guide/intro.org");
      expect(intro?.path).toBe("/guide/intro");
      expect(intro?.isIndex).toBe(false);
      expect(intro?.parent).toBe("/guide");
    });

    it("should resolve deeply nested paths", () => {
      createFile("docs/api/v1/users.org");
      const routes = resolveRoutes(tempDir);

      expect(routes).toHaveLength(1);
      expect(routes[0].path).toBe("/docs/api/v1/users");
      expect(routes[0].depth).toBe(3);
      expect(routes[0].parent).toBe("/docs/api/v1");
    });

    it("should ignore node_modules by default", () => {
      createFile("node_modules/package/readme.org");
      createFile("content.org");
      const routes = resolveRoutes(tempDir);

      expect(routes).toHaveLength(1);
      expect(routes[0].file).toBe("content.org");
    });

    it("should ignore .git by default", () => {
      createFile(".git/config.org");
      createFile("content.org");
      const routes = resolveRoutes(tempDir);

      expect(routes).toHaveLength(1);
      expect(routes[0].file).toBe("content.org");
    });

    it("should sort routes by path", () => {
      createFile("zebra.org");
      createFile("alpha.org");
      createFile("beta.org");
      const routes = resolveRoutes(tempDir);

      expect(routes.map((r) => r.file)).toEqual([
        "alpha.org",
        "beta.org",
        "zebra.org",
      ]);
    });

    it("should only include .org files by default", () => {
      createFile("page.org");
      createFile("readme.md");
      createFile("script.js");
      const routes = resolveRoutes(tempDir);

      expect(routes).toHaveLength(1);
      expect(routes[0].file).toBe("page.org");
    });

    it("should include custom extensions", () => {
      createFile("page.org");
      createFile("readme.md");
      const routes = resolveRoutes(tempDir, {
        extensions: [".org", ".md"],
      });

      expect(routes).toHaveLength(2);
    });
  });

  describe("routeToOutputPath", () => {
    it("should convert / to index.html", () => {
      expect(routeToOutputPath("/")).toBe("index.html");
    });

    it("should convert /page to page/index.html with clean URLs", () => {
      expect(routeToOutputPath("/page", { cleanUrls: true })).toBe("page/index.html");
    });

    it("should convert /page to page.html without clean URLs", () => {
      expect(routeToOutputPath("/page", { cleanUrls: false })).toBe("page.html");
    });

    it("should handle nested paths with clean URLs", () => {
      expect(routeToOutputPath("/guide/intro", { cleanUrls: true })).toBe(
        "guide/intro/index.html"
      );
    });

    it("should handle nested paths without clean URLs", () => {
      expect(routeToOutputPath("/guide/intro", { cleanUrls: false })).toBe(
        "guide/intro.html"
      );
    });
  });

  describe("findRoute", () => {
    it("should find route by exact path", () => {
      createFile("index.org");
      createFile("about.org");
      const routes = resolveRoutes(tempDir);

      const route = findRoute(routes, "/about");
      expect(route?.file).toBe("about.org");
    });

    it("should find root route", () => {
      createFile("index.org");
      const routes = resolveRoutes(tempDir);

      const route = findRoute(routes, "/");
      expect(route?.file).toBe("index.org");
    });

    it("should return undefined for non-existent route", () => {
      createFile("index.org");
      const routes = resolveRoutes(tempDir);

      const route = findRoute(routes, "/missing");
      expect(route).toBeUndefined();
    });

    it("should normalize trailing slashes", () => {
      createFile("about.org");
      const routes = resolveRoutes(tempDir);

      const route = findRoute(routes, "/about/");
      expect(route?.file).toBe("about.org");
    });
  });

  describe("getChildRoutes", () => {
    it("should get direct children of root", () => {
      createFile("index.org");
      createFile("about.org");
      createFile("guide/index.org");
      createFile("guide/intro.org");
      const routes = resolveRoutes(tempDir);

      const children = getChildRoutes(routes, "/");
      expect(children.map((r) => r.path).sort()).toEqual(["/about", "/guide"]);
    });

    it("should get children of nested path", () => {
      createFile("guide/index.org");
      createFile("guide/intro.org");
      createFile("guide/advanced.org");
      const routes = resolveRoutes(tempDir);

      const children = getChildRoutes(routes, "/guide");
      expect(children.map((r) => r.path).sort()).toEqual([
        "/guide/advanced",
        "/guide/intro",
      ]);
    });

    it("should return empty array for path with no children", () => {
      createFile("about.org");
      const routes = resolveRoutes(tempDir);

      const children = getChildRoutes(routes, "/about");
      expect(children).toEqual([]);
    });
  });

  describe("getRoutesAtDepth", () => {
    it("should get routes at depth 0", () => {
      createFile("index.org");
      createFile("about.org");
      createFile("guide/intro.org");
      const routes = resolveRoutes(tempDir);

      const rootRoutes = getRoutesAtDepth(routes, 0);
      expect(rootRoutes.map((r) => r.path).sort()).toEqual(["/", "/about"]);
    });

    it("should get routes at depth 1", () => {
      createFile("index.org");
      createFile("guide/index.org");
      createFile("guide/intro.org");
      createFile("api/reference.org");
      const routes = resolveRoutes(tempDir);

      const depthOneRoutes = getRoutesAtDepth(routes, 1);
      expect(depthOneRoutes.map((r) => r.path).sort()).toEqual([
        "/api/reference",
        "/guide",
        "/guide/intro",
      ]);
    });
  });

  describe("buildRouteTree", () => {
    it("should build tree from flat routes", () => {
      createFile("index.org");
      createFile("guide/index.org");
      createFile("guide/intro.org");
      const routes = resolveRoutes(tempDir);

      const tree = buildRouteTree(routes);

      // Root has no parent, so "/" is at root level of tree
      // "/guide" has parent "/", so it's a child of root
      expect(tree).toHaveLength(1);

      const root = tree.find((n) => n.path === "/");
      expect(root).toBeDefined();
      expect(root?.children).toHaveLength(1); // /guide is child of /

      const guide = root?.children.find((n) => n.path === "/guide");
      expect(guide).toBeDefined();
      expect(guide?.children).toHaveLength(1);
      expect(guide?.children[0].path).toBe("/guide/intro");
    });

    it("should handle orphan routes", () => {
      // Create a nested route without parent index
      createFile("deep/nested/page.org");
      const routes = resolveRoutes(tempDir);

      const tree = buildRouteTree(routes);

      // Should be at root since parent doesn't exist
      expect(tree).toHaveLength(1);
      expect(tree[0].path).toBe("/deep/nested/page");
    });
  });
});
