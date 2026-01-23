/**
 * Built-in Preview Wrappers
 *
 * Factory functions that create wrappers for common presentation patterns.
 * Each wrapper transforms a PreviewFn to add functionality.
 */

export { withSourceCode } from "./with-source-code.ts";
export type { WithSourceCodeConfig } from "./with-source-code.ts";
export { withContainer } from "./with-container.ts";
export type { WithContainerConfig } from "./with-container.ts";
export { withErrorBoundary } from "./with-error-boundary.ts";
export type { WithErrorBoundaryConfig } from "./with-error-boundary.ts";
export { withConsole } from "./with-console.ts";
export type { WithConsoleConfig } from "./with-console.ts";
export { withCollapse } from "./with-collapse.ts";
export type { WithCollapseConfig } from "./with-collapse.ts";

// Re-export types
export type { WrapperFactory, Wrapper, PreviewFn } from "../preview.ts";

import { withSourceCode } from "./with-source-code.ts";
import { withContainer } from "./with-container.ts";
import { withErrorBoundary } from "./with-error-boundary.ts";
import { withConsole } from "./with-console.ts";
import { withCollapse } from "./with-collapse.ts";
import { registerWrapper } from "../wrapper-compose.ts";

/**
 * Register all built-in wrappers with the global registry
 */
export function registerBuiltinWrappers(): void {
  registerWrapper("withSourceCode", withSourceCode);
  registerWrapper("withContainer", withContainer);
  registerWrapper("withErrorBoundary", withErrorBoundary);
  registerWrapper("withConsole", withConsole);
  registerWrapper("withCollapse", withCollapse);
}

/**
 * Map of all built-in wrapper factories
 */
export const builtinWrappers = {
  withSourceCode,
  withContainer,
  withErrorBoundary,
  withConsole,
  withCollapse,
} as const;
