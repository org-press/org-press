/**
 * Tests for References Handler
 *
 * Tests find-references, type-definition, and implementation functionality.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  handleReferences,
  handleTypeDefinition,
  handleImplementation,
} from "./references.js";
import {
  createTestContext,
  createTestService,
  createOrgContent,
  createTextDocument,
  type TestContext,
} from "../__tests__/test-helpers.js";

describe("handleReferences", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  describe("Same File References", () => {
    it("should find all references to a variable", async () => {
      const orgContent = createOrgContent([
        {
          name: "refs",
          content: `const value = 42;
const a = value + 1;
const b = value * 2;
console.log(value);`,
        },
      ]);
      const service = await createTestService(ctx, { "test.org": orgContent });

      const document = createTextDocument(
        `file://${ctx.projectRoot}/content/test.org`,
        orgContent
      );

      // Position at first "value"
      const locations = handleReferences(
        service,
        document,
        { line: 4, character: 6 },
        ctx.projectRoot
      );

      // Should find declaration + 3 usages = 4 total
      expect(locations.length).toBe(4);
    });

    it("should find function references", async () => {
      const orgContent = createOrgContent([
        {
          name: "funcs",
          content: `function helper() { return 1; }
const a = helper();
const b = helper() + helper();`,
        },
      ]);
      const service = await createTestService(ctx, { "test.org": orgContent });

      const document = createTextDocument(
        `file://${ctx.projectRoot}/content/test.org`,
        orgContent
      );

      const locations = handleReferences(
        service,
        document,
        { line: 4, character: 9 },
        ctx.projectRoot
      );

      // Declaration + 3 calls
      expect(locations.length).toBe(4);
    });
  });

  describe("Edge Cases", () => {
    it("should return empty for position outside blocks", async () => {
      const orgContent = `#+TITLE: Test

Text

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

      const locations = handleReferences(
        service,
        document,
        { line: 2, character: 0 },
        ctx.projectRoot
      );

      expect(locations).toEqual([]);
    });

    it("should handle single reference (just declaration)", async () => {
      const orgContent = createOrgContent([
        { name: "single", content: `const unused = 42;` },
      ]);
      const service = await createTestService(ctx, { "test.org": orgContent });

      const document = createTextDocument(
        `file://${ctx.projectRoot}/content/test.org`,
        orgContent
      );

      const locations = handleReferences(
        service,
        document,
        { line: 4, character: 6 },
        ctx.projectRoot
      );

      // Just the declaration
      expect(locations.length).toBe(1);
    });
  });
});

describe("handleTypeDefinition", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  it("should find type definition for variable", async () => {
    const orgContent = createOrgContent([
      {
        name: "types",
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

    // Position at "user"
    const locations = handleTypeDefinition(
      service,
      document,
      { line: 9, character: 6 },
      ctx.projectRoot
    );

    // Should find Person interface
    expect(locations.length).toBeGreaterThan(0);
    expect(locations[0].uri).toContain("test.org");
  });

  it("should return empty for position outside blocks", async () => {
    const orgContent = `#+TITLE: Test

Text

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

    const locations = handleTypeDefinition(
      service,
      document,
      { line: 2, character: 0 },
      ctx.projectRoot
    );

    expect(locations).toEqual([]);
  });
});

describe("handleImplementation", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  it("should find implementations of interface", async () => {
    const orgContent = createOrgContent([
      {
        name: "impl",
        content: `interface Animal {
  speak(): void;
}

class Dog implements Animal {
  speak() { console.log("Woof!"); }
}

class Cat implements Animal {
  speak() { console.log("Meow!"); }
}`,
      },
    ]);
    const service = await createTestService(ctx, { "test.org": orgContent });

    const document = createTextDocument(
      `file://${ctx.projectRoot}/content/test.org`,
      orgContent
    );

    // Position at "Animal" in interface
    const locations = handleImplementation(
      service,
      document,
      { line: 4, character: 10 },
      ctx.projectRoot
    );

    // Should find Dog and Cat
    expect(locations.length).toBeGreaterThanOrEqual(2);
  });

  it("should return empty for position outside blocks", async () => {
    const orgContent = `#+TITLE: Test

Text

#+name: block
#+begin_src typescript
interface X {}
#+end_src
`;
    const service = await createTestService(ctx, { "test.org": orgContent });

    const document = createTextDocument(
      `file://${ctx.projectRoot}/content/test.org`,
      orgContent
    );

    const locations = handleImplementation(
      service,
      document,
      { line: 2, character: 0 },
      ctx.projectRoot
    );

    expect(locations).toEqual([]);
  });

  it("should handle abstract class implementations", async () => {
    const orgContent = createOrgContent([
      {
        name: "abstract",
        content: `abstract class Shape {
  abstract getArea(): number;
}

class Circle extends Shape {
  constructor(private radius: number) { super(); }
  getArea() { return Math.PI * this.radius ** 2; }
}

class Rectangle extends Shape {
  constructor(private width: number, private height: number) { super(); }
  getArea() { return this.width * this.height; }
}`,
      },
    ]);
    const service = await createTestService(ctx, { "test.org": orgContent });

    const document = createTextDocument(
      `file://${ctx.projectRoot}/content/test.org`,
      orgContent
    );

    // Position at "Shape" abstract class
    const locations = handleImplementation(
      service,
      document,
      { line: 4, character: 15 },
      ctx.projectRoot
    );

    // Should find Circle and Rectangle
    expect(locations.length).toBeGreaterThanOrEqual(2);
  });
});
