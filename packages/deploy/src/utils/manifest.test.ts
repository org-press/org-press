/**
 * Manifest generation tests
 */

import { describe, it, expect } from "vitest";
import { generatePackageJson, validatePackageJson } from "./manifest.ts";
import type { PackageMetadata, NamedBlock } from "../types.ts";

describe("generatePackageJson", () => {
  it("should generate basic package.json", () => {
    const metadata: PackageMetadata = {
      name: "my-package",
      version: "1.0.0",
      description: "A test package",
      author: "Test Author",
      license: "MIT",
    };

    const namedBlocks: NamedBlock[] = [
      { name: "main", language: "javascript", code: "" },
    ];

    const pkg = generatePackageJson(metadata, namedBlocks);

    expect(pkg.name).toBe("my-package");
    expect(pkg.version).toBe("1.0.0");
    expect(pkg.description).toBe("A test package");
    expect(pkg.author).toBe("Test Author");
    expect(pkg.license).toBe("MIT");
    expect(pkg.type).toBe("module");
    expect(pkg.main).toBe("./dist/index.js");
  });

  it("should generate exports map for main block", () => {
    const metadata: PackageMetadata = {
      name: "my-package",
      version: "1.0.0",
    };

    const namedBlocks: NamedBlock[] = [
      { name: "main", language: "javascript", code: "" },
    ];

    const pkg = generatePackageJson(metadata, namedBlocks);
    const exports = pkg.exports as Record<string, any>;

    expect(exports["."]).toEqual({ import: "./dist/index.js" });
  });

  it("should generate exports map for multiple blocks", () => {
    const metadata: PackageMetadata = {
      name: "my-package",
      version: "1.0.0",
    };

    const namedBlocks: NamedBlock[] = [
      { name: "main", language: "javascript", code: "" },
      { name: "utils", language: "javascript", code: "" },
      { name: "types", language: "typescript", code: "" },
    ];

    const pkg = generatePackageJson(metadata, namedBlocks);
    const exports = pkg.exports as Record<string, any>;

    expect(exports["."]).toEqual({ import: "./dist/index.js" });
    expect(exports["./utils"]).toEqual({ import: "./dist/utils.js" });
    expect(exports["./types"]).toEqual({ import: "./dist/types.js" });
  });

  it("should include dependencies", () => {
    const metadata: PackageMetadata = {
      name: "my-package",
      version: "1.0.0",
      dependencies: {
        react: "^18.0.0",
        lodash: "4.17.21",
      },
      peerDependencies: {
        typescript: "^5.0.0",
      },
    };

    const namedBlocks: NamedBlock[] = [
      { name: "main", language: "javascript", code: "" },
    ];

    const pkg = generatePackageJson(metadata, namedBlocks);

    expect(pkg.dependencies).toEqual({
      react: "^18.0.0",
      lodash: "4.17.21",
    });
    expect(pkg.peerDependencies).toEqual({
      typescript: "^5.0.0",
    });
  });

  it("should include repository as object", () => {
    const metadata: PackageMetadata = {
      name: "my-package",
      version: "1.0.0",
      repository: "https://github.com/user/repo.git",
    };

    const namedBlocks: NamedBlock[] = [
      { name: "main", language: "javascript", code: "" },
    ];

    const pkg = generatePackageJson(metadata, namedBlocks);

    expect(pkg.repository).toEqual({
      type: "git",
      url: "https://github.com/user/repo.git",
    });
  });

  it("should include engines", () => {
    const metadata: PackageMetadata = {
      name: "my-package",
      version: "1.0.0",
      engines: { node: ">=18.0.0" },
    };

    const namedBlocks: NamedBlock[] = [
      { name: "main", language: "javascript", code: "" },
    ];

    const pkg = generatePackageJson(metadata, namedBlocks);

    expect(pkg.engines).toEqual({ node: ">=18.0.0" });
  });

  it("should include keywords array", () => {
    const metadata: PackageMetadata = {
      name: "my-package",
      version: "1.0.0",
      keywords: ["typescript", "react", "testing"],
    };

    const namedBlocks: NamedBlock[] = [
      { name: "main", language: "javascript", code: "" },
    ];

    const pkg = generatePackageJson(metadata, namedBlocks);

    expect(pkg.keywords).toEqual(["typescript", "react", "testing"]);
  });

  it("should omit undefined values", () => {
    const metadata: PackageMetadata = {
      name: "my-package",
      version: "1.0.0",
    };

    const namedBlocks: NamedBlock[] = [
      { name: "main", language: "javascript", code: "" },
    ];

    const pkg = generatePackageJson(metadata, namedBlocks);

    expect(pkg.description).toBeUndefined();
    expect(pkg.author).toBeUndefined();
    expect(pkg.repository).toBeUndefined();
    expect(pkg.homepage).toBeUndefined();
    expect(pkg.engines).toBeUndefined();
    expect(pkg.dependencies).toBeUndefined();
    expect(pkg.peerDependencies).toBeUndefined();
    expect(pkg.devDependencies).toBeUndefined();
  });
});

describe("validatePackageJson", () => {
  it("should return no errors for valid package.json", () => {
    const pkg = {
      name: "my-package",
      version: "1.0.0",
    };

    const errors = validatePackageJson(pkg);
    expect(errors).toEqual([]);
  });

  it("should require name field", () => {
    const pkg = {
      version: "1.0.0",
    };

    const errors = validatePackageJson(pkg);
    expect(errors.some((e) => e.includes("name"))).toBe(true);
  });

  it("should require version field", () => {
    const pkg = {
      name: "my-package",
    };

    const errors = validatePackageJson(pkg);
    expect(errors.some((e) => e.includes("version"))).toBe(true);
  });

  it("should validate package name format", () => {
    const pkg = {
      name: "Invalid Name With Spaces",
      version: "1.0.0",
    };

    const errors = validatePackageJson(pkg);
    expect(errors.some((e) => e.includes("Invalid package name"))).toBe(true);
  });

  it("should accept scoped package names", () => {
    const pkg = {
      name: "@org/my-package",
      version: "1.0.0",
    };

    const errors = validatePackageJson(pkg);
    expect(errors).toEqual([]);
  });

  it("should accept hyphenated package names", () => {
    const pkg = {
      name: "my-awesome-package",
      version: "1.0.0",
    };

    const errors = validatePackageJson(pkg);
    expect(errors).toEqual([]);
  });

  it("should validate semver format", () => {
    const pkg = {
      name: "my-package",
      version: "not-a-version",
    };

    const errors = validatePackageJson(pkg);
    expect(errors.some((e) => e.includes("Invalid version"))).toBe(true);
  });

  it("should accept prerelease versions", () => {
    const pkg = {
      name: "my-package",
      version: "1.0.0-beta.1",
    };

    const errors = validatePackageJson(pkg);
    expect(errors).toEqual([]);
  });
});
