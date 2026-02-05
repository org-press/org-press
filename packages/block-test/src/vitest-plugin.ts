/**
 * Vitest Plugin for Test Block Integration
 *
 * Provides virtual module resolution for test blocks and
 * integration with the org-press vite plugin.
 */

import type { Plugin } from "vite";
import type { CollectedTestBlock, TestBlockResult } from "./types.ts";
import {
  isVirtualTestId,
  parseVirtualTestId,
  generateVirtualTestId,
} from "./test-collector.ts";
import {
  TEST_RESULTS_VIRTUAL_PREFIX,
  parseTestResultsModuleId,
} from "./types.ts";

/**
 * Virtual test files map (populated by test runner)
 */
const virtualTestFiles = new Map<string, CollectedTestBlock>();

/**
 * Cached test results (populated by test runner)
 */
const cachedResults = new Map<string, TestBlockResult>();

/**
 * Register a test block for virtual resolution
 */
export function registerTestBlock(block: CollectedTestBlock): void {
  virtualTestFiles.set(generateVirtualTestId(block), block);
}

/**
 * Register test results for a block
 */
export function registerTestResults(
  orgFilePath: string,
  blockIndex: number,
  results: TestBlockResult
): void {
  const key = `${orgFilePath}:${blockIndex}`;
  cachedResults.set(key, results);
}

/**
 * Get cached test results for a block
 */
export function getTestResults(
  orgFilePath: string,
  blockIndex: number
): TestBlockResult | undefined {
  const key = `${orgFilePath}:${blockIndex}`;
  return cachedResults.get(key);
}

/**
 * Clear all cached test data
 */
export function clearTestCache(): void {
  virtualTestFiles.clear();
  cachedResults.clear();
}

/**
 * Create a Vite plugin for test block integration
 *
 * This plugin:
 * 1. Resolves virtual test file IDs (virtual:org-test:...)
 * 2. Resolves test results virtual modules (virtual:org-press:test-results:...)
 * 3. Provides test result caching for HMR
 */
export function testBlockVitePlugin(): Plugin {
  return {
    name: "org-press-block-test",
    enforce: "pre",

    resolveId(id: string) {
      // Resolve virtual test files
      if (isVirtualTestId(id)) {
        return "\0" + id;
      }

      // Resolve test results virtual modules
      if (id.startsWith(TEST_RESULTS_VIRTUAL_PREFIX)) {
        return "\0" + id;
      }

      return null;
    },

    load(id: string) {
      // Remove the \0 prefix
      const cleanId = id.startsWith("\0") ? id.slice(1) : id;

      // Load virtual test files
      if (isVirtualTestId(cleanId)) {
        const parsed = parseVirtualTestId(cleanId);
        if (!parsed) return null;

        const block = virtualTestFiles.get(cleanId);
        if (!block) {
          return `// Test block not found: ${cleanId}\nexport default {};`;
        }

        // Return the test code with vitest imports
        return generateTestModule(block);
      }

      // Load test results virtual modules
      if (cleanId.startsWith(TEST_RESULTS_VIRTUAL_PREFIX)) {
        const parsed = parseTestResultsModuleId(cleanId);
        if (!parsed) return null;

        const results = getTestResults(parsed.orgFilePath, parsed.blockIndex);

        if (results) {
          return `export default ${JSON.stringify(results)};`;
        }

        // Return placeholder when no results available
        return `
// Test results not yet available
// Run 'orgp test' to generate results
export default null;
        `.trim();
      }

      return null;
    },

    handleHotUpdate(ctx) {
      // Invalidate test results when org files change
      if (ctx.file.endsWith(".org")) {
        // Find related test result modules and invalidate them
        const modules = ctx.server.moduleGraph.getModulesByFile(ctx.file);
        if (modules) {
          for (const mod of modules) {
            ctx.server.moduleGraph.invalidateModule(mod);
          }
        }
      }
      return;
    },
  };
}

/**
 * Generate a test module from a collected test block
 */
function generateTestModule(block: CollectedTestBlock): string {
  const testName =
    block.blockName || `${block.orgFilePath}:${block.blockIndex}`;

  let code = block.code;

  // Add vitest imports if not present
  const hasVitestImport =
    code.includes("from 'vitest'") ||
    code.includes('from "vitest"') ||
    code.includes("import { describe") ||
    code.includes("import { test") ||
    code.includes("import { it") ||
    code.includes("import { expect");

  const vitestImport = hasVitestImport
    ? ""
    : `import { describe, it, test, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';\n\n`;

  // If the code doesn't have a describe block, wrap it
  const hasDescribe = code.includes("describe(");
  const hasTest = code.includes("test(") || code.includes("it(");

  if (!hasDescribe && !hasTest) {
    // Wrap loose code in a test
    const indented = code
      .split("\n")
      .map((line) => (line.trim() ? "    " + line : line))
      .join("\n");
    code = `describe('${testName}', () => {\n  it('runs test block', () => {\n${indented}\n  });\n});`;
  } else if (!hasDescribe && hasTest) {
    // Wrap tests in a describe
    const indented = code
      .split("\n")
      .map((line) => (line.trim() ? "  " + line : line))
      .join("\n");
    code = `describe('${testName}', () => {\n${indented}\n});`;
  }

  return `// Virtual test module from: ${block.orgFilePath}:${block.blockIndex}
// Block name: ${block.blockName || "(unnamed)"}

${vitestImport}${code}
`;
}

/**
 * Default export for convenience
 */
export default testBlockVitePlugin;
