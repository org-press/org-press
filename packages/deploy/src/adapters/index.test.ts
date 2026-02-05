/**
 * Adapter registry tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  registerAdapter,
  getAdapter,
  getAdapterNames,
  hasAdapter,
  unregisterAdapter,
  clearAdapters,
  initBuiltinAdapters,
  NpmAdapter,
} from "./index.ts";
import type { DeployAdapter } from "../types.ts";

describe("Adapter Registry", () => {
  // Save initial state and restore after each test
  beforeEach(() => {
    clearAdapters();
  });

  afterEach(() => {
    clearAdapters();
    initBuiltinAdapters();
  });

  describe("initBuiltinAdapters", () => {
    it("should register npm adapter by default", () => {
      initBuiltinAdapters();
      expect(hasAdapter("npm")).toBe(true);
      expect(getAdapter("npm")).toBeInstanceOf(NpmAdapter);
    });

    it("should not re-register if already registered", () => {
      initBuiltinAdapters();
      initBuiltinAdapters(); // Should not throw
      expect(getAdapterNames()).toEqual(["npm"]);
    });
  });

  describe("registerAdapter", () => {
    it("should register a new adapter", () => {
      const mockAdapter: DeployAdapter = {
        name: "test",
        description: "Test adapter",
        validate: async () => ({ valid: true, errors: [], warnings: [] }),
        deploy: async () => ({ success: true }),
      };

      registerAdapter(mockAdapter);

      expect(hasAdapter("test")).toBe(true);
      expect(getAdapter("test")).toBe(mockAdapter);
    });

    it("should throw if adapter is already registered", () => {
      const mockAdapter: DeployAdapter = {
        name: "duplicate",
        description: "Test adapter",
        validate: async () => ({ valid: true, errors: [], warnings: [] }),
        deploy: async () => ({ success: true }),
      };

      registerAdapter(mockAdapter);

      expect(() => registerAdapter(mockAdapter)).toThrow(
        "Adapter 'duplicate' is already registered"
      );
    });
  });

  describe("getAdapter", () => {
    it("should return adapter by name", () => {
      initBuiltinAdapters();
      const adapter = getAdapter("npm");
      expect(adapter).toBeDefined();
      expect(adapter?.name).toBe("npm");
    });

    it("should return undefined for unknown adapter", () => {
      expect(getAdapter("unknown")).toBeUndefined();
    });
  });

  describe("getAdapterNames", () => {
    it("should return empty array when no adapters registered", () => {
      expect(getAdapterNames()).toEqual([]);
    });

    it("should return all registered adapter names", () => {
      initBuiltinAdapters();

      const mockAdapter: DeployAdapter = {
        name: "custom",
        description: "Custom adapter",
        validate: async () => ({ valid: true, errors: [], warnings: [] }),
        deploy: async () => ({ success: true }),
      };
      registerAdapter(mockAdapter);

      const names = getAdapterNames();
      expect(names).toContain("npm");
      expect(names).toContain("custom");
    });
  });

  describe("hasAdapter", () => {
    it("should return true for registered adapter", () => {
      initBuiltinAdapters();
      expect(hasAdapter("npm")).toBe(true);
    });

    it("should return false for unregistered adapter", () => {
      expect(hasAdapter("unknown")).toBe(false);
    });
  });

  describe("unregisterAdapter", () => {
    it("should remove registered adapter", () => {
      initBuiltinAdapters();
      expect(hasAdapter("npm")).toBe(true);

      const result = unregisterAdapter("npm");

      expect(result).toBe(true);
      expect(hasAdapter("npm")).toBe(false);
    });

    it("should return false for unregistered adapter", () => {
      const result = unregisterAdapter("unknown");
      expect(result).toBe(false);
    });
  });

  describe("clearAdapters", () => {
    it("should remove all adapters", () => {
      initBuiltinAdapters();
      const mockAdapter: DeployAdapter = {
        name: "custom",
        description: "Custom adapter",
        validate: async () => ({ valid: true, errors: [], warnings: [] }),
        deploy: async () => ({ success: true }),
      };
      registerAdapter(mockAdapter);

      expect(getAdapterNames().length).toBeGreaterThan(0);

      clearAdapters();

      expect(getAdapterNames()).toEqual([]);
    });
  });
});
