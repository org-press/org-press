import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  isDevelopment,
  renderPageList,
  clearContentCache,
  dangerousWriteContentBlock,
  type ContentPage,
} from "./content.ts";

describe("Content API", () => {
  beforeEach(() => {
    clearContentCache();
  });

  describe("isDevelopment", () => {
    it("should return false in production", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      expect(isDevelopment()).toBe(false);

      process.env.NODE_ENV = originalEnv;
    });

    it("should return true in development", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      expect(isDevelopment()).toBe(true);

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe("renderPageList", () => {
    it("should render empty state", () => {
      const pages: ContentPage[] = [];
      const html = renderPageList(pages);

      expect(html).toContain("No posts found");
    });

    it("should render list of pages", () => {
      const pages: ContentPage[] = [
        {
          file: "blog/post1.org",
          url: "/blog/post1",
          metadata: { title: "First Post" },
        },
        {
          file: "blog/post2.org",
          url: "/blog/post2",
          metadata: { title: "Second Post" },
        },
      ];

      const html = renderPageList(pages);

      expect(html).toContain('<ul class="content-list">');
      expect(html).toContain("First Post");
      expect(html).toContain("Second Post");
      expect(html).toContain("/blog/post1.html");
      expect(html).toContain("/blog/post2.html");
    });

    it("should show date when requested", () => {
      const pages: ContentPage[] = [
        {
          file: "blog/post.org",
          url: "/blog/post",
          metadata: {
            title: "Test Post",
            date: "2024-01-15",
          },
        },
      ];

      const html = renderPageList(pages, { showDate: true });

      expect(html).toContain("2024-01-15");
      expect(html).toContain("<time>");
    });

    it("should show author when requested", () => {
      const pages: ContentPage[] = [
        {
          file: "blog/post.org",
          url: "/blog/post",
          metadata: {
            title: "Test Post",
            author: "John Doe",
          },
        },
      ];

      const html = renderPageList(pages, { showAuthor: true });

      expect(html).toContain("John Doe");
      expect(html).toContain("by");
    });

    it("should show excerpt when requested", () => {
      const pages: ContentPage[] = [
        {
          file: "blog/post.org",
          url: "/blog/post",
          metadata: {
            title: "Test Post",
            description: "This is a great post",
          },
        },
      ];

      const html = renderPageList(pages, { showExcerpt: true });

      expect(html).toContain("This is a great post");
      expect(html).toContain("excerpt");
    });

    it("should escape HTML in content", () => {
      const pages: ContentPage[] = [
        {
          file: "blog/post.org",
          url: "/blog/post",
          metadata: {
            title: "<script>alert('xss')</script>",
          },
        },
      ];

      const html = renderPageList(pages);

      expect(html).not.toContain("<script>");
      expect(html).toContain("&lt;script&gt;");
    });

    it("should use filename as title if title is missing", () => {
      const pages: ContentPage[] = [
        {
          file: "blog/my-post.org",
          url: "/blog/my-post",
          metadata: {},
        },
      ];

      const html = renderPageList(pages);

      expect(html).toContain("blog/my-post");
    });
  });

  // Note: getContentPages and getContentPagesFromDirectory tests
  // require actual .org files on disk, so they should be in integration tests
});

describe("dangerousWriteContentBlock", () => {
  const testDir = join(process.cwd(), "content", "__test_write_block__");
  const testFile = "test.org";
  const testFilePath = join(testDir, testFile);

  beforeEach(() => {
    // Create test directory and file
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory
    rmSync(testDir, { recursive: true, force: true });
  });

  it("should replace block by name", async () => {
    const orgContent = `#+TITLE: Test

* Section
#+begin_src js :name my-block
const old = "code";
#+end_src
`;
    writeFileSync(testFilePath, orgContent);

    const result = await dangerousWriteContentBlock({
      file: "__test_write_block__/test.org",
      block: "my-block",
      content: 'const updated = "new code";',
    });

    expect(result.success).toBe(true);

    const newContent = readFileSync(testFilePath, "utf-8");
    expect(newContent).toContain('const updated = "new code";');
    expect(newContent).not.toContain('const old = "code";');
    expect(newContent).toContain("#+begin_src js :name my-block");
  });

  it("should replace block by index", async () => {
    const orgContent = `#+TITLE: Test

* First block
#+begin_src js
const first = 1;
#+end_src

* Second block
#+begin_src js
const second = 2;
#+end_src
`;
    writeFileSync(testFilePath, orgContent);

    const result = await dangerousWriteContentBlock({
      file: "__test_write_block__/test.org",
      block: 1, // Second block (0-indexed)
      content: "const updated = 999;",
    });

    expect(result.success).toBe(true);

    const newContent = readFileSync(testFilePath, "utf-8");
    expect(newContent).toContain("const first = 1;"); // First block unchanged
    expect(newContent).toContain("const updated = 999;");
    expect(newContent).not.toContain("const second = 2;");
  });

  it("should return error for non-existent block name", async () => {
    const orgContent = `#+TITLE: Test

#+begin_src js :name existing
code
#+end_src
`;
    writeFileSync(testFilePath, orgContent);

    const result = await dangerousWriteContentBlock({
      file: "__test_write_block__/test.org",
      block: "non-existent",
      content: "new code",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Block not found");
  });

  it("should return error for out of bounds index", async () => {
    const orgContent = `#+TITLE: Test

#+begin_src js
code
#+end_src
`;
    writeFileSync(testFilePath, orgContent);

    const result = await dangerousWriteContentBlock({
      file: "__test_write_block__/test.org",
      block: 5, // Only one block exists
      content: "new code",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Block not found");
  });

  it("should preserve block indentation", async () => {
    const orgContent = `#+TITLE: Test

* Section
  #+begin_src js :name indented
  const code = 1;
  #+end_src
`;
    writeFileSync(testFilePath, orgContent);

    const result = await dangerousWriteContentBlock({
      file: "__test_write_block__/test.org",
      block: "indented",
      content: "const new_code = 2;",
    });

    expect(result.success).toBe(true);

    const newContent = readFileSync(testFilePath, "utf-8");
    expect(newContent).toContain("  #+begin_src js :name indented");
    expect(newContent).toContain("  const new_code = 2;");
    expect(newContent).toContain("  #+end_src");
  });

  it("should return error for non-existent file", async () => {
    const result = await dangerousWriteContentBlock({
      file: "__test_write_block__/non-existent.org",
      block: 0,
      content: "code",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
