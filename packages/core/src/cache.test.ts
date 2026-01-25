import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { vol } from "memfs";
import {
  setFileSystem,
  resetFileSystem,
  cacheServerResult,
  readCachedServerResult,
  invalidateServerResultCache,
  getCachePath,
  sanitizePath,
  getLanguageExtension,
  getBlockHash,
} from "./cache.ts";

describe("Cache Utilities", () => {
  describe("getLanguageExtension", () => {
    it("should return correct extension for known languages", () => {
      expect(getLanguageExtension("javascript")).toBe("js");
      expect(getLanguageExtension("typescript")).toBe("ts");
      expect(getLanguageExtension("python")).toBe("py");
      expect(getLanguageExtension("rust")).toBe("rs");
    });

    it("should return lowercase language for unknown languages", () => {
      expect(getLanguageExtension("unknownlang")).toBe("unknownlang");
      expect(getLanguageExtension("UPPERCASE")).toBe("uppercase");
    });
  });

  describe("sanitizePath", () => {
    it("should remove .org extension", () => {
      expect(sanitizePath("content/post.org")).toBe("content/post");
    });

    it("should handle spaces in paths", () => {
      expect(sanitizePath("content/My Post.org")).toBe("content/my-post");
    });

    it("should normalize paths", () => {
      expect(sanitizePath("./content/post.org")).toBe("content/post");
      expect(sanitizePath("../content/post.org")).toBe("content/post");
    });
  });

  describe("getBlockHash", () => {
    it("should return deterministic hash", () => {
      const code = "console.log('hello');";
      const hash1 = getBlockHash(code);
      const hash2 = getBlockHash(code);

      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(8);
    });

    it("should return different hashes for different code", () => {
      const hash1 = getBlockHash("code1");
      const hash2 = getBlockHash("code2");

      expect(hash1).not.toBe(hash2);
    });
  });

  describe("getCachePath", () => {
    it("should generate correct path for named block", () => {
      const path = getCachePath("content/post.org", "my-function", "javascript");

      expect(path).toContain("content/post");
      expect(path).toContain("my-function.js");
    });

    it("should generate correct path for unnamed block", () => {
      const path = getCachePath("content/post.org", undefined, "javascript", "code");

      expect(path).toContain("content/post");
      expect(path).toMatch(/[a-f0-9]{8}\.js$/);
    });
  });
});

describe("Server Result Caching", () => {
  beforeEach(() => {
    // Use memfs for testing
    vol.reset();
    setFileSystem(vol as any);
  });

  afterEach(() => {
    resetFileSystem();
  });

  it("should cache server execution results", async () => {
    const testResult = { foo: "bar", count: 42 };

    await cacheServerResult("content/test.org", 0, testResult);
    const cached = await readCachedServerResult("content/test.org", 0);

    expect(cached).toEqual(testResult);
  });

  it("should cache primitive results", async () => {
    await cacheServerResult("content/test.org", 0, "hello");
    const cached = await readCachedServerResult("content/test.org", 0);

    expect(cached).toBe("hello");
  });

  it("should cache array results", async () => {
    const testResult = [1, 2, 3];

    await cacheServerResult("content/test.org", 0, testResult);
    const cached = await readCachedServerResult("content/test.org", 0);

    expect(cached).toEqual(testResult);
  });

  it("should return null for non-existent cache", async () => {
    const cached = await readCachedServerResult("content/nonexistent.org", 0);

    expect(cached).toBeNull();
  });

  it("should cache multiple blocks separately", async () => {
    await cacheServerResult("content/test.org", 0, "result1");
    await cacheServerResult("content/test.org", 1, "result2");
    await cacheServerResult("content/test.org", 2, "result3");

    const cached0 = await readCachedServerResult("content/test.org", 0);
    const cached1 = await readCachedServerResult("content/test.org", 1);
    const cached2 = await readCachedServerResult("content/test.org", 2);

    expect(cached0).toBe("result1");
    expect(cached1).toBe("result2");
    expect(cached2).toBe("result3");
  });

  it("should overwrite existing cache", async () => {
    await cacheServerResult("content/test.org", 0, "old");
    await cacheServerResult("content/test.org", 0, "new");

    const cached = await readCachedServerResult("content/test.org", 0);

    expect(cached).toBe("new");
  });

  it("should invalidate cache for file", async () => {
    await cacheServerResult("content/test.org", 0, "result1");
    await cacheServerResult("content/test.org", 1, "result2");
    await cacheServerResult("content/other.org", 0, "other");

    await invalidateServerResultCache("content/test.org");

    const cached1 = await readCachedServerResult("content/test.org", 0);
    const cached2 = await readCachedServerResult("content/test.org", 1);
    const cachedOther = await readCachedServerResult("content/other.org", 0);

    expect(cached1).toBeNull();
    expect(cached2).toBeNull();
    expect(cachedOther).toBe("other");
  });

  it("should handle invalidation of non-existent file gracefully", async () => {
    // Should not throw
    await expect(
      invalidateServerResultCache("content/nonexistent.org")
    ).resolves.not.toThrow();
  });
});
