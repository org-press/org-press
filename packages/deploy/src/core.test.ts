/**
 * DeployCore tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  deploy,
  createConsoleLogger,
  createSilentLogger,
  createBufferedLogger,
  type DeployCoreOptions,
} from "./core.ts";
import {
  clearAdapters,
  registerAdapter,
  initBuiltinAdapters,
} from "./adapters/index.ts";
import type { DeployAdapter, DeployContext, AdapterConfig } from "./types.ts";

// Mock fs module
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal() as typeof fs;
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    rmSync: vi.fn(),
  };
});

describe("deploy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAdapters();
    initBuiltinAdapters();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const sampleOrgContent = `
#+TITLE: test-package
#+VERSION: 1.0.0
#+DESCRIPTION: A test package

Some documentation here.

#+NAME: main
#+BEGIN_SRC typescript
export function hello() {
  return "Hello, World!";
}
#+END_SRC
`;

  describe("file handling", () => {
    it("should fail if org file does not exist", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = await deploy({
        orgFile: "/nonexistent/file.org",
        logger: createSilentLogger(),
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("File not found");
    });

    it("should resolve relative file paths", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(sampleOrgContent);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
      vi.mocked(fs.rmSync).mockImplementation(() => {});

      const result = await deploy({
        orgFile: "test.org",
        dryRun: true,
        logger: createSilentLogger(),
      });

      expect(result.success).toBe(true);
    });
  });

  describe("metadata extraction", () => {
    beforeEach(() => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
      vi.mocked(fs.rmSync).mockImplementation(() => {});
    });

    it("should extract package metadata from org file", async () => {
      vi.mocked(fs.readFileSync).mockReturnValue(sampleOrgContent);

      const result = await deploy({
        orgFile: "/test/package.org",
        dryRun: true,
        logger: createSilentLogger(),
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.name).toBe("test-package");
      expect(result.metadata?.version).toBe("1.0.0");
      expect(result.metadata?.description).toBe("A test package");
    });

    it("should use filename as fallback name", async () => {
      const orgWithoutTitle = `
#+VERSION: 1.0.0

#+NAME: main
#+BEGIN_SRC javascript
export const x = 1;
#+END_SRC
`;
      vi.mocked(fs.readFileSync).mockReturnValue(orgWithoutTitle);

      const result = await deploy({
        orgFile: "/test/my-util.org",
        dryRun: true,
        logger: createSilentLogger(),
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.name).toBe("my-util");
    });

    it("should bump version when requested", async () => {
      vi.mocked(fs.readFileSync).mockReturnValue(sampleOrgContent);

      const result = await deploy({
        orgFile: "/test/package.org",
        bump: "patch",
        dryRun: true,
        logger: createSilentLogger(),
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.version).toBe("1.0.1");
    });

    it("should bump minor version", async () => {
      vi.mocked(fs.readFileSync).mockReturnValue(sampleOrgContent);

      const result = await deploy({
        orgFile: "/test/package.org",
        bump: "minor",
        dryRun: true,
        logger: createSilentLogger(),
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.version).toBe("1.1.0");
    });

    it("should bump major version", async () => {
      vi.mocked(fs.readFileSync).mockReturnValue(sampleOrgContent);

      const result = await deploy({
        orgFile: "/test/package.org",
        bump: "major",
        dryRun: true,
        logger: createSilentLogger(),
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.version).toBe("2.0.0");
    });
  });

  describe("named blocks", () => {
    beforeEach(() => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
      vi.mocked(fs.rmSync).mockImplementation(() => {});
    });

    it("should fail if no named blocks found", async () => {
      const orgWithoutBlocks = `
#+TITLE: empty-package
#+VERSION: 1.0.0

Just some text, no code blocks.
`;
      vi.mocked(fs.readFileSync).mockReturnValue(orgWithoutBlocks);

      const result = await deploy({
        orgFile: "/test/empty.org",
        logger: createSilentLogger(),
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("No named blocks found");
    });

    it("should fail if code blocks have no names", async () => {
      const orgWithUnnamedBlocks = `
#+TITLE: package
#+VERSION: 1.0.0

#+BEGIN_SRC javascript
const x = 1;
#+END_SRC
`;
      vi.mocked(fs.readFileSync).mockReturnValue(orgWithUnnamedBlocks);

      const result = await deploy({
        orgFile: "/test/unnamed.org",
        logger: createSilentLogger(),
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("No named blocks found");
    });
  });

  describe("adapter resolution", () => {
    beforeEach(() => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(sampleOrgContent);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
      vi.mocked(fs.rmSync).mockImplementation(() => {});
    });

    it("should use npm adapter by default", async () => {
      const result = await deploy({
        orgFile: "/test/package.org",
        dryRun: true,
        logger: createSilentLogger(),
      });

      expect(result.success).toBe(true);
      expect(result.deploymentId).toContain("dry-run-");
    });

    it("should resolve adapter by name", async () => {
      const result = await deploy({
        orgFile: "/test/package.org",
        adapter: "npm",
        dryRun: true,
        logger: createSilentLogger(),
      });

      expect(result.success).toBe(true);
    });

    it("should fail for unknown adapter name", async () => {
      const result = await deploy({
        orgFile: "/test/package.org",
        adapter: "unknown-adapter",
        dryRun: true,
        logger: createSilentLogger(),
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Adapter 'unknown-adapter' not found");
    });

    it("should use custom adapter instance", async () => {
      const customAdapter: DeployAdapter = {
        name: "custom",
        description: "Custom adapter",
        validate: async () => ({ valid: true, errors: [], warnings: [] }),
        deploy: async (ctx) => ({
          success: true,
          deploymentId: "custom-deploy-123",
          url: "https://custom.example.com",
        }),
      };

      const result = await deploy({
        orgFile: "/test/package.org",
        adapter: customAdapter,
        dryRun: true,
        logger: createSilentLogger(),
      });

      expect(result.success).toBe(true);
      expect(result.deploymentId).toBe("custom-deploy-123");
      expect(result.url).toBe("https://custom.example.com");
    });
  });

  describe("validation", () => {
    beforeEach(() => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(sampleOrgContent);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
      vi.mocked(fs.rmSync).mockImplementation(() => {});
    });

    it("should fail when validation fails", async () => {
      const failingAdapter: DeployAdapter = {
        name: "failing",
        description: "Always fails validation",
        validate: async () => ({
          valid: false,
          errors: ["Missing required config"],
          warnings: [],
        }),
        deploy: async () => ({ success: true }),
      };

      registerAdapter(failingAdapter);

      const result = await deploy({
        orgFile: "/test/package.org",
        adapter: "failing",
        logger: createSilentLogger(),
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Validation failed");
      expect(result.error).toContain("Missing required config");
    });

    it("should skip validation when skipValidation is true", async () => {
      const failingValidationAdapter: DeployAdapter = {
        name: "skip-validate",
        description: "Would fail validation",
        validate: async () => ({
          valid: false,
          errors: ["Would fail"],
          warnings: [],
        }),
        deploy: async () => ({
          success: true,
          deploymentId: "skipped-validation",
        }),
      };

      registerAdapter(failingValidationAdapter);

      const result = await deploy({
        orgFile: "/test/package.org",
        adapter: "skip-validate",
        skipValidation: true,
        dryRun: true,
        logger: createSilentLogger(),
      });

      expect(result.success).toBe(true);
      expect(result.deploymentId).toBe("skipped-validation");
    });

    it("should log warnings from validation", async () => {
      const warningAdapter: DeployAdapter = {
        name: "warning",
        description: "Has warnings",
        validate: async () => ({
          valid: true,
          errors: [],
          warnings: ["Consider setting TOKEN"],
        }),
        deploy: async () => ({ success: true }),
      };

      registerAdapter(warningAdapter);
      const logger = createBufferedLogger();

      const result = await deploy({
        orgFile: "/test/package.org",
        adapter: "warning",
        dryRun: true,
        logger,
      });

      expect(result.success).toBe(true);
      expect(logger.logs.some((l) => l.includes("Consider setting TOKEN"))).toBe(true);
    });
  });

  describe("build phase", () => {
    beforeEach(() => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(sampleOrgContent);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
      vi.mocked(fs.rmSync).mockImplementation(() => {});
    });

    it("should build package and return files list", async () => {
      const result = await deploy({
        orgFile: "/test/package.org",
        dryRun: true,
        logger: createSilentLogger(),
      });

      expect(result.success).toBe(true);
      expect(result.files).toBeDefined();
      expect(result.files).toContain("dist/index.js");
      expect(result.files).toContain("package.json");
      expect(result.files).toContain("README.md");
    });

    it("should respect noReadme option", async () => {
      const result = await deploy({
        orgFile: "/test/package.org",
        noReadme: true,
        dryRun: true,
        logger: createSilentLogger(),
      });

      expect(result.success).toBe(true);
      expect(result.files).not.toContain("README.md");
    });

    it("should use custom outDir when specified", async () => {
      const result = await deploy({
        orgFile: "/test/package.org",
        outDir: "/custom/output",
        dryRun: true,
        logger: createSilentLogger(),
      });

      expect(result.success).toBe(true);
      expect(result.outDir).toBe("/custom/output");
    });

    it("should skip build when skipBuild is true and outDir exists", async () => {
      // outDir exists
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        return String(p).includes(".deploy") || String(p).endsWith(".org");
      });

      const result = await deploy({
        orgFile: "/test/package.org",
        skipBuild: true,
        dryRun: true,
        logger: createSilentLogger(),
      });

      expect(result.success).toBe(true);
      // No files because we skipped build
      expect(result.files).toEqual([]);
    });

    it("should fail when skipBuild is true but outDir does not exist", async () => {
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        return String(p).endsWith(".org");
      });

      const result = await deploy({
        orgFile: "/test/package.org",
        skipBuild: true,
        logger: createSilentLogger(),
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Output directory not found");
    });
  });

  describe("deployment phase", () => {
    beforeEach(() => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(sampleOrgContent);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
      vi.mocked(fs.rmSync).mockImplementation(() => {});
    });

    it("should pass adapter config to deploy", async () => {
      let capturedContext: DeployContext | undefined;

      const captureAdapter: DeployAdapter = {
        name: "capture",
        description: "Captures context",
        validate: async () => ({ valid: true, errors: [], warnings: [] }),
        deploy: async (ctx) => {
          capturedContext = ctx;
          return { success: true };
        },
      };

      registerAdapter(captureAdapter);

      await deploy({
        orgFile: "/test/package.org",
        adapter: "capture",
        registry: "https://custom.registry.com",
        tag: "beta",
        access: "public",
        environment: "preview",
        dryRun: false,
        logger: createSilentLogger(),
      });

      expect(capturedContext).toBeDefined();
      expect(capturedContext!.adapterConfig.registry).toBe("https://custom.registry.com");
      expect(capturedContext!.adapterConfig.tag).toBe("beta");
      expect(capturedContext!.adapterConfig.access).toBe("public");
      expect(capturedContext!.environment).toBe("preview");
      expect(capturedContext!.dryRun).toBe(false);
    });

    it("should return deployment result", async () => {
      const successAdapter: DeployAdapter = {
        name: "success",
        description: "Succeeds",
        validate: async () => ({ valid: true, errors: [], warnings: [] }),
        deploy: async () => ({
          success: true,
          deploymentId: "deploy-123",
          url: "https://example.com/package",
          logs: ["Published successfully"],
        }),
      };

      registerAdapter(successAdapter);

      const result = await deploy({
        orgFile: "/test/package.org",
        adapter: "success",
        logger: createSilentLogger(),
      });

      expect(result.success).toBe(true);
      expect(result.deploymentId).toBe("deploy-123");
      expect(result.url).toBe("https://example.com/package");
      expect(result.logs).toContain("Published successfully");
    });

    it("should return error on deployment failure", async () => {
      const failAdapter: DeployAdapter = {
        name: "fail",
        description: "Fails deploy",
        validate: async () => ({ valid: true, errors: [], warnings: [] }),
        deploy: async () => ({
          success: false,
          error: "Deployment failed: network error",
        }),
      };

      registerAdapter(failAdapter);

      const result = await deploy({
        orgFile: "/test/package.org",
        adapter: "fail",
        logger: createSilentLogger(),
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Deployment failed: network error");
    });
  });
});

describe("createConsoleLogger", () => {
  it("should create a logger with all methods", () => {
    const logger = createConsoleLogger();

    expect(typeof logger.info).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.debug).toBe("function");
  });

  it("should log to console with prefix", () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const logger = createConsoleLogger();

    logger.info("test message");

    expect(consoleSpy).toHaveBeenCalledWith("[deploy] test message");
    consoleSpy.mockRestore();
  });

  it("should log warnings", () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const logger = createConsoleLogger();

    logger.warn("warning message");

    expect(consoleSpy).toHaveBeenCalledWith("[deploy] WARN: warning message");
    consoleSpy.mockRestore();
  });

  it("should log errors", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logger = createConsoleLogger();

    logger.error("error message");

    expect(consoleSpy).toHaveBeenCalledWith("[deploy] ERROR: error message");
    consoleSpy.mockRestore();
  });

  it("should only log debug in verbose mode", () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const normalLogger = createConsoleLogger({ verbose: false });
    normalLogger.debug("debug message");
    expect(consoleSpy).not.toHaveBeenCalled();

    const verboseLogger = createConsoleLogger({ verbose: true });
    verboseLogger.debug("debug message");
    expect(consoleSpy).toHaveBeenCalledWith("[deploy] DEBUG: debug message");

    consoleSpy.mockRestore();
  });
});

describe("createSilentLogger", () => {
  it("should create a logger that does nothing", () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const logger = createSilentLogger();

    logger.info("test");
    logger.warn("test");
    logger.error("test");
    logger.debug("test");

    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe("createBufferedLogger", () => {
  it("should capture all log messages", () => {
    const logger = createBufferedLogger();

    logger.info("info message");
    logger.warn("warn message");
    logger.error("error message");
    logger.debug("debug message");

    expect(logger.logs).toContain("INFO: info message");
    expect(logger.logs).toContain("WARN: warn message");
    expect(logger.logs).toContain("ERROR: error message");
    expect(logger.logs).toContain("DEBUG: debug message");
  });
});
