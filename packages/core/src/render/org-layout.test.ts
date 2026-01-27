/**
 * Tests for org-defined layout system
 *
 * Layouts are defined using:
 * - #+LAYOUT: #blockName - references a named block as the layout
 * - #+WRAPPER: #blockName - references a named block as the content wrapper
 */

import { describe, it, expect } from "vitest";
import { parse } from "uniorg-parse/lib/parser.js";
import type { OrgData } from "uniorg";
import { extractMetadata } from "../parser/metadata.ts";
import {
  extractOrgLayouts,
  createLayoutFunction,
  createWrapperFunction,
  applyContentWrapper,
  applyLayout,
  hasOrgLayout,
  hasOrgWrapper,
  hasThemeLayout,
  getThemeLayoutName,
  renderWithOrgLayout,
} from "./org-layout.ts";

describe("Org Layout System", () => {
  describe("extractOrgLayouts", () => {
    it("extracts layout block referenced by #+LAYOUT", () => {
      const source = `#+TITLE: Test
#+LAYOUT: #my-layout

#+NAME: my-layout
#+begin_src js
function layout({ content }) {
  return '<html>' + content + '</html>';
}
#+end_src

* Content
Hello world
`;
      const ast = parse(source) as OrgData;
      const metadata = extractMetadata(ast);
      const { layout, wrapper, contentAst } = extractOrgLayouts(ast, metadata);

      expect(layout).toBeDefined();
      expect(layout?.name).toBe("my-layout");
      expect(layout?.type).toBe("js");
      expect(layout?.code).toContain("function layout");
      expect(wrapper).toBeUndefined();
    });

    it("extracts wrapper block referenced by #+WRAPPER", () => {
      const source = `#+TITLE: Test
#+WRAPPER: #my-wrapper

#+NAME: my-wrapper
#+begin_src js
function wrapper({ content }) {
  return '<article>' + content + '</article>';
}
#+end_src

* Content
Hello world
`;
      const ast = parse(source) as OrgData;
      const metadata = extractMetadata(ast);
      const { layout, wrapper } = extractOrgLayouts(ast, metadata);

      expect(wrapper).toBeDefined();
      expect(wrapper?.name).toBe("my-wrapper");
      expect(wrapper?.code).toContain("function wrapper");
      expect(layout).toBeUndefined();
    });

    it("extracts both layout and wrapper", () => {
      const source = `#+TITLE: Test
#+LAYOUT: #page-layout
#+WRAPPER: #content-wrapper

#+NAME: page-layout
#+begin_src js
function layout({ content }) {
  return '<html>' + content + '</html>';
}
#+end_src

#+NAME: content-wrapper
#+begin_src js
function wrapper({ content }) {
  return '<article>' + content + '</article>';
}
#+end_src

* Content
Hello
`;
      const ast = parse(source) as OrgData;
      const metadata = extractMetadata(ast);
      const { layout, wrapper } = extractOrgLayouts(ast, metadata);

      expect(layout).toBeDefined();
      expect(layout?.name).toBe("page-layout");
      expect(wrapper).toBeDefined();
      expect(wrapper?.name).toBe("content-wrapper");
    });

    it("removes layout blocks from content AST", () => {
      const source = `#+TITLE: Test
#+LAYOUT: #my-layout

#+NAME: my-layout
#+begin_src js
function layout({ content }) { return content; }
#+end_src

* Content
Hello world
`;
      const ast = parse(source) as OrgData;
      const metadata = extractMetadata(ast);
      const { contentAst } = extractOrgLayouts(ast, metadata);

      // Check that layout block was removed
      let foundLayoutBlock = false;
      function walk(node: any): void {
        if (!node) return;
        if (node.type === "src-block" && node.affiliated?.NAME === "my-layout") {
          foundLayoutBlock = true;
        }
        if (node.children) {
          node.children.forEach(walk);
        }
      }
      walk(contentAst);

      expect(foundLayoutBlock).toBe(false);
    });

    it("handles missing layout block gracefully", () => {
      const source = `#+TITLE: Test
#+LAYOUT: #non-existent

* Content
Hello
`;
      const ast = parse(source) as OrgData;
      const metadata = extractMetadata(ast);
      const { layout } = extractOrgLayouts(ast, metadata);

      expect(layout).toBeUndefined();
    });

    it("detects different language types", () => {
      const source = `#+TITLE: Test
#+LAYOUT: #tsx-layout

#+NAME: tsx-layout
#+begin_src tsx
function Layout({ content }: { content: string }) {
  return <html><body>{content}</body></html>;
}
#+end_src

* Content
`;
      const ast = parse(source) as OrgData;
      const metadata = extractMetadata(ast);
      const { layout } = extractOrgLayouts(ast, metadata);

      expect(layout?.type).toBe("tsx");
    });
  });

  describe("createLayoutFunction", () => {
    it("creates function from layout block", async () => {
      const block = {
        name: "test",
        type: "js" as const,
        code: `function layout({ content }) { return '<div>' + content + '</div>'; }`,
        language: "javascript",
      };

      const layoutFn = await createLayoutFunction(block);
      const result = await layoutFn({ content: "Hello", metadata: {} });

      expect(result).toBe("<div>Hello</div>");
    });

    it("supports Layout (capital L) function name", async () => {
      const block = {
        name: "test",
        type: "js" as const,
        code: `function Layout({ content }) { return '<main>' + content + '</main>'; }`,
        language: "javascript",
      };

      const layoutFn = await createLayoutFunction(block);
      const result = await layoutFn({ content: "Test", metadata: {} });

      expect(result).toBe("<main>Test</main>");
    });

    it("receives all context properties", async () => {
      const block = {
        name: "test",
        type: "js" as const,
        code: `
          function layout({ content, metadata, head, scripts, base }) {
            return JSON.stringify({ content, title: metadata.title, head, scripts, base });
          }
        `,
        language: "javascript",
      };

      const layoutFn = await createLayoutFunction(block);
      const result = await layoutFn({
        content: "<p>Content</p>",
        metadata: { title: "My Page" },
        head: "<link>",
        scripts: "<script></script>",
        base: "/app",
      });

      const parsed = JSON.parse(result);
      expect(parsed.content).toBe("<p>Content</p>");
      expect(parsed.title).toBe("My Page");
      expect(parsed.head).toBe("<link>");
      expect(parsed.scripts).toBe("<script></script>");
      expect(parsed.base).toBe("/app");
    });

    it("returns fallback on error", async () => {
      const block = {
        name: "test",
        type: "js" as const,
        code: `throw new Error("oops");`,
        language: "javascript",
      };

      const layoutFn = await createLayoutFunction(block);
      const result = await layoutFn({ content: "Hello", metadata: {} });

      expect(result).toContain("<!DOCTYPE html>");
      expect(result).toContain("Hello");
    });
  });

  describe("createWrapperFunction", () => {
    it("creates function from wrapper block", async () => {
      const block = {
        name: "test",
        type: "js" as const,
        code: `function wrapper({ content }) { return '<article>' + content + '</article>'; }`,
        language: "javascript",
      };

      const wrapperFn = await createWrapperFunction(block);
      const result = await wrapperFn({ content: "Hello", metadata: {} });

      expect(result).toBe("<article>Hello</article>");
    });

    it("receives metadata", async () => {
      const block = {
        name: "test",
        type: "js" as const,
        code: `
          function wrapper({ content, metadata }) {
            return '<article><h1>' + metadata.title + '</h1>' + content + '</article>';
          }
        `,
        language: "javascript",
      };

      const wrapperFn = await createWrapperFunction(block);
      const result = await wrapperFn({
        content: "<p>Body</p>",
        metadata: { title: "Article Title" },
      });

      expect(result).toContain("<h1>Article Title</h1>");
      expect(result).toContain("<p>Body</p>");
    });
  });

  describe("hasOrgLayout", () => {
    it("returns true when #+LAYOUT references a block", () => {
      expect(hasOrgLayout({ layout: "#my-layout" })).toBe(true);
    });

    it("returns false when no layout", () => {
      expect(hasOrgLayout({})).toBe(false);
    });

    it("returns false when layout doesn't start with #", () => {
      expect(hasOrgLayout({ layout: "default" })).toBe(false);
    });
  });

  describe("hasOrgWrapper", () => {
    it("returns true when #+WRAPPER references a block", () => {
      expect(hasOrgWrapper({ wrapper: "#my-wrapper" })).toBe(true);
    });

    it("returns false when no wrapper", () => {
      expect(hasOrgWrapper({})).toBe(false);
    });
  });

  describe("hasThemeLayout", () => {
    it("returns true when #+LAYOUT is a theme name (no #)", () => {
      expect(hasThemeLayout({ layout: "blog" })).toBe(true);
      expect(hasThemeLayout({ layout: "default" })).toBe(true);
      expect(hasThemeLayout({ layout: "minimal" })).toBe(true);
    });

    it("returns false when no layout", () => {
      expect(hasThemeLayout({})).toBe(false);
    });

    it("returns false when layout starts with #", () => {
      expect(hasThemeLayout({ layout: "#my-layout" })).toBe(false);
    });

    it("returns false when layout is empty string", () => {
      expect(hasThemeLayout({ layout: "" })).toBe(false);
    });
  });

  describe("getThemeLayoutName", () => {
    it("returns layout name when it's a theme reference", () => {
      expect(getThemeLayoutName({ layout: "blog" })).toBe("blog");
      expect(getThemeLayoutName({ layout: "default" })).toBe("default");
    });

    it("returns undefined when layout is a block reference", () => {
      expect(getThemeLayoutName({ layout: "#my-layout" })).toBeUndefined();
    });

    it("returns undefined when no layout", () => {
      expect(getThemeLayoutName({})).toBeUndefined();
    });
  });

  describe("renderWithOrgLayout", () => {
    it("renders content with layout", async () => {
      const source = `#+TITLE: Test Page
#+LAYOUT: #my-layout

#+NAME: my-layout
#+begin_src js
function layout({ content, metadata }) {
  return '<!DOCTYPE html><html><head><title>' + metadata.title + '</title></head><body>' + content + '</body></html>';
}
#+end_src

* Hello
World
`;
      const ast = parse(source) as OrgData;
      const metadata = extractMetadata(ast);

      const { html, hasLayout } = await renderWithOrgLayout(
        ast,
        metadata,
        async () => "<p>Rendered content</p>"
      );

      expect(hasLayout).toBe(true);
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("<title>Test Page</title>");
      expect(html).toContain("<p>Rendered content</p>");
    });

    it("applies wrapper before layout", async () => {
      const source = `#+TITLE: Test
#+LAYOUT: #page-layout
#+WRAPPER: #article-wrapper

#+NAME: page-layout
#+begin_src js
function layout({ content }) {
  return '<html><body><div class="layout">' + content + '</div></body></html>';
}
#+end_src

#+NAME: article-wrapper
#+begin_src js
function wrapper({ content }) {
  return '<article class="wrapper">' + content + '</article>';
}
#+end_src

* Content
`;
      const ast = parse(source) as OrgData;
      const metadata = extractMetadata(ast);

      const { html } = await renderWithOrgLayout(
        ast,
        metadata,
        async () => "<p>Inner</p>"
      );

      // Content should be wrapped first, then layout applied
      expect(html).toContain('<div class="layout">');
      expect(html).toContain('<article class="wrapper">');
      expect(html).toContain("<p>Inner</p>");

      // Verify nesting order: layout > wrapper > content
      const layoutPos = html.indexOf("layout");
      const wrapperPos = html.indexOf("wrapper");
      const innerPos = html.indexOf("Inner");

      expect(layoutPos).toBeLessThan(wrapperPos);
      expect(wrapperPos).toBeLessThan(innerPos);
    });

    it("returns content without layout when no #+LAYOUT", async () => {
      const source = `#+TITLE: Test

* Content
Hello
`;
      const ast = parse(source) as OrgData;
      const metadata = extractMetadata(ast);

      const { html, hasLayout } = await renderWithOrgLayout(
        ast,
        metadata,
        async () => "<p>Content</p>"
      );

      expect(hasLayout).toBe(false);
      expect(html).toBe("<p>Content</p>");
      expect(html).not.toContain("<!DOCTYPE");
    });

    it("injects head and scripts into layout", async () => {
      const source = `#+TITLE: Test
#+LAYOUT: #my-layout

#+NAME: my-layout
#+begin_src js
function layout({ content, head, scripts }) {
  return '<html><head>' + head + '</head><body>' + content + scripts + '</body></html>';
}
#+end_src

* Content
`;
      const ast = parse(source) as OrgData;
      const metadata = extractMetadata(ast);

      const { html } = await renderWithOrgLayout(
        ast,
        metadata,
        async () => "<p>Body</p>",
        '<link rel="stylesheet" href="style.css">',
        '<script src="app.js"></script>'
      );

      expect(html).toContain('<link rel="stylesheet" href="style.css">');
      expect(html).toContain('<script src="app.js"></script>');
    });
  });
});
