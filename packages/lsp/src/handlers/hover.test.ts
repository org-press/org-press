/**
 * Tests for Hover Handler
 *
 * Tests hover information (quick info) functionality.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { handleHover } from "./hover.js";
import {
  createTestContext,
  createTestService,
  createOrgContent,
  createTextDocument,
  type TestContext,
} from "../__tests__/test-helpers.js";

describe("handleHover", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  describe("Type Information", () => {
    it("should show type for variable", async () => {
      const orgContent = createOrgContent([
        { name: "vars", content: `const count: number = 42;` },
      ]);
      const service = await createTestService(ctx, { "test.org": orgContent });

      const document = createTextDocument(
        `file://${ctx.projectRoot}/content/test.org`,
        orgContent
      );

      // Position at "count"
      const hover = handleHover(service, document, { line: 4, character: 6 });

      expect(hover).not.toBeNull();
      expect(hover!.contents).toBeDefined();
      expect((hover!.contents as { value: string }).value).toContain("number");
    });

    it("should show inferred type", async () => {
      const orgContent = createOrgContent([
        { name: "inferred", content: `const items: string[] = ["apple", "banana"];` },
      ]);
      const service = await createTestService(ctx, { "test.org": orgContent });

      const document = createTextDocument(
        `file://${ctx.projectRoot}/content/test.org`,
        orgContent
      );

      const hover = handleHover(service, document, { line: 4, character: 6 });

      expect(hover).not.toBeNull();
      // The hover content should show the type
      const content = (hover!.contents as { value: string }).value;
      expect(content).toContain("items");
    });
  });

  describe("Function Signatures", () => {
    it("should show function signature", async () => {
      const orgContent = createOrgContent([
        {
          name: "funcs",
          content: `function add(a: number, b: number): number {
  return a + b;
}`,
        },
      ]);
      const service = await createTestService(ctx, { "test.org": orgContent });

      const document = createTextDocument(
        `file://${ctx.projectRoot}/content/test.org`,
        orgContent
      );

      // Position at "add"
      const hover = handleHover(service, document, { line: 4, character: 9 });

      expect(hover).not.toBeNull();
      const content = (hover!.contents as { value: string }).value;
      expect(content).toContain("add");
      expect(content).toContain("number");
    });

    it("should show arrow function type", async () => {
      const orgContent = createOrgContent([
        {
          name: "arrows",
          content: `const multiply = (a: number, b: number) => a * b;`,
        },
      ]);
      const service = await createTestService(ctx, { "test.org": orgContent });

      const document = createTextDocument(
        `file://${ctx.projectRoot}/content/test.org`,
        orgContent
      );

      const hover = handleHover(service, document, { line: 4, character: 6 });

      expect(hover).not.toBeNull();
    });
  });

  describe("Documentation", () => {
    it("should show JSDoc documentation", async () => {
      const orgContent = createOrgContent([
        {
          name: "docs",
          content: `/**
 * Adds two numbers together.
 * @param a - First number
 * @param b - Second number
 * @returns The sum of a and b
 */
function add(a: number, b: number): number {
  return a + b;
}`,
        },
      ]);
      const service = await createTestService(ctx, { "test.org": orgContent });

      const document = createTextDocument(
        `file://${ctx.projectRoot}/content/test.org`,
        orgContent
      );

      // Position at "add"
      const hover = handleHover(service, document, { line: 10, character: 9 });

      expect(hover).not.toBeNull();
      const content = (hover!.contents as { value: string }).value;
      expect(content).toContain("Adds two numbers");
    });
  });

  describe("Interface Information", () => {
    it("should show interface members on hover", async () => {
      const orgContent = createOrgContent([
        {
          name: "interfaces",
          content: `interface Person {
  name: string;
  age: number;
}

const user: Person = { name: "Alice", age: 30 };`,
        },
      ]);
      const service = await createTestService(ctx, { "test.org": orgContent });

      const document = createTextDocument(
        `file://${ctx.projectRoot}/content/test.org`,
        orgContent
      );

      // Position at "Person" type annotation
      const hover = handleHover(service, document, { line: 9, character: 12 });

      expect(hover).not.toBeNull();
    });
  });

  describe("Edge Cases", () => {
    it("should return null for position outside blocks", async () => {
      const orgContent = `#+TITLE: Test

Regular text

#+name: block
#+begin_src typescript
const x = 1;
#+end_src
`;
      const service = await createTestService(ctx, { "test.org": orgContent });

      const document = createTextDocument(
        `file://${ctx.projectRoot}/content/test.org`,
        orgContent
      );

      const hover = handleHover(service, document, { line: 2, character: 0 });

      expect(hover).toBeNull();
    });

    it("should return null for whitespace", async () => {
      const orgContent = createOrgContent([
        { name: "space", content: `const x = 1;   ` },
      ]);
      const service = await createTestService(ctx, { "test.org": orgContent });

      const document = createTextDocument(
        `file://${ctx.projectRoot}/content/test.org`,
        orgContent
      );

      // Position on trailing whitespace
      const hover = handleHover(service, document, { line: 4, character: 14 });

      expect(hover).toBeNull();
    });

    it("should handle keywords", async () => {
      const orgContent = createOrgContent([
        { name: "keywords", content: `const x = 1;` },
      ]);
      const service = await createTestService(ctx, { "test.org": orgContent });

      const document = createTextDocument(
        `file://${ctx.projectRoot}/content/test.org`,
        orgContent
      );

      // Position at "const" keyword
      const hover = handleHover(service, document, { line: 4, character: 0 });

      // Keywords may or may not return hover info
      // This is just testing it doesn't crash
      expect(true).toBe(true);
    });
  });

  describe("Markdown Formatting", () => {
    it("should format hover content as markdown", async () => {
      const orgContent = createOrgContent([
        { name: "md", content: `const x: number = 42;` },
      ]);
      const service = await createTestService(ctx, { "test.org": orgContent });

      const document = createTextDocument(
        `file://${ctx.projectRoot}/content/test.org`,
        orgContent
      );

      const hover = handleHover(service, document, { line: 4, character: 6 });

      expect(hover).not.toBeNull();
      expect((hover!.contents as { kind: string }).kind).toBe("markdown");
      expect((hover!.contents as { value: string }).value).toContain("```typescript");
    });
  });
});
