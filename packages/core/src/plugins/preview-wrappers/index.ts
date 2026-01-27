/**
 * Built-in Render Wrappers
 *
 * Factory functions that create wrappers for common presentation patterns.
 * Each wrapper transforms a RenderFunction to add functionality.
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
export { withTabs } from "./with-tabs.ts";
export type { WithTabsConfig } from "./with-tabs.ts";

// Re-export types
export type { WrapperFactory, Wrapper, RenderFunction } from "../preview.ts";

import { withSourceCode } from "./with-source-code.ts";
import { withContainer } from "./with-container.ts";
import { withErrorBoundary } from "./with-error-boundary.ts";
import { withConsole } from "./with-console.ts";
import { withCollapse } from "./with-collapse.ts";
import { withTabs } from "./with-tabs.ts";
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
  registerWrapper("withTabs", withTabs);
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
  withTabs,
} as const;
