/**
 * Test Runner
 *
 * Executes test blocks using Vitest programmatic API.
 * Collects test blocks from org files and runs them as virtual test files.
 */

import * as path from "node:path";
import * as fs from "node:fs";
import { createRequire } from "node:module";
import type { TestRunnerOptions, TestRunResult, TestBlockResult } from "./types.ts";
import { collectTestBlocks, generateVirtualTestId } from "./test-collector.ts";
import type { CollectedTestBlock } from "./types.ts";

// Use createRequire to bypass Vite's module runner hooks
// This ensures vitest/node is loaded via Node.js, not through Vite's SSR
const require = createRequire(import.meta.url);

/**
 * Run tests from org file test blocks
 *
 * @param options - Test runner options
 * @returns Exit code (0 for success, 1 for failure)
 */
export async function runTests(options: TestRunnerOptions): Promise<number> {
  const { contentDir, projectRoot, watch, coverage, name, files } = options;

  console.log("\n[block-test] Collecting test blocks...\n");

  // Collect all test blocks
  const testBlocks = await collectTestBlocks(contentDir, projectRoot, {
    files,
    name,
  });

  if (testBlocks.length === 0) {
    console.log("[block-test] No test blocks found.");
    console.log("  Hint: Add :use test parameter to your code blocks");
    console.log("  Example: #+begin_src typescript :use test\n");
    return 0;
  }

  console.log(`[block-test] Found ${testBlocks.length} test block(s):\n`);

  for (const block of testBlocks) {
    const name = block.blockName ? `(${block.blockName})` : "";
    console.log(`  - ${block.orgFilePath}:${block.blockIndex} ${name}`);
  }

  console.log("");

  // Generate virtual test files map
  const virtualTestFiles = new Map<string, CollectedTestBlock>();
  for (const block of testBlocks) {
    virtualTestFiles.set(generateVirtualTestId(block), block);
  }

  // Create temporary test entry files in .org-press-test (not node_modules, to avoid default excludes)
  const tempDir = path.join(projectRoot, ".org-press-test");
  fs.mkdirSync(tempDir, { recursive: true });

  const testEntryFiles: string[] = [];

  for (const block of testBlocks) {
    const entryFile = path.join(
      tempDir,
      `${block.orgFilePath.replace(/\//g, "_")}_${block.blockIndex}.test.ts`
    );

    // Write test file that imports vitest and runs the test code
    const testContent = generateTestFile(block, projectRoot);
    fs.writeFileSync(entryFile, testContent);
    testEntryFiles.push(entryFile);
  }

  try {
    // Use require to load vitest/node, bypassing Vite's module runner hooks
    // This is necessary because when loaded via Vite's ssrLoadModule,
    // dynamic imports get routed through Vite's (now closed) module runner
    const { startVitest } = require("vitest/node") as typeof import("vitest/node");

    // Configure Vitest
    const vitest = await startVitest("test", testEntryFiles, {
      watch: watch ?? false,
      coverage: {
        enabled: coverage ?? false,
        reporter: coverage ? ["text", "json-summary"] : [],
      },
      // Suppress banner for cleaner output
      reporters: ["default"],
      // Use project root for resolution
      root: projectRoot,
      // Explicitly include our generated test files (they're in node_modules/.cache)
      include: testEntryFiles,
      // Don't pass through to next config
      passWithNoTests: true,
    });

    if (!vitest) {
      console.error("[block-test] Failed to start Vitest");
      return 1;
    }

    // Wait for tests to complete
    await vitest.close();

    // Get results
    const state = vitest.state;
    const results = state?.getFiles() ?? [];

    let totalPassed = 0;
    let totalFailed = 0;
    let totalSkipped = 0;

    for (const file of results) {
      const tasks = file.tasks ?? [];
      for (const task of tasks) {
        if (task.result?.state === "pass") {
          totalPassed++;
        } else if (task.result?.state === "fail") {
          totalFailed++;
        } else {
          totalSkipped++;
        }
      }
    }

    console.log("\n[block-test] Summary:");
    console.log(`  Passed: ${totalPassed}`);
    console.log(`  Failed: ${totalFailed}`);
    console.log(`  Skipped: ${totalSkipped}`);
    console.log("");

    return totalFailed > 0 ? 1 : 0;
  } catch (error) {
    console.error("[block-test] Error running tests:", error);
    return 1;
  } finally {
    // Cleanup temp files unless in watch mode
    if (!watch) {
      try {
        for (const file of testEntryFiles) {
          if (fs.existsSync(file)) {
            fs.unlinkSync(file);
          }
        }
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

/**
 * Generate a test file from a collected test block
 */
function generateTestFile(block: CollectedTestBlock, projectRoot: string): string {
  const testName = block.blockName || `${block.orgFilePath}:${block.blockIndex}`;

  // Rewrite .org imports to use the virtual module system
  // In practice this would need to hook into org-press vite plugin
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
    code = `describe('${testName}', () => {\n  it('runs test block', () => {\n${indent(code, 4)}\n  });\n});`;
  } else if (!hasDescribe && hasTest) {
    // Wrap tests in a describe
    code = `describe('${testName}', () => {\n${indent(code, 2)}\n});`;
  }

  return `// Generated test file from: ${block.orgFilePath}:${block.blockIndex}
// Block name: ${block.blockName || "(unnamed)"}

${vitestImport}${code}
`;
}

/**
 * Indent each line of code by a number of spaces
 */
function indent(code: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  return code
    .split("\n")
    .map((line) => (line.trim() ? pad + line : line))
    .join("\n");
}

/**
 * Collect test results from Vitest state
 */
export function collectResults(
  testBlocks: CollectedTestBlock[],
  vitestState: any
): TestRunResult {
  const blocks: TestBlockResult[] = [];
  const files = vitestState?.getFiles() ?? [];

  let totalPassed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  for (let i = 0; i < testBlocks.length; i++) {
    const block = testBlocks[i];
    const file = files[i];

    if (!file) continue;

    const tests = (file.tasks ?? []).map((task: any) => ({
      name: task.name,
      status:
        task.result?.state === "pass"
          ? "pass"
          : task.result?.state === "fail"
            ? "fail"
            : "skip",
      duration: task.result?.duration ?? 0,
      error: task.result?.errors?.[0]
        ? {
            message: task.result.errors[0].message,
            stack: task.result.errors[0].stack,
          }
        : undefined,
    }));

    const passed = tests.filter((t: any) => t.status === "pass").length;
    const failed = tests.filter((t: any) => t.status === "fail").length;
    const skipped = tests.filter((t: any) => t.status === "skip").length;

    totalPassed += passed;
    totalFailed += failed;
    totalSkipped += skipped;

    blocks.push({
      blockId: `block-${block.orgFilePath.replace(/[^a-z0-9]/gi, "-")}-${block.blockIndex}`,
      blockName: block.blockName,
      orgFilePath: block.orgFilePath,
      blockIndex: block.blockIndex,
      tests,
      duration: file.result?.duration ?? 0,
      timestamp: Date.now(),
    });
  }

  return {
    success: totalFailed === 0,
    totalTests: totalPassed + totalFailed + totalSkipped,
    passedTests: totalPassed,
    failedTests: totalFailed,
    skippedTests: totalSkipped,
    blocks,
    duration: blocks.reduce((sum, b) => sum + b.duration, 0),
  };
}
