/**
 * NPM Adapter tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as childProcess from "node:child_process";
import { NpmAdapter, npmAdapter } from "./npm.ts";
import type {
  DeployContext,
  AdapterConfig,
  PackageMetadata,
  DeployLogger,
} from "../types.ts";

// Mock child_process
vi.mock("node:child_process", () => ({
  spawnSync: vi.fn(),
}));

describe("NpmAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should create adapter with default options", () => {
      const adapter = new NpmAdapter();
      expect(adapter.name).toBe("npm");
      expect(adapter.description).toBe("Publish to npm registry");
    });

    it("should accept custom options", () => {
      const adapter = new NpmAdapter({
        registry: "https://custom.registry.com",
        tag: "beta",
        access: "restricted",
      });
      expect(adapter.name).toBe("npm");
    });
  });

  describe("validate", () => {
    it("should validate successfully when npm is available", async () => {
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        status: 0,
        stdout: "9.0.0",
        stderr: "",
        pid: 123,
        output: [],
        signal: null,
      });

      const adapter = new NpmAdapter();
      const config: AdapterConfig = {
        options: {},
        env: { NPM_TOKEN: "test-token" },
      };

      const result = await adapter.validate(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should fail if npm is not available", async () => {
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        status: 1,
        stdout: "",
        stderr: "npm not found",
        pid: 123,
        output: [],
        signal: null,
      });

      const adapter = new NpmAdapter();
      const config: AdapterConfig = {
        options: {},
        env: {},
      };

      const result = await adapter.validate(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("npm is not available in PATH");
    });

    it("should fail with invalid registry URL", async () => {
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        status: 0,
        stdout: "9.0.0",
        stderr: "",
        pid: 123,
        output: [],
        signal: null,
      });

      const adapter = new NpmAdapter();
      const config: AdapterConfig = {
        options: { registry: "not-a-url" },
        env: {},
      };

      const result = await adapter.validate(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("Invalid registry URL"))).toBe(
        true
      );
    });

    it("should fail with invalid access level", async () => {
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        status: 0,
        stdout: "9.0.0",
        stderr: "",
        pid: 123,
        output: [],
        signal: null,
      });

      const adapter = new NpmAdapter();
      const config: AdapterConfig = {
        options: { access: "invalid" },
        env: {},
      };

      const result = await adapter.validate(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("Invalid access level"))).toBe(
        true
      );
    });

    it("should warn when no NPM_TOKEN is set for npmjs.org", async () => {
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        status: 0,
        stdout: "9.0.0",
        stderr: "",
        pid: 123,
        output: [],
        signal: null,
      });

      const adapter = new NpmAdapter();
      const config: AdapterConfig = {
        options: {},
        env: {},
      };

      const result = await adapter.validate(config);

      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.includes("NPM_TOKEN"))).toBe(true);
    });
  });

  describe("deploy", () => {
    const createLogger = (): DeployLogger & { logs: string[] } => {
      const logs: string[] = [];
      return {
        logs,
        info: (msg) => logs.push(`INFO: ${msg}`),
        warn: (msg) => logs.push(`WARN: ${msg}`),
        error: (msg) => logs.push(`ERROR: ${msg}`),
        debug: (msg) => logs.push(`DEBUG: ${msg}`),
      };
    };

    const createContext = (
      overrides: Partial<DeployContext> = {}
    ): DeployContext => {
      const metadata: PackageMetadata = {
        name: "test-package",
        version: "1.0.0",
        description: "Test package",
      };

      return {
        outDir: "/tmp/test-deploy",
        metadata,
        adapterConfig: {},
        environment: "production",
        dryRun: false,
        logger: createLogger(),
        ...overrides,
      };
    };

    it("should return success for dry run without calling npm", async () => {
      const adapter = new NpmAdapter();
      const context = createContext({ dryRun: true });

      const result = await adapter.deploy(context);

      expect(result.success).toBe(true);
      expect(result.deploymentId).toContain("dry-run-");
      expect(childProcess.spawnSync).not.toHaveBeenCalled();
    });

    it("should call npm publish with correct arguments", async () => {
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        status: 0,
        stdout: "+ test-package@1.0.0",
        stderr: "",
        pid: 123,
        output: [],
        signal: null,
      });

      const adapter = new NpmAdapter({
        registry: "https://registry.npmjs.org",
        tag: "latest",
        access: "public",
      });

      const context = createContext();
      const result = await adapter.deploy(context);

      expect(result.success).toBe(true);
      expect(childProcess.spawnSync).toHaveBeenCalledWith(
        "npm",
        ["publish", "--tag", "latest", "--access", "public"],
        expect.objectContaining({
          cwd: "/tmp/test-deploy",
          encoding: "utf-8",
          env: expect.objectContaining({
            npm_config_registry: "https://registry.npmjs.org",
          }),
        })
      );
    });

    it("should use adapterConfig options over constructor options", async () => {
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        status: 0,
        stdout: "+ test-package@1.0.0",
        stderr: "",
        pid: 123,
        output: [],
        signal: null,
      });

      const adapter = new NpmAdapter({
        registry: "https://default.registry.com",
        tag: "default",
      });

      const context = createContext({
        adapterConfig: {
          registry: "https://custom.registry.com",
          tag: "custom",
        },
      });

      await adapter.deploy(context);

      expect(childProcess.spawnSync).toHaveBeenCalledWith(
        "npm",
        ["publish", "--tag", "custom"],
        expect.objectContaining({
          env: expect.objectContaining({
            npm_config_registry: "https://custom.registry.com",
          }),
        })
      );
    });

    it("should return failure when npm publish fails", async () => {
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        status: 1,
        stdout: "",
        stderr: "ENEEDAUTH",
        pid: 123,
        output: [],
        signal: null,
      });

      const adapter = new NpmAdapter();
      const context = createContext();
      const result = await adapter.deploy(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain("npm publish failed");
    });

    it("should return npm URL for npmjs.org registry", async () => {
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        status: 0,
        stdout: "+ test-package@1.0.0",
        stderr: "",
        pid: 123,
        output: [],
        signal: null,
      });

      const adapter = new NpmAdapter({
        registry: "https://registry.npmjs.org",
      });

      const context = createContext();
      const result = await adapter.deploy(context);

      expect(result.success).toBe(true);
      expect(result.url).toBe("https://www.npmjs.com/package/test-package");
    });

    it("should return undefined URL for custom registries", async () => {
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        status: 0,
        stdout: "+ test-package@1.0.0",
        stderr: "",
        pid: 123,
        output: [],
        signal: null,
      });

      const adapter = new NpmAdapter({
        registry: "https://custom.registry.com",
      });

      const context = createContext();
      const result = await adapter.deploy(context);

      expect(result.success).toBe(true);
      expect(result.url).toBeUndefined();
    });
  });
});

describe("npmAdapter factory", () => {
  it("should create NpmAdapter instance", () => {
    const adapter = npmAdapter({ tag: "beta" });
    expect(adapter).toBeInstanceOf(NpmAdapter);
    expect(adapter.name).toBe("npm");
  });
});
