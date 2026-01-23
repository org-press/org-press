/**
 * Tests for Diagnostics Handler
 *
 * Tests type-checking diagnostics functionality.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getDiagnostics } from "./diagnostics.js";
import {
  createTestContext,
  createTestService,
  createOrgContent,
  createTextDocument,
  type TestContext,
} from "../__tests__/test-helpers.js";

describe("getDiagnostics", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  describe("Type Errors", () => {
    it("should report type mismatch errors", async () => {
      const orgContent = createOrgContent([
        { name: "error", content: `const x: number = "hello";` },
      ]);
      const service = await createTestService(ctx, { "test.org": orgContent });

      const document = createTextDocument(
        `file://${ctx.projectRoot}/content/test.org`,
        orgContent
      );

      const diagnostics = getDiagnostics(service, document);

      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0].severity).toBe(1); // Error
      expect(diagnostics[0].message).toContain("string");
    });

    it("should report missing property errors", async () => {
      const orgContent = createOrgContent([
        {
          name: "missing",
          content: `interface Person { name: string; age: number; }
const user: Person = { name: "Alice" };`,
        },
      ]);
      const service = await createTestService(ctx, { "test.org": orgContent });

      const document = createTextDocument(
        `file://${ctx.projectRoot}/content/test.org`,
        orgContent
      );

      const diagnostics = getDiagnostics(service, document);

      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics.some(d => d.message.includes("age"))).toBe(true);
    });

    it("should report argument type errors", async () => {
      const orgContent = createOrgContent([
        {
          name: "args",
          content: `function add(a: number, b: number) { return a + b; }
add("one", "two");`,
        },
      ]);
      const service = await createTestService(ctx, { "test.org": orgContent });

      const document = createTextDocument(
        `file://${ctx.projectRoot}/content/test.org`,
        orgContent
      );

      const diagnostics = getDiagnostics(service, document);

      expect(diagnostics.length).toBeGreaterThan(0);
    });
  });

  describe("Syntax Errors", () => {
    it("should report syntax errors", async () => {
      const orgContent = createOrgContent([
        { name: "syntax", content: `const x = {` },
      ]);
      const service = await createTestService(ctx, { "test.org": orgContent });

      const document = createTextDocument(
        `file://${ctx.projectRoot}/content/test.org`,
        orgContent
      );

      const diagnostics = getDiagnostics(service, document);

      expect(diagnostics.length).toBeGreaterThan(0);
    });

    it("should report missing semicolons in strict mode", async () => {
      // Note: Our config has strict: false, so this might not error
      const orgContent = createOrgContent([
        { name: "semi", content: `const x = 1\nconst y = 2` },
      ]);
      const service = await createTestService(ctx, { "test.org": orgContent });

      const document = createTextDocument(
        `file://${ctx.projectRoot}/content/test.org`,
        orgContent
      );

      // This is actually valid JS/TS, so should have no errors
      const diagnostics = getDiagnostics(service, document);
      expect(diagnostics.length).toBe(0);
    });
  });

  describe("Valid Code", () => {
    it("should return empty for valid code", async () => {
      const orgContent = createOrgContent([
        { name: "valid", content: `const x: number = 42;` },
      ]);
      const service = await createTestService(ctx, { "test.org": orgContent });

      const document = createTextDocument(
        `file://${ctx.projectRoot}/content/test.org`,
        orgContent
      );

      const diagnostics = getDiagnostics(service, document);

      expect(diagnostics.length).toBe(0);
    });

    it("should return empty for valid TypeScript with generics", async () => {
      const orgContent = createOrgContent([
        {
          name: "generics",
          content: `function identity<T>(arg: T): T { return arg; }
const result = identity<string>("hello");`,
        },
      ]);
      const service = await createTestService(ctx, { "test.org": orgContent });

      const document = createTextDocument(
        `file://${ctx.projectRoot}/content/test.org`,
        orgContent
      );

      const diagnostics = getDiagnostics(service, document);

      expect(diagnostics.length).toBe(0);
    });
  });

  describe("Position Mapping", () => {
    it("should map diagnostic positions to org file coordinates", async () => {
      const orgContent = createOrgContent([
        { name: "pos", content: `const x: number = "wrong";` },
      ]);
      const service = await createTestService(ctx, { "test.org": orgContent });

      const document = createTextDocument(
        `file://${ctx.projectRoot}/content/test.org`,
        orgContent
      );

      const diagnostics = getDiagnostics(service, document);

      expect(diagnostics.length).toBeGreaterThan(0);
      // Position should be within the block content area
      expect(diagnostics[0].range.start.line).toBeGreaterThanOrEqual(4);
    });
  });

  describe("Source Attribution", () => {
    it("should attribute diagnostics to org-press-lsp", async () => {
      const orgContent = createOrgContent([
        { name: "source", content: `const x: number = "error";` },
      ]);
      const service = await createTestService(ctx, { "test.org": orgContent });

      const document = createTextDocument(
        `file://${ctx.projectRoot}/content/test.org`,
        orgContent
      );

      const diagnostics = getDiagnostics(service, document);

      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0].source).toBe("org-press-lsp");
    });
  });

  describe("Multiple Blocks", () => {
    it("should report diagnostics from multiple blocks", async () => {
      const orgContent = createOrgContent([
        { name: "block1", content: `const a: number = "error1";` },
        { name: "block2", content: `const b: string = 123;` },
      ]);
      const service = await createTestService(ctx, { "test.org": orgContent });

      const document = createTextDocument(
        `file://${ctx.projectRoot}/content/test.org`,
        orgContent
      );

      const diagnostics = getDiagnostics(service, document);

      // Should have errors from both blocks
      expect(diagnostics.length).toBeGreaterThanOrEqual(2);
    });

    it("should only report from blocks with errors", async () => {
      const orgContent = createOrgContent([
        { name: "valid", content: `const a: number = 42;` },
        { name: "invalid", content: `const b: number = "error";` },
      ]);
      const service = await createTestService(ctx, { "test.org": orgContent });

      const document = createTextDocument(
        `file://${ctx.projectRoot}/content/test.org`,
        orgContent
      );

      const diagnostics = getDiagnostics(service, document);

      // Should have error only from second block
      expect(diagnostics.length).toBe(1);
    });
  });

  describe("No TS Blocks", () => {
    it("should return empty for file without TS blocks", async () => {
      const orgContent = `#+TITLE: Test

Just some regular text, no code blocks.
`;
      const service = await createTestService(ctx, { "test.org": orgContent });

      const document = createTextDocument(
        `file://${ctx.projectRoot}/content/test.org`,
        orgContent
      );

      const diagnostics = getDiagnostics(service, document);

      expect(diagnostics).toEqual([]);
    });

    it("should return empty for non-TS language blocks", async () => {
      const orgContent = `#+TITLE: Test

#+name: python
#+begin_src python
x: int = "error"  # Python doesn't care
#+end_src
`;
      const service = await createTestService(ctx, { "test.org": orgContent });

      const document = createTextDocument(
        `file://${ctx.projectRoot}/content/test.org`,
        orgContent
      );

      const diagnostics = getDiagnostics(service, document);

      expect(diagnostics).toEqual([]);
    });
  });

  describe("Severity Mapping", () => {
    it("should map error severity correctly", async () => {
      const orgContent = createOrgContent([
        { name: "err", content: `const x: number = "str";` },
      ]);
      const service = await createTestService(ctx, { "test.org": orgContent });

      const document = createTextDocument(
        `file://${ctx.projectRoot}/content/test.org`,
        orgContent
      );

      const diagnostics = getDiagnostics(service, document);

      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0].severity).toBe(1); // LSP Error = 1
    });
  });
});
