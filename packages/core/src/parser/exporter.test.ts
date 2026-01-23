import { describe, it, expect } from "vitest";
import { processCodeBlocks } from "./exporter.ts";
import { parseOrgContent } from "./parse-content.ts";
import { cssPlugin } from "../plugins/builtin/css.ts";
import { javascriptPlugin } from "../plugins/builtin/javascript.ts";
import { parse } from "uniorg-parse/lib/parser.js";
import type { OrgData } from "uniorg";

/**
 * Helper to find export-block nodes in AST and extract their HTML content
 */
function findExportBlockValues(ast: any): string[] {
  const values: string[] = [];

  function walk(node: any) {
    if (!node) return;
    if (node.type === "export-block" && node.backend === "html") {
      values.push(node.value);
    }
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        walk(child);
      }
    }
  }

  walk(ast);
  return values;
}

describe("exporter", () => {
  describe("CSS block handling", () => {
    it("should render CSS blocks as style tags, not script imports", async () => {
      const orgContent = `#+TITLE: Test

#+begin_src css
.test-class { color: red; }
#+end_src
`;

      const ast = parse(orgContent) as OrgData;
      const context = {
        orgFilePath: "content/test.org",
        plugins: [cssPlugin],
        config: {
          contentDir: "content",
          outDir: "dist",
          base: "/",
        } as any,
        cacheDir: "/tmp/cache",
        base: "/",
        contentDir: "content",
        outDir: "dist",
      };

      const { modifiedAst } = await processCodeBlocks(ast, context);
      const exportBlocks = findExportBlockValues(modifiedAst);

      // Should have one export block with a style tag
      expect(exportBlocks.length).toBeGreaterThan(0);
      const htmlContent = exportBlocks.join("");

      // CSS should be rendered as a style tag, not a script import
      expect(htmlContent).toContain("<style");
      expect(htmlContent).toContain("data-org-block=");
      expect(htmlContent).toContain(".test-class { color: red; }");

      // Should NOT contain virtual module imports for CSS
      expect(htmlContent).not.toContain("virtual:org-press:block:css:");
      expect(htmlContent).not.toContain('import * as module from');
    });

    it("should still render JavaScript blocks as script imports", async () => {
      const orgContent = `#+TITLE: Test

#+begin_src javascript
console.log("hello");
#+end_src
`;

      const ast = parse(orgContent) as OrgData;
      const context = {
        orgFilePath: "content/test.org",
        plugins: [javascriptPlugin],
        config: {
          contentDir: "content",
          outDir: "dist",
          base: "/",
        } as any,
        cacheDir: "/tmp/cache",
        base: "/",
        contentDir: "content",
        outDir: "dist",
      };

      const { modifiedAst } = await processCodeBlocks(ast, context);
      const exportBlocks = findExportBlockValues(modifiedAst);

      expect(exportBlocks.length).toBeGreaterThan(0);
      const htmlContent = exportBlocks.join("");

      // JavaScript blocks should render as container divs with data-org-block attribute
      // No inline scripts - hydration is handled by a separate hydrate.js script
      expect(htmlContent).toContain('data-org-block="');
      expect(htmlContent).toContain('class="org-block-result"');
      // Should NOT contain inline script imports (these are now handled by hydration)
      expect(htmlContent).not.toContain('<script type="module">');
      expect(htmlContent).not.toContain("virtual:org-press:block:");
    });

    it("should include CSS content directly in style tag", async () => {
      const cssCode = `.fancy-button {
  background: linear-gradient(45deg, #ff6b6b, #feca57);
  border-radius: 8px;
  padding: 12px 24px;
}`;
      const orgContent = `#+TITLE: Test

#+begin_src css
${cssCode}
#+end_src
`;

      const ast = parse(orgContent) as OrgData;
      const context = {
        orgFilePath: "content/test.org",
        plugins: [cssPlugin],
        config: {
          contentDir: "content",
          outDir: "dist",
          base: "/",
        } as any,
        cacheDir: "/tmp/cache",
        base: "/",
        contentDir: "content",
        outDir: "dist",
      };

      const { modifiedAst } = await processCodeBlocks(ast, context);
      const exportBlocks = findExportBlockValues(modifiedAst);
      const htmlContent = exportBlocks.join("");

      // The actual CSS content should be inline in the style tag
      expect(htmlContent).toContain(".fancy-button");
      expect(htmlContent).toContain("linear-gradient");
      expect(htmlContent).toContain("border-radius: 8px");
    });
  });

  describe("plugin defaultExtension handling", () => {
    it("should use style tag for plugins with css defaultExtension", async () => {
      const orgContent = `#+TITLE: Test

#+begin_src css
body { margin: 0; }
#+end_src
`;

      // cssPlugin has defaultExtension: "css"
      expect(cssPlugin.defaultExtension).toBe("css");

      const ast = parse(orgContent) as OrgData;
      const context = {
        orgFilePath: "content/test.org",
        plugins: [cssPlugin],
        config: {
          contentDir: "content",
          outDir: "dist",
          base: "/",
        } as any,
        cacheDir: "/tmp/cache",
        base: "/",
        contentDir: "content",
        outDir: "dist",
      };

      const { modifiedAst } = await processCodeBlocks(ast, context);
      const exportBlocks = findExportBlockValues(modifiedAst);
      const htmlContent = exportBlocks.join("");

      expect(htmlContent).toContain("<style");
      expect(htmlContent).not.toContain('<script type="module">');
    });

    it("should use data-org-block for plugins with js defaultExtension", async () => {
      const orgContent = `#+TITLE: Test

#+begin_src javascript
export default 42;
#+end_src
`;

      // javascriptPlugin has defaultExtension: "js"
      expect(javascriptPlugin.defaultExtension).toBe("js");

      const ast = parse(orgContent) as OrgData;
      const context = {
        orgFilePath: "content/test.org",
        plugins: [javascriptPlugin],
        config: {
          contentDir: "content",
          outDir: "dist",
          base: "/",
        } as any,
        cacheDir: "/tmp/cache",
        base: "/",
        contentDir: "content",
        outDir: "dist",
      };

      const { modifiedAst } = await processCodeBlocks(ast, context);
      const exportBlocks = findExportBlockValues(modifiedAst);
      const htmlContent = exportBlocks.join("");

      // JS plugins should generate container div with data-org-block, not inline script
      expect(htmlContent).toContain('data-org-block="');
      expect(htmlContent).toContain('class="org-block-result"');
      expect(htmlContent).not.toContain("<style");
      // No inline scripts - hydration handles this
      expect(htmlContent).not.toContain('<script type="module">');
    });
  });
});
