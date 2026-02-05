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

import {
  CreateTransformer,
  CreateCommand,
  createBlockId,
  type OrgPressPlugin,
} from "org-press";
import { createTestResultsModuleId } from "./types.ts";
import { runTests } from "./test-runner.ts";

/**
 * Test block transformer for org-press
 *
 * Transforms `:use test` blocks into test result viewers.
 * Works with the test-runner CLI command to execute tests.
 */
export const testTransformer = CreateTransformer("test", {
  /**
   * Build-time transformation
   *
   * Returns a render function that displays test results.
   * Results are loaded from a virtual module that provides cached test data.
   */
  onBuild: (input, ctx) => {
    const blockId = createBlockId(ctx.orgFilePath, ctx.blockIndex);
    const resultsModuleId = createTestResultsModuleId(
      ctx.orgFilePath,
      ctx.blockIndex
    );

    // Parse parameters for any test-specific options
    const showCoverage = ctx.params.coverage !== undefined;

    const script = `
import renderTestResults from '@org-press/block-test/wrapper';

// Test block configuration
const config = {
  blockId: '${blockId}',
  blockName: ${ctx.blockName ? `'${ctx.blockName}'` : "undefined"},
  showCoverage: ${showCoverage},
  orgFilePath: '${ctx.orgFilePath}',
  blockIndex: ${ctx.blockIndex},
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
    `.trim();

    return { script };
  },
});

/**
 * Test CLI command plugin
 *
 * Provides the `orgp test` command for running test blocks.
 */
export const testCommand = CreateCommand("test", {
  description: "Run test blocks in org files",
  args: [
    { name: "watch", alias: "w", type: "boolean", description: "Enable watch mode" },
    { name: "coverage", alias: "c", type: "boolean", description: "Enable coverage" },
    { name: "name", alias: "n", type: "string", description: "Filter by block name" },
  ],

  async execute(args, context) {
    return runTests({
      contentDir: context.contentDir,
      projectRoot: context.projectRoot,
      watch: args.watch as boolean | undefined,
      coverage: args.coverage as boolean | undefined,
      name: args.name as string | undefined,
      files: args._.length > 0 ? args._ : undefined,
    });
  },
});

/**
 * Combined test plugin (includes both transformer and command)
 */
export const testPlugin: OrgPressPlugin[] = [testTransformer, testCommand];

/**
 * @deprecated Use `testPlugin` instead
 */
export const blockTestPlugin = testPlugin;
