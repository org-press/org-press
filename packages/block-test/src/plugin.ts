/**
 * Block Test Plugin Implementation
 *
 * Provides literate testing support for org-press using Vitest.
 *
 * Usage:
 * #+begin_src typescript :use test
 * import { add } from './math.org?name=add';
 *
 * describe('add', () => {
 *   it('adds numbers', () => expect(add(1, 2)).toBe(3));
 * });
 * #+end_src
 */

import type {
  BlockPlugin,
  CodeBlock,
  TransformContext,
  TransformResult,
} from "org-press";
import { createBlockId, parseBlockParameters } from "org-press";
import type { BlockPluginWithCli, CliContext } from "./types.ts";
import { createTestResultsModuleId } from "./types.ts";
import { runTests } from "./test-runner.ts";

/**
 * Test block plugin for org-press
 *
 * Transforms `:use test` blocks into test result viewers.
 * Works with the test-runner CLI command to execute tests.
 */
export const testPlugin: BlockPluginWithCli = {
  name: "test",
  defaultExtension: "js",

  /**
   * Match blocks with :use test parameter
   */
  matches(block: CodeBlock): boolean {
    const params = parseBlockParameters(block.meta || "");
    return params.use === "test";
  },

  /**
   * Transform test block for rendering
   *
   * Returns a render function that displays test results.
   * Results are loaded from a virtual module that provides cached test data.
   */
  async transform(
    block: CodeBlock,
    context: TransformContext
  ): Promise<TransformResult> {
    const blockId = createBlockId(context.orgFilePath, context.blockIndex);
    const resultsModuleId = createTestResultsModuleId(
      context.orgFilePath,
      context.blockIndex
    );

    // Parse parameters for any test-specific options
    const params = parseBlockParameters(block.meta || "");
    const showCoverage = params.coverage !== undefined;

    return {
      code: `
import renderTestResults from '@org-press/block-test/wrapper';

// Test block configuration
const config = {
  blockId: '${blockId}',
  blockName: ${context.blockName ? `'${context.blockName}'` : "undefined"},
  showCoverage: ${showCoverage},
  orgFilePath: '${context.orgFilePath}',
  blockIndex: ${context.blockIndex},
};

// Export render function - exporter will call this with container ID
export default function render(containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error('[TestBlock] Container not found:', containerId);
    return;
  }

  // Style the container
  container.className = 'test-results-wrapper';
  container.setAttribute('data-block-id', '${blockId}');

  // Import test results from virtual module and render
  import('${resultsModuleId}').then((module) => {
    renderTestResults(container, module.default, config);
  }).catch(err => {
    console.error('[TestBlock] Failed to load test results:', err);
    // Render placeholder when results aren't available yet
    renderTestResults(container, null, config);
  });
}
      `.trim(),
    };
  },

  /**
   * CLI command for running tests
   */
  cli: {
    command: "test",
    description: "Run test blocks in org files",

    async execute(args: string[], context: CliContext): Promise<number> {
      // Parse CLI arguments
      const options = parseTestArgs(args);

      return runTests({
        contentDir: context.contentDir,
        projectRoot: context.projectRoot,
        ...options,
      });
    },
  },
};

/**
 * Parse test command arguments
 */
function parseTestArgs(args: string[]): {
  watch?: boolean;
  coverage?: boolean;
  name?: string;
  files?: string[];
} {
  const result: {
    watch?: boolean;
    coverage?: boolean;
    name?: string;
    files?: string[];
  } = {};

  const files: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--watch" || arg === "-w") {
      result.watch = true;
    } else if (arg === "--coverage" || arg === "-c") {
      result.coverage = true;
    } else if (arg === "--name" || arg === "-n") {
      result.name = args[++i];
    } else if (arg.startsWith("--name=")) {
      result.name = arg.slice("--name=".length);
    } else if (!arg.startsWith("-")) {
      // Positional argument - treat as file filter
      files.push(arg);
    }
  }

  if (files.length > 0) {
    result.files = files;
  }

  return result;
}

/**
 * @deprecated Use `testPlugin` instead
 */
export const blockTestPlugin = testPlugin;
