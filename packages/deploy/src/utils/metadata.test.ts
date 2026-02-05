/**
 * Metadata extraction tests
 */

import { describe, it, expect } from "vitest";
import { parse } from "uniorg-parse/lib/parser.js";
import type { OrgData } from "uniorg";
import {
  extractPackageMetadata,
  extractNamedBlocks,
  parseDependencies,
  bumpVersion,
} from "./metadata.ts";

describe("extractPackageMetadata", () => {
  it("should extract basic metadata from org keywords", () => {
    const source = `#+TITLE: my-package
#+VERSION: 1.0.0
#+DESCRIPTION: A test package
#+AUTHOR: Test Author
#+LICENSE: MIT
`;
    const ast = parse(source) as OrgData;
    const metadata = extractPackageMetadata(ast);

    expect(metadata.name).toBe("my-package");
    expect(metadata.version).toBe("1.0.0");
    expect(metadata.description).toBe("A test package");
    expect(metadata.author).toBe("Test Author");
    expect(metadata.license).toBe("MIT");
  });

  it("should use fallback name when title is missing", () => {
    const source = `#+VERSION: 1.0.0
#+DESCRIPTION: A test package
`;
    const ast = parse(source) as OrgData;
    const metadata = extractPackageMetadata(ast, "fallback-name");

    expect(metadata.name).toBe("fallback-name");
  });

  it("should default version to 1.0.0 when missing", () => {
    const source = `#+TITLE: my-package
`;
    const ast = parse(source) as OrgData;
    const metadata = extractPackageMetadata(ast);

    expect(metadata.version).toBe("1.0.0");
  });

  it("should default license to MIT when missing", () => {
    const source = `#+TITLE: my-package
`;
    const ast = parse(source) as OrgData;
    const metadata = extractPackageMetadata(ast);

    expect(metadata.license).toBe("MIT");
  });

  it("should parse keywords as comma-separated array", () => {
    const source = `#+TITLE: my-package
#+KEYWORDS: typescript, react, testing
`;
    const ast = parse(source) as OrgData;
    const metadata = extractPackageMetadata(ast);

    expect(metadata.keywords).toEqual(["typescript", "react", "testing"]);
  });

  it("should parse node version into engines.node", () => {
    const source = `#+TITLE: my-package
#+NODE_VERSION: >=18.0.0
`;
    const ast = parse(source) as OrgData;
    const metadata = extractPackageMetadata(ast);

    expect(metadata.engines).toEqual({ node: ">=18.0.0" });
  });

  it("should parse dependencies", () => {
    const source = `#+TITLE: my-package
#+DEPENDENCIES: react@^18.0.0, lodash@4.17.21
`;
    const ast = parse(source) as OrgData;
    const metadata = extractPackageMetadata(ast);

    expect(metadata.dependencies).toEqual({
      react: "^18.0.0",
      lodash: "4.17.21",
    });
  });

  it("should parse peer dependencies", () => {
    const source = `#+TITLE: my-package
#+PEER_DEPS: react@^18.0.0
`;
    const ast = parse(source) as OrgData;
    const metadata = extractPackageMetadata(ast);

    expect(metadata.peerDependencies).toEqual({
      react: "^18.0.0",
    });
  });

  it("should handle hyphenated keywords", () => {
    const source = `#+TITLE: my-package
#+NODE-VERSION: >=20.0.0
#+PEER-DEPS: vite@^5.0.0
`;
    const ast = parse(source) as OrgData;
    const metadata = extractPackageMetadata(ast);

    expect(metadata.engines).toEqual({ node: ">=20.0.0" });
    expect(metadata.peerDependencies).toEqual({ vite: "^5.0.0" });
  });
});

describe("parseDependencies", () => {
  it("should return undefined for empty input", () => {
    expect(parseDependencies(undefined)).toBeUndefined();
    expect(parseDependencies("")).toBeUndefined();
  });

  it("should parse simple dependencies with versions", () => {
    const result = parseDependencies("react@^18.0.0, lodash@4.17.21");
    expect(result).toEqual({
      react: "^18.0.0",
      lodash: "4.17.21",
    });
  });

  it("should use * for dependencies without version", () => {
    const result = parseDependencies("express, cors");
    expect(result).toEqual({
      express: "*",
      cors: "*",
    });
  });

  it("should handle scoped packages", () => {
    const result = parseDependencies("@types/node@^20.0.0, @org/pkg@1.0.0");
    expect(result).toEqual({
      "@types/node": "^20.0.0",
      "@org/pkg": "1.0.0",
    });
  });

  it("should handle scoped packages without version", () => {
    const result = parseDependencies("@types/react, @org/utils");
    expect(result).toEqual({
      "@types/react": "*",
      "@org/utils": "*",
    });
  });

  it("should handle mixed dependencies", () => {
    const result = parseDependencies(
      "react@^18.0.0, @types/react@^18.0.0, lodash"
    );
    expect(result).toEqual({
      react: "^18.0.0",
      "@types/react": "^18.0.0",
      lodash: "*",
    });
  });
});

describe("extractNamedBlocks", () => {
  it("should extract named blocks from org content", () => {
    const source = `#+TITLE: test

#+NAME: main
#+begin_src typescript
export const foo = "bar";
#+end_src

Some content here.

#+NAME: utils
#+begin_src javascript
export function helper() {}
#+end_src
`;
    const ast = parse(source) as OrgData;
    const blocks = extractNamedBlocks(ast);

    expect(blocks).toHaveLength(2);
    expect(blocks[0].name).toBe("main");
    expect(blocks[0].language).toBe("typescript");
    expect(blocks[0].code).toContain("export const foo");
    expect(blocks[1].name).toBe("utils");
    expect(blocks[1].language).toBe("javascript");
  });

  it("should ignore unnamed blocks", () => {
    const source = `#+TITLE: test

#+begin_src typescript
// This block has no name
const x = 1;
#+end_src

#+NAME: main
#+begin_src typescript
export default "hello";
#+end_src
`;
    const ast = parse(source) as OrgData;
    const blocks = extractNamedBlocks(ast);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].name).toBe("main");
  });

  it("should default language to javascript", () => {
    const source = `#+NAME: main
#+begin_src
export default "no language specified";
#+end_src
`;
    const ast = parse(source) as OrgData;
    const blocks = extractNamedBlocks(ast);

    expect(blocks[0].language).toBe("javascript");
  });
});

describe("bumpVersion", () => {
  it("should bump patch version", () => {
    expect(bumpVersion("1.2.3", "patch")).toBe("1.2.4");
  });

  it("should bump minor version and reset patch", () => {
    expect(bumpVersion("1.2.3", "minor")).toBe("1.3.0");
  });

  it("should bump major version and reset minor and patch", () => {
    expect(bumpVersion("1.2.3", "major")).toBe("2.0.0");
  });

  it("should handle versions with fewer parts", () => {
    expect(bumpVersion("1.2", "patch")).toBe("1.2.1");
    expect(bumpVersion("1", "minor")).toBe("1.1.0");
  });

  it("should handle version 0.0.0", () => {
    expect(bumpVersion("0.0.0", "patch")).toBe("0.0.1");
    expect(bumpVersion("0.0.0", "minor")).toBe("0.1.0");
    expect(bumpVersion("0.0.0", "major")).toBe("1.0.0");
  });
});
