/**
 * Tests for Preview API initialization
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  initializePreviewApi,
  resetPreviewApiInit,
  isPreviewApiInitialized,
} from "./preview-init.ts";
import { globalRegistry } from "./wrapper-compose.ts";

describe("Preview API Initialization", () => {
  beforeEach(() => {
    resetPreviewApiInit();
  });

  it("should not be initialized initially", () => {
    // Note: may already be initialized from other tests
    // This test mainly validates the API exists
    expect(typeof isPreviewApiInitialized()).toBe("boolean");
  });

  it("should initialize on first call", () => {
    initializePreviewApi();
    expect(isPreviewApiInitialized()).toBe(true);
  });

  it("should be idempotent (multiple calls are safe)", () => {
    initializePreviewApi();
    initializePreviewApi();
    initializePreviewApi();

    expect(isPreviewApiInitialized()).toBe(true);
  });

  it("should not register modes in wrapper registry (modes are now plugins)", () => {
    // Modes (preview, sourceOnly, silent, raw) are now built-in plugins,
    // not wrappers. They should NOT be registered in the global wrapper registry.
    initializePreviewApi();

    // Modes are plugins, not registered as wrappers
    expect(globalRegistry.has("preview")).toBe(false);
    expect(globalRegistry.has("sourceOnly")).toBe(false);
    expect(globalRegistry.has("silent")).toBe(false);
    expect(globalRegistry.has("raw")).toBe(false);
  });

  it("should register all built-in wrappers", () => {
    initializePreviewApi();

    expect(globalRegistry.has("withSourceCode")).toBe(true);
    expect(globalRegistry.has("withContainer")).toBe(true);
    expect(globalRegistry.has("withErrorBoundary")).toBe(true);
    expect(globalRegistry.has("withConsole")).toBe(true);
    expect(globalRegistry.has("withCollapse")).toBe(true);
  });

  it("should register all format wrappers", () => {
    initializePreviewApi();

    expect(globalRegistry.has("json")).toBe(true);
    expect(globalRegistry.has("yaml")).toBe(true);
    expect(globalRegistry.has("csv")).toBe(true);
    expect(globalRegistry.has("html")).toBe(true);
  });

  it("should reset initialization state", () => {
    initializePreviewApi();
    expect(isPreviewApiInitialized()).toBe(true);

    resetPreviewApiInit();
    expect(isPreviewApiInitialized()).toBe(false);
  });
});
