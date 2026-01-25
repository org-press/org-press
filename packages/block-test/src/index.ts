/**
 * @org-press/block-test
 *
 * Test runner block plugin for org-press - literate testing with Vitest.
 *
 * Usage in org files:
 * ```org
 * #+NAME: math-tests
 * #+begin_src typescript :use test
 * import { add } from './math.org?name=add';
 *
 * describe('add', () => {
 *   it('adds numbers', () => expect(add(1, 2)).toBe(3));
 * });
 * #+end_src
 * ```
 *
 * CLI usage:
 * ```bash
 * orgp test                    # Run all tests
 * orgp test content/math.org   # Run tests in file
 * orgp test --name math-tests  # Filter by block name
 * orgp test --coverage         # With coverage
 * orgp test --watch            # Watch mode
 * ```
 *
 * @packageDocumentation
 */

// Plugin export
export { testPlugin, blockTestPlugin } from "./plugin.ts";

// Types
export type {
  TestResult,
  TestBlockResult,
  CoverageData,
  CoverageMetric,
  CollectedTestBlock,
  CliContext,
  CliCommand,
  BlockPluginWithCli,
  TestRunnerOptions,
  TestRunResult,
} from "./types.ts";

export {
  TEST_RESULTS_VIRTUAL_PREFIX,
  parseTestResultsModuleId,
  createTestResultsModuleId,
} from "./types.ts";

// Test collection
export {
  collectTestBlocks,
  generateVirtualTestId,
  isVirtualTestId,
  parseVirtualTestId,
} from "./test-collector.ts";

// Test runner
export { runTests, collectResults } from "./test-runner.ts";

// Vite plugin
export {
  testBlockVitePlugin,
  registerTestBlock,
  registerTestResults,
  getTestResults,
  clearTestCache,
} from "./vitest-plugin.ts";

// Default export is the plugin
export { testPlugin as default } from "./plugin.ts";
