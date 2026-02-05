/**
 * Tests for Definition Handler
 *
 * Tests go-to-definition functionality.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { handleDefinition } from "./definition.js";
import {
  createTestContext,
  createTestService,
  createOrgContent,
  createTextDocument,
  type TestContext,
} from "../__tests__/test-helpers.js";

describe("handleDefinition", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  describe("Same-file definitions", () => {
    it("should find variable definition in same block", async () => {
      const orgContent = createOrgContent([
        {
          name: "test",
          content: `const value = 42;
const result = value + 10;`,
        },
      ]);
      const service = await createTestService(ctx, { "test.org": orgContent });

      const document = createTextDocument(
        `file://${ctx.projectRoot}/content/test.org`,
        orgContent
      );

      // Position at "value" in "const result = value"
      const locations = handleDefinition(
        service,
        document,
        { line: 5, character: 15 },
        ctx.projectRoot
      );

      expect(locations.length).toBeGreaterThan(0);
      expect(locations[0].uri).toContain("test.org");
    });

    it("should find function definition", async () => {
      const orgContent = createOrgContent([
        {
          name: "funcs",
          content: `function greet(name: string) {
  return "Hello, " + name;
}

greet("World");`,
        },
      ]);
      const service = await createTestService(ctx, { "test.org": orgContent });

      const document = createTextDocument(
        `file://${ctx.projectRoot}/content/test.org`,
        orgContent
      );

      // Position at "greet" call
      const locations = handleDefinition(
        service,
        document,
        { line: 8, character: 0 },
        ctx.projectRoot
      );

      expect(locations.length).toBeGreaterThan(0);
    });
  });

  describe("Edge cases", () => {
    it("should return empty array for position outside blocks", async () => {
      const orgContent = `#+TITLE: Test

Regular text here

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

      // Position on "Regular text here"
      const locations = handleDefinition(
        service,
        document,
        { line: 2, character: 0 },
        ctx.projectRoot
      );

      expect(locations).toEqual([]);
    });

    it("should return empty array for built-in symbols", async () => {
      const orgContent = createOrgContent([
        { name: "builtins", content: `console.log("hello");` },
      ]);
      const service = await createTestService(ctx, { "test.org": orgContent });

      const document = createTextDocument(
        `file://${ctx.projectRoot}/content/test.org`,
        orgContent
      );

      // Position at "console" - built-in, definition is in lib.d.ts
      const locations = handleDefinition(
        service,
        document,
        { line: 4, character: 0 },
        ctx.projectRoot
      );

      // Built-in definitions are in TypeScript libs, not our virtual files
      // So we expect empty or possibly lib paths (which we filter out)
      expect(locations).toEqual([]);
    });

    it("should handle definition at end of identifier", async () => {
      const orgContent = createOrgContent([
        {
          name: "test",
          content: `const myVariable = 42;
console.log(myVariable);`,
        },
      ]);
      const service = await createTestService(ctx, { "test.org": orgContent });

      const document = createTextDocument(
        `file://${ctx.projectRoot}/content/test.org`,
        orgContent
      );

      // Position at end of "myVariable"
      const locations = handleDefinition(
        service,
        document,
        { line: 5, character: 22 },
        ctx.projectRoot
      );

      expect(locations.length).toBeGreaterThan(0);
    });
  });

  describe("Multiple definitions", () => {
    it("should find all overloaded function definitions", async () => {
      const orgContent = createOrgContent([
        {
          name: "overloads",
          content: `function process(x: number): number;
function process(x: string): string;
function process(x: number | string): number | string {
  return typeof x === "number" ? x * 2 : x.toUpperCase();
}

process(42);`,
        },
      ]);
      const service = await createTestService(ctx, { "test.org": orgContent });

      const document = createTextDocument(
        `file://${ctx.projectRoot}/content/test.org`,
        orgContent
      );

      // Position at "process" call
      const locations = handleDefinition(
        service,
        document,
        { line: 10, character: 0 },
        ctx.projectRoot
      );

      // Should find at least the implementation
      expect(locations.length).toBeGreaterThan(0);
    });
  });
});
