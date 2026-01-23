/**
 * Type definitions for @org-press/block-test plugin
 *
 * Provides types for test results, coverage data, and CLI integration.
 */

import type { BlockPlugin } from "org-press";

/**
 * Result of a single test
 */
export interface TestResult {
  /** Test name/description */
  name: string;
  /** Test status */
  status: "pass" | "fail" | "skip";
  /** Duration in milliseconds */
  duration: number;
  /** Error details (if status is 'fail') */
  error?: {
    message: string;
    expected?: unknown;
    actual?: unknown;
    stack?: string;
  };
}

/**
 * Result for a complete test block
 */
export interface TestBlockResult {
  /** Unique block identifier */
  blockId: string;
  /** Named block identifier (from #+NAME:) */
  blockName?: string;
  /** Path to the org file */
  orgFilePath: string;
  /** Block index in the file */
  blockIndex: number;
  /** Individual test results */
  tests: TestResult[];
  /** Coverage data (if enabled) */
  coverage?: CoverageData;
  /** Total duration in milliseconds */
  duration: number;
  /** Timestamp when tests were run */
  timestamp: number;
}

/**
 * Code coverage metrics
 */
export interface CoverageData {
  /** Line coverage */
  lines: CoverageMetric;
  /** Function coverage */
  functions: CoverageMetric;
  /** Branch coverage */
  branches?: CoverageMetric;
  /** Statement coverage */
  statements?: CoverageMetric;
}

/**
 * Individual coverage metric
 */
export interface CoverageMetric {
  /** Number of covered items */
  covered: number;
  /** Total number of items */
  total: number;
  /** Coverage percentage (0-100) */
  percent: number;
}

/**
 * Collected test block from manifest scanning
 */
export interface CollectedTestBlock {
  /** Relative path to the org file */
  orgFilePath: string;
  /** Block index in the file */
  blockIndex: number;
  /** Named block identifier (optional) */
  blockName?: string;
  /** Raw test code */
  code: string;
  /** Block language */
  language: string;
}

/**
 * CLI context provided to plugin commands
 */
export interface CliContext {
  /** Resolved org-press configuration */
  config: any;
  /** Project root directory */
  projectRoot: string;
  /** Content directory path */
  contentDir: string;
}

/**
 * CLI command definition for plugins
 */
export interface CliCommand {
  /** Command name (e.g., "test") */
  command: string;
  /** Command description for help */
  description: string;
  /** Command execution function */
  execute: (args: string[], context: CliContext) => Promise<number>;
}

/**
 * Extended BlockPlugin interface with CLI support
 */
export interface BlockPluginWithCli extends BlockPlugin {
  /** CLI command (optional) */
  cli?: CliCommand;
}

/**
 * Test runner options
 */
export interface TestRunnerOptions {
  /** Content directory to scan for tests */
  contentDir: string;
  /** Project root directory */
  projectRoot: string;
  /** Enable watch mode */
  watch?: boolean;
  /** Enable coverage */
  coverage?: boolean;
  /** Filter by block name */
  name?: string;
  /** Filter by file path */
  files?: string[];
  /** Vitest config overrides */
  vitestConfig?: Record<string, unknown>;
}

/**
 * Test run result
 */
export interface TestRunResult {
  /** Overall success */
  success: boolean;
  /** Total tests */
  totalTests: number;
  /** Passed tests */
  passedTests: number;
  /** Failed tests */
  failedTests: number;
  /** Skipped tests */
  skippedTests: number;
  /** Per-block results */
  blocks: TestBlockResult[];
  /** Total duration in milliseconds */
  duration: number;
}

/**
 * Virtual module ID format for test results
 * Pattern: virtual:org-press:test-results:{orgFilePath}:{blockIndex}
 */
export const TEST_RESULTS_VIRTUAL_PREFIX = "virtual:org-press:test-results:";

/**
 * Parse a test results virtual module ID
 */
export function parseTestResultsModuleId(id: string): {
  orgFilePath: string;
  blockIndex: number;
} | null {
  if (!id.startsWith(TEST_RESULTS_VIRTUAL_PREFIX)) {
    return null;
  }

  const path = id.slice(TEST_RESULTS_VIRTUAL_PREFIX.length);
  const lastColonIndex = path.lastIndexOf(":");

  if (lastColonIndex === -1) {
    return null;
  }

  const orgFilePath = path.slice(0, lastColonIndex);
  const blockIndex = parseInt(path.slice(lastColonIndex + 1), 10);

  if (isNaN(blockIndex)) {
    return null;
  }

  return { orgFilePath, blockIndex };
}

/**
 * Create a test results virtual module ID
 */
export function createTestResultsModuleId(
  orgFilePath: string,
  blockIndex: number
): string {
  return `${TEST_RESULTS_VIRTUAL_PREFIX}${orgFilePath}:${blockIndex}`;
}
