/**
 * Cloudflare Pages Adapter tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as childProcess from "node:child_process";
import { CloudflareAdapter, cloudflareAdapter } from "./adapter.ts";
import type {
  DeployContext,
  AdapterConfig,
  PackageMetadata,
  DeployLogger,
} from "@org-press/deploy";

// Mock child_process
vi.mock("node:child_process", () => ({
  spawnSync: vi.fn(),
}));

describe("CloudflareAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset process.env mock
    vi.stubEnv("CF_ACCOUNT_ID", undefined);
    vi.stubEnv("CLOUDFLARE_API_TOKEN", undefined);
    vi.stubEnv("CF_API_TOKEN", undefined);
  });

  describe("constructor", () => {
    it("should create adapter with config", () => {
      const adapter = new CloudflareAdapter({ project: "my-site" });
      expect(adapter.name).toBe("cloudflare");
      expect(adapter.description).toBe("Deploy to Cloudflare Pages");
    });

    it("should accept full config", () => {
      const adapter = new CloudflareAdapter({
        project: "my-site",
        accountId: "abc123",
        branch: "preview",
        commitMessage: "Custom deploy message",
      });
      expect(adapter.name).toBe("cloudflare");
    });
  });

  describe("validate", () => {
    it("should validate successfully when wrangler is available", async () => {
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        status: 0,
        stdout: "wrangler 3.0.0",
        stderr: "",
        pid: 123,
        output: [],
        signal: null,
      });

      const adapter = new CloudflareAdapter({ project: "my-site" });
      const config: AdapterConfig = {
        options: {},
        env: { CLOUDFLARE_API_TOKEN: "test-token" },
      };

      const result = await adapter.validate(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should fail if wrangler is not available", async () => {
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        status: 1,
        stdout: "",
        stderr: "command not found: wrangler",
        pid: 123,
        output: [],
        signal: null,
      });

      const adapter = new CloudflareAdapter({ project: "my-site" });
      const config: AdapterConfig = {
        options: {},
        env: {},
      };

      const result = await adapter.validate(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "wrangler is not available. Install with: npm install -D wrangler"
      );
    });

    it("should fail if project name is missing", async () => {
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        status: 0,
        stdout: "wrangler 3.0.0",
        stderr: "",
        pid: 123,
        output: [],
        signal: null,
      });

      // @ts-expect-error Testing missing required field
      const adapter = new CloudflareAdapter({});
      const config: AdapterConfig = {
        options: {},
        env: {},
      };

      const result = await adapter.validate(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Cloudflare Pages project name is required");
    });

    it("should fail with invalid project name format", async () => {
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        status: 0,
        stdout: "wrangler 3.0.0",
        stderr: "",
        pid: 123,
        output: [],
        signal: null,
      });

      const adapter = new CloudflareAdapter({ project: "Invalid_Project!" });
      const config: AdapterConfig = {
        options: {},
        env: {},
      };

      const result = await adapter.validate(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("Invalid project name"))).toBe(
        true
      );
    });

    it("should accept valid project names", async () => {
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        status: 0,
        stdout: "wrangler 3.0.0",
        stderr: "",
        pid: 123,
        output: [],
        signal: null,
      });

      const validNames = ["mysite", "my-site", "site123", "a", "my-cool-site-2"];

      for (const project of validNames) {
        const adapter = new CloudflareAdapter({ project });
        const config: AdapterConfig = {
          options: {},
          env: { CLOUDFLARE_API_TOKEN: "token" },
        };

        const result = await adapter.validate(config);
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      }
    });

    it("should reject invalid project names", async () => {
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        status: 0,
        stdout: "wrangler 3.0.0",
        stderr: "",
        pid: 123,
        output: [],
        signal: null,
      });

      const invalidNames = ["-mysite", "mysite-", "My_Site", "site!"];

      for (const project of invalidNames) {
        const adapter = new CloudflareAdapter({ project });
        const config: AdapterConfig = {
          options: {},
          env: {},
        };

        const result = await adapter.validate(config);
        expect(result.errors.some((e) => e.includes("Invalid project name"))).toBe(
          true
        );
      }
    });

    it("should warn when no API token is found", async () => {
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        status: 0,
        stdout: "wrangler 3.0.0",
        stderr: "",
        pid: 123,
        output: [],
        signal: null,
      });

      const adapter = new CloudflareAdapter({ project: "my-site" });
      const config: AdapterConfig = {
        options: {},
        env: {},
      };

      const result = await adapter.validate(config);

      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.includes("API_TOKEN"))).toBe(true);
    });

    it("should not warn when CLOUDFLARE_API_TOKEN is set", async () => {
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        status: 0,
        stdout: "wrangler 3.0.0",
        stderr: "",
        pid: 123,
        output: [],
        signal: null,
      });

      const adapter = new CloudflareAdapter({ project: "my-site" });
      const config: AdapterConfig = {
        options: {},
        env: { CLOUDFLARE_API_TOKEN: "test-token" },
      };

      const result = await adapter.validate(config);

      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.includes("API_TOKEN"))).toBe(false);
    });

    it("should not warn when CF_API_TOKEN is set", async () => {
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        status: 0,
        stdout: "wrangler 3.0.0",
        stderr: "",
        pid: 123,
        output: [],
        signal: null,
      });

      const adapter = new CloudflareAdapter({ project: "my-site" });
      const config: AdapterConfig = {
        options: {},
        env: { CF_API_TOKEN: "test-token" },
      };

      const result = await adapter.validate(config);

      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.includes("API_TOKEN"))).toBe(false);
    });

    it("should warn when no account ID is found", async () => {
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        status: 0,
        stdout: "wrangler 3.0.0",
        stderr: "",
        pid: 123,
        output: [],
        signal: null,
      });

      const adapter = new CloudflareAdapter({ project: "my-site" });
      const config: AdapterConfig = {
        options: {},
        env: { CLOUDFLARE_API_TOKEN: "token" },
      };

      const result = await adapter.validate(config);

      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.includes("account ID"))).toBe(true);
    });

    it("should use options over constructor config for validation", async () => {
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        status: 0,
        stdout: "wrangler 3.0.0",
        stderr: "",
        pid: 123,
        output: [],
        signal: null,
      });

      const adapter = new CloudflareAdapter({ project: "constructor-project" });
      const config: AdapterConfig = {
        options: { project: "options-project" },
        env: { CLOUDFLARE_API_TOKEN: "token", CF_ACCOUNT_ID: "account" },
      };

      const result = await adapter.validate(config);

      expect(result.valid).toBe(true);
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
        name: "test-site",
        version: "1.0.0",
        description: "Test site",
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

    it("should return success for dry run without executing wrangler", async () => {
      const adapter = new CloudflareAdapter({ project: "my-site" });
      const context = createContext({ dryRun: true });

      const result = await adapter.deploy(context);

      expect(result.success).toBe(true);
      expect(result.deploymentId).toContain("dry-run-");
      expect(result.url).toBe("https://my-site.pages.dev");
      expect(childProcess.spawnSync).not.toHaveBeenCalled();
    });

    it("should return branch URL for dry run with branch", async () => {
      const adapter = new CloudflareAdapter({
        project: "my-site",
        branch: "preview",
      });
      const context = createContext({ dryRun: true });

      const result = await adapter.deploy(context);

      expect(result.success).toBe(true);
      expect(result.url).toBe("https://preview.my-site.pages.dev");
    });

    it("should call wrangler with correct arguments", async () => {
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        status: 0,
        stdout: "Published to https://my-site.pages.dev",
        stderr: "",
        pid: 123,
        output: [],
        signal: null,
      });

      const adapter = new CloudflareAdapter({ project: "my-site" });
      const context = createContext();

      await adapter.deploy(context);

      expect(childProcess.spawnSync).toHaveBeenCalledWith(
        "npx",
        expect.arrayContaining([
          "wrangler",
          "pages",
          "deploy",
          "/tmp/test-deploy",
          "--project-name",
          "my-site",
          "--commit-message",
          "Deploy from org-press",
        ]),
        expect.objectContaining({
          encoding: "utf-8",
          timeout: 300000,
        })
      );
    });

    it("should include branch argument for branch deployments", async () => {
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        status: 0,
        stdout: "Published to https://preview.my-site.pages.dev",
        stderr: "",
        pid: 123,
        output: [],
        signal: null,
      });

      const adapter = new CloudflareAdapter({
        project: "my-site",
        branch: "preview",
      });
      const context = createContext();

      await adapter.deploy(context);

      expect(childProcess.spawnSync).toHaveBeenCalledWith(
        "npx",
        expect.arrayContaining(["--branch", "preview"]),
        expect.any(Object)
      );
    });

    it("should use custom commit message", async () => {
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        status: 0,
        stdout: "Published to https://my-site.pages.dev",
        stderr: "",
        pid: 123,
        output: [],
        signal: null,
      });

      const adapter = new CloudflareAdapter({
        project: "my-site",
        commitMessage: "Custom deploy message",
      });
      const context = createContext();

      await adapter.deploy(context);

      expect(childProcess.spawnSync).toHaveBeenCalledWith(
        "npx",
        expect.arrayContaining(["--commit-message", "Custom deploy message"]),
        expect.any(Object)
      );
    });

    it("should use adapterConfig options over constructor config", async () => {
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        status: 0,
        stdout: "Published to https://custom-project.pages.dev",
        stderr: "",
        pid: 123,
        output: [],
        signal: null,
      });

      const adapter = new CloudflareAdapter({
        project: "default-project",
        branch: "default-branch",
        commitMessage: "Default message",
      });

      const context = createContext({
        adapterConfig: {
          project: "custom-project",
          branch: "custom-branch",
          commitMessage: "Custom message",
        },
      });

      await adapter.deploy(context);

      expect(childProcess.spawnSync).toHaveBeenCalledWith(
        "npx",
        expect.arrayContaining([
          "--project-name",
          "custom-project",
          "--branch",
          "custom-branch",
          "--commit-message",
          "Custom message",
        ]),
        expect.any(Object)
      );
    });

    it("should return failure when wrangler fails", async () => {
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        status: 1,
        stdout: "",
        stderr: "Authentication failed",
        pid: 123,
        output: [],
        signal: null,
      });

      const adapter = new CloudflareAdapter({ project: "my-site" });
      const context = createContext();

      const result = await adapter.deploy(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Wrangler deployment failed");
      expect(result.error).toContain("Authentication failed");
    });

    it("should parse deployment URL from wrangler output", async () => {
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        status: 0,
        stdout:
          "Uploading... Success!\nPublished to https://abc123.my-site.pages.dev",
        stderr: "",
        pid: 123,
        output: [],
        signal: null,
      });

      const adapter = new CloudflareAdapter({ project: "my-site" });
      const context = createContext();

      const result = await adapter.deploy(context);

      expect(result.success).toBe(true);
      expect(result.url).toBe("https://abc123.my-site.pages.dev");
    });

    it("should fallback to constructed URL if not parsed", async () => {
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        status: 0,
        stdout: "Deployment complete!",
        stderr: "",
        pid: 123,
        output: [],
        signal: null,
      });

      const adapter = new CloudflareAdapter({ project: "my-site" });
      const context = createContext();

      const result = await adapter.deploy(context);

      expect(result.success).toBe(true);
      expect(result.url).toBe("https://my-site.pages.dev");
    });

    it("should construct branch URL when branch is specified", async () => {
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        status: 0,
        stdout: "Deployment complete!",
        stderr: "",
        pid: 123,
        output: [],
        signal: null,
      });

      const adapter = new CloudflareAdapter({
        project: "my-site",
        branch: "staging",
      });
      const context = createContext();

      const result = await adapter.deploy(context);

      expect(result.success).toBe(true);
      expect(result.url).toBe("https://staging.my-site.pages.dev");
    });

    it("should include output in logs", async () => {
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        status: 0,
        stdout: "Uploaded 100 files\nPublished to https://my-site.pages.dev",
        stderr: "",
        pid: 123,
        output: [],
        signal: null,
      });

      const adapter = new CloudflareAdapter({ project: "my-site" });
      const context = createContext();

      const result = await adapter.deploy(context);

      expect(result.success).toBe(true);
      expect(result.logs).toContain(
        "Uploaded 100 files\nPublished to https://my-site.pages.dev"
      );
    });

    it("should set CLOUDFLARE_ACCOUNT_ID in environment when accountId is provided", async () => {
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        status: 0,
        stdout: "Published to https://my-site.pages.dev",
        stderr: "",
        pid: 123,
        output: [],
        signal: null,
      });

      const adapter = new CloudflareAdapter({
        project: "my-site",
        accountId: "test-account-123",
      });
      const context = createContext();

      await adapter.deploy(context);

      expect(childProcess.spawnSync).toHaveBeenCalledWith(
        "npx",
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            CLOUDFLARE_ACCOUNT_ID: "test-account-123",
          }),
        })
      );
    });

    it("should handle exceptions during deployment", async () => {
      vi.mocked(childProcess.spawnSync).mockImplementation(() => {
        throw new Error("Unexpected error");
      });

      const adapter = new CloudflareAdapter({ project: "my-site" });
      const context = createContext();

      const result = await adapter.deploy(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Unexpected error");
    });

    it("should log deployment information", async () => {
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        status: 0,
        stdout: "Published to https://my-site.pages.dev",
        stderr: "",
        pid: 123,
        output: [],
        signal: null,
      });

      const adapter = new CloudflareAdapter({
        project: "my-site",
        branch: "preview",
      });
      const logger = createLogger();
      const context = createContext({ logger });

      await adapter.deploy(context);

      expect(logger.logs.some((l) => l.includes("my-site"))).toBe(true);
      expect(logger.logs.some((l) => l.includes("Branch deployment"))).toBe(
        true
      );
      expect(logger.logs.some((l) => l.includes("preview"))).toBe(true);
    });

    it("should log production deployment when no branch specified", async () => {
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        status: 0,
        stdout: "Published to https://my-site.pages.dev",
        stderr: "",
        pid: 123,
        output: [],
        signal: null,
      });

      const adapter = new CloudflareAdapter({ project: "my-site" });
      const logger = createLogger();
      const context = createContext({ logger });

      await adapter.deploy(context);

      expect(logger.logs.some((l) => l.includes("Production deployment"))).toBe(
        true
      );
    });
  });
});

describe("cloudflareAdapter factory", () => {
  it("should create CloudflareAdapter instance", () => {
    const adapter = cloudflareAdapter({ project: "my-site" });
    expect(adapter).toBeInstanceOf(CloudflareAdapter);
    expect(adapter.name).toBe("cloudflare");
  });

  it("should pass config to adapter", () => {
    const adapter = cloudflareAdapter({
      project: "my-site",
      branch: "preview",
      accountId: "acc123",
      commitMessage: "Deploy!",
    });
    expect(adapter).toBeInstanceOf(CloudflareAdapter);
  });
});
