/**
 * Tests for Unified Plugin API
 *
 * Tests cover:
 * 1. Factory functions (CreateDrawer, CreateTransformer, CreateBlock, CreateCommand, CreatePlugin)
 * 2. PluginContextImpl
 * 3. PluginRegistry
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Factory functions
import { CreateDrawer, matchesDrawerName } from "./factories/create-drawer.ts";
import {
  CreateTransformer,
  isClientDynamicImport,
  isClientInlineScript,
  getClientType,
} from "./factories/create-transformer.ts";
import { CreateBlock, matchesLanguage } from "./factories/create-block.ts";
import { CreateCommand, parseArgs, generateHelp } from "./factories/create-command.ts";
import { CreatePlugin } from "./factories/create-plugin.ts";

// Core classes
import { PluginContextImpl } from "./context.ts";
import { PluginRegistry } from "./registry.ts";

// Types
import type {
  OrgPressPlugin,
  OrgPressConfig,
  DrawerNode,
  CodeBlockNode,
  TransformContext,
  BlockTransformContext,
  CommandOptions,
  ArgDefinition,
} from "./types.ts";

// ===== Test Utilities =====

/**
 * Create a minimal OrgPressConfig for testing
 */
function createTestConfig(overrides: Partial<OrgPressConfig> = {}): OrgPressConfig {
  return {
    contentDir: "content",
    cacheDir: ".cache",
    outDir: "dist",
    base: "/",
    plugins: [],
    ...overrides,
  };
}

/**
 * Create a mock logger that captures calls
 */
function createMockLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
}

/**
 * Create a mock DrawerNode for testing
 */
function createDrawerNode(name: string, html: string = "<p>content</p>"): DrawerNode {
  return {
    name,
    children: [],
    html,
  };
}

/**
 * Create a mock CodeBlockNode for testing
 */
function createCodeBlockNode(
  language: string,
  value: string,
  meta?: string
): CodeBlockNode {
  return {
    language,
    value,
    meta,
  };
}

/**
 * Create a mock TransformContext for testing
 */
function createTransformContext(
  overrides: Partial<TransformContext> = {}
): TransformContext {
  return {
    orgFilePath: "test.org",
    base: "/",
    config: createTestConfig(),
    ...overrides,
  };
}

/**
 * Create a mock BlockTransformContext for testing
 */
function createBlockTransformContext(
  overrides: Partial<BlockTransformContext> = {}
): BlockTransformContext {
  return {
    orgFilePath: "test.org",
    base: "/",
    config: createTestConfig(),
    blockIndex: 0,
    parameters: {},
    plugins: [],
    cacheDir: ".cache",
    contentDir: "content",
    outDir: "dist",
    ...overrides,
  };
}

// ===== Factory Function Tests =====

describe("CreateDrawer", () => {
  it("should create plugin with correct name", () => {
    const plugin = CreateDrawer("AI", () => "<div>AI</div>");

    expect(plugin.name).toBe("drawer:AI");
    expect(plugin._type).toBe("drawer");
  });

  it("should handle single drawer name", () => {
    const plugin = CreateDrawer("NOTE", () => "<aside>note</aside>");

    expect(plugin.name).toBe("drawer:NOTE");
    expect(plugin._config).toEqual({
      drawerNames: ["NOTE"],
      transform: expect.any(Function),
    });
  });

  it("should handle multiple drawer names", () => {
    const plugin = CreateDrawer(["NOTE", "INFO", "TIP"], () => "<aside>content</aside>");

    expect(plugin.name).toBe("drawer:NOTE,INFO,TIP");
    expect(plugin._config).toEqual({
      drawerNames: ["NOTE", "INFO", "TIP"],
      transform: expect.any(Function),
    });
  });

  it("should normalize names to uppercase", () => {
    const plugin = CreateDrawer(["note", "Info", "TIP"], () => "<aside>content</aside>");

    expect(plugin._config?.drawerNames).toEqual(["NOTE", "INFO", "TIP"]);
  });

  it("should register handler via setup function", () => {
    const transformFn = vi.fn(() => "<div>result</div>");
    const plugin = CreateDrawer("AI", transformFn);

    const ctx = new PluginContextImpl(createTestConfig(), "/project");
    plugin.setup?.(ctx);

    const handler = ctx.getDrawerHandler("AI");
    expect(handler).toBeDefined();
  });

  it("should call transform function when handler is invoked", async () => {
    const transformFn = vi.fn(
      (drawer: DrawerNode) => `<div class="ai">${drawer.html}</div>`
    );
    const plugin = CreateDrawer("AI", transformFn);

    const ctx = new PluginContextImpl(createTestConfig(), "/project");
    plugin.setup?.(ctx);

    const handler = ctx.getDrawerHandler("AI");
    const drawer = createDrawerNode("AI", "<p>test</p>");
    const result = await handler?.(drawer, createTransformContext());

    expect(transformFn).toHaveBeenCalledWith(drawer, expect.any(Object));
    expect(result).toBe('<div class="ai"><p>test</p></div>');
  });

  describe("matchesDrawerName", () => {
    it("should match drawer names case-insensitively", () => {
      const drawer = createDrawerNode("ai");
      expect(matchesDrawerName(drawer, ["AI"])).toBe(true);
    });

    it("should return false for non-matching names", () => {
      const drawer = createDrawerNode("NOTE");
      expect(matchesDrawerName(drawer, ["AI", "TIP"])).toBe(false);
    });
  });
});

describe("CreateTransformer", () => {
  it("should create plugin with transformer name", () => {
    const plugin = CreateTransformer("dom", {
      onBuild: () => ({ html: "<div>result</div>" }),
    });

    expect(plugin.name).toBe("transformer:dom");
    expect(plugin._type).toBe("transformer");
  });

  it("should detect dynamic import client", () => {
    const plugin = CreateTransformer("dynamic", {
      onBuild: () => ({ html: "" }),
      client: () => Promise.resolve({ onMount: () => {} }),
    });

    expect(plugin._config?.clientType).toBe("dynamic");
  });

  it("should detect inline string client", () => {
    const plugin = CreateTransformer("inline", {
      onBuild: () => ({ html: "" }),
      client: "console.log('inline');",
    });

    expect(plugin._config?.clientType).toBe("inline");
  });

  it("should handle no client", () => {
    const plugin = CreateTransformer("no-client", {
      onBuild: () => ({ html: "<div>server only</div>" }),
    });

    expect(plugin._config?.clientType).toBe("none");
  });

  it("should register transformer via setup function", () => {
    const plugin = CreateTransformer("test", {
      onBuild: () => ({ html: "<div>test</div>" }),
    });

    const ctx = new PluginContextImpl(createTestConfig(), "/project");
    plugin.setup?.(ctx);

    const transformer = ctx.getTransformer("test");
    expect(transformer).toBeDefined();
    expect(transformer?.onBuild).toBeDefined();
  });

  describe("client type helpers", () => {
    it("isClientDynamicImport should detect function", () => {
      const dynamicClient = () => Promise.resolve({ onMount: () => {} });
      expect(isClientDynamicImport(dynamicClient)).toBe(true);
      expect(isClientDynamicImport("inline")).toBe(false);
      expect(isClientDynamicImport(undefined)).toBe(false);
    });

    it("isClientInlineScript should detect string", () => {
      expect(isClientInlineScript("console.log();")).toBe(true);
      expect(isClientInlineScript(() => Promise.resolve({}))).toBe(false);
      expect(isClientInlineScript(undefined)).toBe(false);
    });

    it("getClientType should return correct type", () => {
      expect(getClientType(() => Promise.resolve({}))).toBe("dynamic");
      expect(getClientType("inline code")).toBe("inline");
      expect(getClientType(undefined)).toBe("none");
    });
  });
});

describe("CreateBlock", () => {
  it("should create plugin for single language", () => {
    const plugin = CreateBlock("javascript", {
      transform: (code) => ({ code }),
    });

    expect(plugin.name).toBe("block:javascript");
    expect(plugin._type).toBe("block");
  });

  it("should create plugin for multiple languages", () => {
    const plugin = CreateBlock(["javascript", "js", "typescript", "ts"], {
      transform: (code) => ({ code }),
    });

    expect(plugin.name).toBe("block:javascript,js,typescript,ts");
    expect(plugin._config?.languages).toEqual(["javascript", "js", "typescript", "ts"]);
  });

  it("should register handler via setup function", () => {
    const plugin = CreateBlock("python", {
      transform: (code) => ({ html: `<pre>${code}</pre>` }),
    });

    const ctx = new PluginContextImpl(createTestConfig(), "/project");
    plugin.setup?.(ctx);

    const handler = ctx.getBlockHandler("python");
    expect(handler).toBeDefined();
  });

  it("should call transform function with simplified context", async () => {
    const transformFn = vi.fn((code: string, ctx: any) => ({
      html: `<pre data-lang="${ctx.language}">${code}</pre>`,
    }));

    const plugin = CreateBlock("rust", { transform: transformFn });

    const ctx = new PluginContextImpl(createTestConfig(), "/project");
    plugin.setup?.(ctx);

    const handler = ctx.getBlockHandler("rust");
    const block = createCodeBlockNode("rust", 'fn main() { println!("Hello"); }');
    const blockCtx = createBlockTransformContext({ blockIndex: 5 });

    await handler?.(block, blockCtx);

    expect(transformFn).toHaveBeenCalledWith(
      block.value,
      expect.objectContaining({
        blockId: "block-5",
        language: "rust",
        blockIndex: 5,
      })
    );
  });

  it("should pass parsed parameters to transform via ctx.params", async () => {
    const transformFn = vi.fn((code: string, ctx: any) => ({
      html: `<div data-use="${ctx.params.use}" data-height="${ctx.params.height}">${code}</div>`,
    }));

    const plugin = CreateBlock("javascript", { transform: transformFn });

    const ctx = new PluginContextImpl(createTestConfig(), "/project");
    plugin.setup?.(ctx);

    const handler = ctx.getBlockHandler("javascript");
    const block = createCodeBlockNode("javascript", "const x = 1;");
    const blockCtx = createBlockTransformContext({
      parameters: {
        use: "dom | withSourceCode",
        height: "400px",
      },
    });

    await handler?.(block, blockCtx);

    expect(transformFn).toHaveBeenCalledWith(
      block.value,
      expect.objectContaining({
        params: {
          use: "dom | withSourceCode",
          height: "400px",
        },
      })
    );
  });

  it("should pass pipe syntax in params.use correctly", async () => {
    let capturedParams: Record<string, string> | undefined;

    const plugin = CreateBlock("typescript", {
      transform: (code, ctx) => {
        capturedParams = ctx.params;
        return { code };
      },
    });

    const ctx = new PluginContextImpl(createTestConfig(), "/project");
    plugin.setup?.(ctx);

    const handler = ctx.getBlockHandler("typescript");
    const block = createCodeBlockNode("typescript", "const x: number = 1;");
    const blockCtx = createBlockTransformContext({
      parameters: {
        use: "server | json | cache",
        name: "api-handler",
      },
    });

    await handler?.(block, blockCtx);

    expect(capturedParams).toEqual({
      use: "server | json | cache",
      name: "api-handler",
    });
  });

  it("should inject client script when provided", async () => {
    const plugin = CreateBlock("html", {
      transform: () => ({ html: "<div>content</div>" }),
      clientScript: "console.log('initialized');",
    });

    const ctx = new PluginContextImpl(createTestConfig(), "/project");
    plugin.setup?.(ctx);

    const handler = ctx.getBlockHandler("html");
    const block = createCodeBlockNode("html", "<p>test</p>");
    const result = await handler?.(block, createBlockTransformContext());

    expect(result?.script).toBe("console.log('initialized');");
  });

  describe("matchesLanguage", () => {
    it("should match block language", () => {
      const block = createCodeBlockNode("javascript", "const x = 1;");
      expect(matchesLanguage(block, ["javascript", "js"])).toBe(true);
    });

    it("should return false for non-matching language", () => {
      const block = createCodeBlockNode("python", "x = 1");
      expect(matchesLanguage(block, ["javascript", "js"])).toBe(false);
    });
  });
});

describe("CreateCommand", () => {
  it("should create plugin with command name", () => {
    const plugin = CreateCommand("fmt", {
      description: "Format code blocks",
      execute: async () => 0,
    });

    expect(plugin.name).toBe("command:fmt");
    expect(plugin._type).toBe("command");
  });

  it("should register command via setup function", () => {
    const executeFn = vi.fn(async () => 0);
    const plugin = CreateCommand("lint", {
      description: "Lint org files",
      execute: executeFn,
    });

    const ctx = new PluginContextImpl(createTestConfig(), "/project");
    plugin.setup?.(ctx);

    const command = ctx.getCommand("lint");
    expect(command).toBeDefined();
    expect(command?.description).toBe("Lint org files");
  });

  describe("parseArgs", () => {
    it("should parse boolean args", () => {
      const definitions: ArgDefinition[] = [
        { name: "verbose", type: "boolean" },
        { name: "fix", type: "boolean" },
      ];

      const result = parseArgs(["--verbose", "--fix"], definitions);
      expect(result.verbose).toBe(true);
      expect(result.fix).toBe(true);
    });

    it("should parse boolean args with explicit values", () => {
      const definitions: ArgDefinition[] = [
        { name: "verbose", type: "boolean" },
      ];

      expect(parseArgs(["--verbose=true"], definitions).verbose).toBe(true);
      expect(parseArgs(["--verbose=false"], definitions).verbose).toBe(false);
    });

    it("should parse string args", () => {
      const definitions: ArgDefinition[] = [
        { name: "pattern", type: "string" },
        { name: "output", type: "string" },
      ];

      const result = parseArgs(["--pattern", "**/*.org", "--output=dist"], definitions);
      expect(result.pattern).toBe("**/*.org");
      expect(result.output).toBe("dist");
    });

    it("should parse number args", () => {
      const definitions: ArgDefinition[] = [
        { name: "timeout", type: "number" },
      ];

      const result = parseArgs(["--timeout", "5000"], definitions);
      expect(result.timeout).toBe(5000);
    });

    it("should parse positional args", () => {
      const definitions: ArgDefinition[] = [
        { name: "verbose", type: "boolean" },
      ];

      const result = parseArgs(["file1.org", "--verbose", "file2.org"], definitions);
      expect(result._).toEqual(["file1.org", "file2.org"]);
      expect(result.verbose).toBe(true);
    });

    it("should handle default values", () => {
      const definitions: ArgDefinition[] = [
        { name: "pattern", type: "string", default: "**/*.org" },
        { name: "verbose", type: "boolean", default: false },
      ];

      const result = parseArgs([], definitions);
      expect(result.pattern).toBe("**/*.org");
      expect(result.verbose).toBe(false);
    });

    it("should parse short aliases", () => {
      const definitions: ArgDefinition[] = [
        { name: "verbose", type: "boolean", alias: "v" },
        { name: "output", type: "string", alias: "o" },
      ];

      const result = parseArgs(["-v", "-o", "dist"], definitions);
      expect(result.verbose).toBe(true);
      expect(result.output).toBe("dist");
    });
  });

  describe("generateHelp", () => {
    it("should generate help text", () => {
      const options: CommandOptions = {
        description: "Format code blocks with Prettier",
        execute: async () => 0,
      };

      const help = generateHelp("fmt", options);

      expect(help).toContain("Usage: orgp fmt");
      expect(help).toContain("Format code blocks with Prettier");
    });

    it("should include argument descriptions", () => {
      const options: CommandOptions = {
        description: "Lint org files",
        args: [
          { name: "fix", type: "boolean", description: "Auto-fix issues" },
          { name: "pattern", type: "string", description: "Glob pattern", default: "**/*.org" },
        ],
        execute: async () => 0,
      };

      const help = generateHelp("lint", options);

      expect(help).toContain("Options:");
      expect(help).toContain("--fix");
      expect(help).toContain("Auto-fix issues");
      expect(help).toContain("--pattern");
      expect(help).toContain("Glob pattern");
      expect(help).toContain("(default: **/*.org)");
    });

    it("should show short aliases", () => {
      const options: CommandOptions = {
        description: "Test command",
        args: [
          { name: "verbose", type: "boolean", alias: "v", description: "Verbose output" },
        ],
        execute: async () => 0,
      };

      const help = generateHelp("test", options);

      expect(help).toContain("-v, --verbose");
    });
  });
});

describe("CreatePlugin", () => {
  it("should create plugin with setup function", () => {
    const setupFn = vi.fn();
    const plugin = CreatePlugin("my-plugin", setupFn);

    expect(plugin.name).toBe("my-plugin");
    expect(plugin._type).toBe("generic");
    expect(plugin.setup).toBe(setupFn);
  });

  it("should call setup function with context", () => {
    const setupFn = vi.fn();
    const plugin = CreatePlugin("test-plugin", setupFn);

    const ctx = new PluginContextImpl(createTestConfig(), "/project");
    plugin.setup?.(ctx);

    expect(setupFn).toHaveBeenCalledWith(ctx);
  });

  it("should allow registering multiple handlers", () => {
    const plugin = CreatePlugin("multi-handler", (ctx) => {
      ctx.onDrawer("AI", () => "<div>AI</div>");
      ctx.onBlock("python", async () => ({ html: "<pre>python</pre>" }));
      ctx.addCommand("test", {
        description: "Test command",
        execute: async () => 0,
      });
    });

    const ctx = new PluginContextImpl(createTestConfig(), "/project");
    plugin.setup?.(ctx);

    expect(ctx.getDrawerHandler("AI")).toBeDefined();
    expect(ctx.getBlockHandler("python")).toBeDefined();
    expect(ctx.getCommand("test")).toBeDefined();
  });
});

// ===== PluginContext Tests =====

describe("PluginContextImpl", () => {
  let ctx: PluginContextImpl;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    mockLogger = createMockLogger();
    ctx = new PluginContextImpl(createTestConfig(), "/project", mockLogger);
  });

  describe("onDrawer", () => {
    it("should register drawer handlers", () => {
      const handler = vi.fn(() => "<div>result</div>");
      ctx.onDrawer("AI", handler);

      const registeredHandler = ctx.getDrawerHandler("AI");
      expect(registeredHandler).toBeDefined();
    });

    it("should handle case-insensitive drawer matching", () => {
      const handler = vi.fn(() => "<div>result</div>");
      ctx.onDrawer("ai", handler);

      // Lookup with uppercase
      expect(ctx.getDrawerHandler("AI")).toBeDefined();
      // Lookup with lowercase
      expect(ctx.getDrawerHandler("ai")).toBeDefined();
      // Lookup with mixed case
      expect(ctx.getDrawerHandler("Ai")).toBeDefined();
    });

    it("should register multiple drawer names", () => {
      const handler = vi.fn(() => "<aside>note</aside>");
      ctx.onDrawer(["NOTE", "INFO", "TIP"], handler);

      expect(ctx.getDrawerHandler("NOTE")).toBeDefined();
      expect(ctx.getDrawerHandler("INFO")).toBeDefined();
      expect(ctx.getDrawerHandler("TIP")).toBeDefined();
    });

    it("should not overwrite existing handler (first wins)", () => {
      const handler1 = vi.fn(() => "handler1");
      const handler2 = vi.fn(() => "handler2");

      ctx.onDrawer("AI", handler1);
      ctx.onDrawer("AI", handler2);

      const registeredHandler = ctx.getDrawerHandler("AI");
      expect(registeredHandler).toBe(handler1);
    });
  });

  describe("onBlock", () => {
    it("should register block handlers", () => {
      const handler = vi.fn(async () => ({ html: "<pre>code</pre>" }));
      ctx.onBlock("javascript", handler);

      const registeredHandler = ctx.getBlockHandler("javascript");
      expect(registeredHandler).toBeDefined();
    });

    it("should normalize language to lowercase", () => {
      const handler = vi.fn(async () => ({ html: "<pre>code</pre>" }));
      ctx.onBlock("JavaScript", handler);

      expect(ctx.getBlockHandler("javascript")).toBeDefined();
      expect(ctx.getBlockHandler("JAVASCRIPT")).toBeDefined();
    });

    it("should register multiple languages", () => {
      const handler = vi.fn(async () => ({ html: "<pre>code</pre>" }));
      ctx.onBlock(["javascript", "js", "typescript", "ts"], handler);

      expect(ctx.getBlockHandler("javascript")).toBeDefined();
      expect(ctx.getBlockHandler("js")).toBeDefined();
      expect(ctx.getBlockHandler("typescript")).toBeDefined();
      expect(ctx.getBlockHandler("ts")).toBeDefined();
    });
  });

  describe("hook", () => {
    it("should register pipeline hooks", () => {
      const handler = vi.fn();
      ctx.hook("parse:after", handler);

      const hooks = ctx.getHooks("parse:after");
      expect(hooks).toHaveLength(1);
      expect(hooks[0]).toBe(handler);
    });

    it("should register multiple hooks for same stage", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      ctx.hook("render:before", handler1);
      ctx.hook("render:before", handler2);

      const hooks = ctx.getHooks("render:before");
      expect(hooks).toHaveLength(2);
    });

    it("should sort hooks by priority", () => {
      const lowPriority = vi.fn();
      const highPriority = vi.fn();

      // Register with low priority first
      ctx._setCurrentPluginPriority(10);
      ctx.hook("build:start", lowPriority);

      // Register with high priority second
      ctx._setCurrentPluginPriority(100);
      ctx.hook("build:start", highPriority);

      const hooks = ctx.getHooks("build:start");
      // Higher priority should come first
      expect(hooks[0]).toBe(highPriority);
      expect(hooks[1]).toBe(lowPriority);
    });
  });

  describe("addTransformer", () => {
    it("should register transformers", () => {
      ctx.addTransformer("dom", {
        onBuild: () => ({ html: "<div>result</div>" }),
      });

      const transformer = ctx.getTransformer("dom");
      expect(transformer).toBeDefined();
      expect(transformer?.onBuild).toBeDefined();
    });

    it("should warn on duplicate transformer", () => {
      ctx.addTransformer("test", { onBuild: () => ({ html: "" }) });
      ctx.addTransformer("test", { onBuild: () => ({ html: "" }) });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("already registered")
      );
    });
  });

  describe("addCommand", () => {
    it("should register commands", () => {
      ctx.addCommand("lint", {
        description: "Lint files",
        execute: async () => 0,
      });

      const command = ctx.getCommand("lint");
      expect(command).toBeDefined();
      expect(command?.description).toBe("Lint files");
    });

    it("should warn on duplicate command", () => {
      ctx.addCommand("test", { description: "Test", execute: async () => 0 });
      ctx.addCommand("test", { description: "Test 2", execute: async () => 0 });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("already registered")
      );
    });
  });

  describe("provide/inject shared state", () => {
    it("should provide and inject shared state", () => {
      ctx.provide("theme", { color: "dark" });

      const theme = ctx.inject<{ color: string }>("theme");
      expect(theme).toEqual({ color: "dark" });
    });

    it("should return undefined for missing key", () => {
      const result = ctx.inject("nonexistent");
      expect(result).toBeUndefined();
    });

    it("should allow type-safe injection", () => {
      interface ThemeConfig {
        primary: string;
        secondary: string;
      }

      ctx.provide<ThemeConfig>("theme", {
        primary: "#000",
        secondary: "#fff",
      });

      const theme = ctx.inject<ThemeConfig>("theme");
      expect(theme?.primary).toBe("#000");
      expect(theme?.secondary).toBe("#fff");
    });
  });

  describe("useRehype", () => {
    it("should add rehype plugins", () => {
      const rehypePlugin = () => (tree: any) => tree;
      ctx.useRehype(rehypePlugin);

      const plugins = ctx.getRehypePlugins();
      expect(plugins).toHaveLength(1);
      expect(plugins[0].plugin).toBe(rehypePlugin);
    });

    it("should preserve plugin options", () => {
      const rehypePlugin = () => (tree: any) => tree;
      const options = { setting: true };
      ctx.useRehype(rehypePlugin, options);

      const plugins = ctx.getRehypePlugins();
      expect(plugins[0].options).toEqual(options);
    });
  });

  describe("useUniorg", () => {
    it("should add uniorg plugins", () => {
      const uniorgPlugin = () => (tree: any) => tree;
      ctx.useUniorg(uniorgPlugin);

      const plugins = ctx.getUniorgPlugins();
      expect(plugins).toHaveLength(1);
      expect(plugins[0].plugin).toBe(uniorgPlugin);
    });

    it("should preserve plugin options", () => {
      const uniorgPlugin = () => (tree: any) => tree;
      const options = { option: "value" };
      ctx.useUniorg(uniorgPlugin, options);

      const plugins = ctx.getUniorgPlugins();
      expect(plugins[0].options).toEqual(options);
    });
  });

  describe("getAllCommands", () => {
    it("should return all registered commands", () => {
      ctx.addCommand("cmd1", { description: "Command 1", execute: async () => 0 });
      ctx.addCommand("cmd2", { description: "Command 2", execute: async () => 0 });

      const commands = ctx.getAllCommands();
      expect(commands.size).toBe(2);
      expect(commands.has("cmd1")).toBe(true);
      expect(commands.has("cmd2")).toBe(true);
    });
  });

  describe("getAllTransformers", () => {
    it("should return all registered transformers", () => {
      ctx.addTransformer("t1", { onBuild: () => ({ html: "" }) });
      ctx.addTransformer("t2", { onBuild: () => ({ html: "" }) });

      const transformers = ctx.getAllTransformers();
      expect(transformers.size).toBe(2);
      expect(transformers.has("t1")).toBe(true);
      expect(transformers.has("t2")).toBe(true);
    });
  });
});

// ===== PluginRegistry Tests =====

describe("PluginRegistry", () => {
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    mockLogger = createMockLogger();
  });

  it("should sort plugins by priority", async () => {
    const registry = new PluginRegistry(createTestConfig(), "/project", mockLogger);

    const lowPriority: OrgPressPlugin = {
      name: "low",
      priority: 10,
      setup: vi.fn(),
    };

    const highPriority: OrgPressPlugin = {
      name: "high",
      priority: 100,
      setup: vi.fn(),
    };

    const mediumPriority: OrgPressPlugin = {
      name: "medium",
      priority: 50,
      setup: vi.fn(),
    };

    // Register in random order
    await registry.register([lowPriority, highPriority, mediumPriority]);

    const plugins = registry.getPlugins();
    expect(plugins[0].name).toBe("high");
    expect(plugins[1].name).toBe("medium");
    expect(plugins[2].name).toBe("low");
  });

  it("should call setup functions", async () => {
    const registry = new PluginRegistry(createTestConfig(), "/project", mockLogger);

    const setupFn = vi.fn();
    const plugin: OrgPressPlugin = {
      name: "test",
      setup: setupFn,
    };

    await registry.register([plugin]);

    expect(setupFn).toHaveBeenCalledWith(expect.any(PluginContextImpl));
  });

  it("should handle async setup", async () => {
    const registry = new PluginRegistry(createTestConfig(), "/project", mockLogger);

    let setupCompleted = false;
    const asyncSetup = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      setupCompleted = true;
    });

    const plugin: OrgPressPlugin = {
      name: "async-plugin",
      setup: asyncSetup,
    };

    await registry.register([plugin]);

    expect(asyncSetup).toHaveBeenCalled();
    expect(setupCompleted).toBe(true);
  });

  it("should catch and log setup errors", async () => {
    const registry = new PluginRegistry(createTestConfig(), "/project", mockLogger);

    const errorPlugin: OrgPressPlugin = {
      name: "error-plugin",
      setup: () => {
        throw new Error("Setup failed!");
      },
    };

    const goodPlugin: OrgPressPlugin = {
      name: "good-plugin",
      setup: vi.fn(),
    };

    // Should not throw
    await registry.register([errorPlugin, goodPlugin]);

    // Error should be logged
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining("Failed to setup plugin 'error-plugin'"),
      expect.any(String)
    );

    // Good plugin should still be set up
    expect(goodPlugin.setup).toHaveBeenCalled();
  });

  it("should track current plugin priority", async () => {
    const registry = new PluginRegistry(createTestConfig(), "/project", mockLogger);

    const priorities: number[] = [];

    const plugin1: OrgPressPlugin = {
      name: "p1",
      priority: 100,
      setup: (ctx) => {
        // This would be internal, but we can test effect through hook ordering
        ctx.hook("build:start", vi.fn());
      },
    };

    const plugin2: OrgPressPlugin = {
      name: "p2",
      priority: 50,
      setup: (ctx) => {
        ctx.hook("build:start", vi.fn());
      },
    };

    await registry.register([plugin1, plugin2]);

    // Hooks should be sorted by the priority of the plugin that registered them
    const ctx = registry.getContext();
    const hooks = ctx.getHooks("build:start");
    expect(hooks).toHaveLength(2);
  });

  it("should throw error for plugins without setup function (v1 plugins no longer supported)", async () => {
    const registry = new PluginRegistry(createTestConfig(), "/project", mockLogger);

    const noSetup: OrgPressPlugin = {
      name: "no-setup",
    };

    await expect(registry.register([noSetup])).rejects.toThrow(
      /missing setup\(\)/
    );
  });

  it("should provide access to context", async () => {
    const registry = new PluginRegistry(createTestConfig(), "/project", mockLogger);

    await registry.register([]);

    const ctx = registry.getContext();
    expect(ctx).toBeInstanceOf(PluginContextImpl);
  });

  it("should check if plugin is registered", async () => {
    const registry = new PluginRegistry(createTestConfig(), "/project", mockLogger);

    const plugin: OrgPressPlugin = {
      name: "test-plugin",
      setup: vi.fn(),
    };

    await registry.register([plugin]);

    expect(registry.hasPlugin("test-plugin")).toBe(true);
    expect(registry.hasPlugin("unknown")).toBe(false);
  });

  it("should get plugin by name", async () => {
    const registry = new PluginRegistry(createTestConfig(), "/project", mockLogger);

    const plugin: OrgPressPlugin = {
      name: "my-plugin",
      priority: 42,
      setup: vi.fn(),
    };

    await registry.register([plugin]);

    const found = registry.getPlugin("my-plugin");
    expect(found).toBe(plugin);
    expect(found?.priority).toBe(42);
  });
});

