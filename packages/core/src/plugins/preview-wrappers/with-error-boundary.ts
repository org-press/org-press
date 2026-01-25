/**
 * withErrorBoundary Wrapper
 *
 * Catches errors during render and displays a fallback.
 */

import type { WrapperFactory, RenderFunction, RenderResult, BlockContext } from "../preview.ts";

export interface WithErrorBoundaryConfig {
  /** Fallback content when error occurs (can include {error} placeholder) */
  fallback?: string;

  /** CSS class for the error container */
  className?: string;

  /** Whether to show the error message */
  showError?: boolean;

  /** Whether to show the stack trace (dev only) */
  showStack?: boolean;
}

/**
 * Creates a wrapper that catches errors and displays a fallback
 *
 * @example
 * ```typescript
 * // With default fallback
 * ":use dom | withErrorBoundary"
 *
 * // With custom fallback
 * ":use dom | withErrorBoundary?fallback=Something went wrong"
 *
 * // Show error details
 * ":use dom | withErrorBoundary?showError&showStack"
 * ```
 */
export const withErrorBoundary: WrapperFactory = (config?: Record<string, unknown>) => {
  const {
    fallback = "Error rendering block",
    className = "org-error-boundary",
    showError = true,
    showStack = false,
  } = (config ?? {}) as WithErrorBoundaryConfig;

  return (render: RenderFunction): RenderFunction => {
    return (result: unknown, ctx: BlockContext): RenderResult => {
      try {
        return render(result, ctx);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;

        let content = fallback.replace("{error}", escapeHtml(errorMessage));

        if (showError && !fallback.includes("{error}")) {
          content += `<div class="org-error-message">${escapeHtml(errorMessage)}</div>`;
        }

        if (showStack && errorStack && ctx.runtime.isDev) {
          content += `<pre class="org-error-stack">${escapeHtml(errorStack)}</pre>`;
        }

        return `<div class="${className}" data-error="true">${content}</div>`;
      }
    };
  };
};

/**
 * Escape HTML special characters
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
