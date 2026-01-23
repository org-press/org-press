/**
 * withConsole Wrapper
 *
 * Displays console output captured during block execution.
 * Note: Console capture must be done by the execution environment.
 * This wrapper displays the captured output.
 */

import type { WrapperFactory, PreviewFn, PreviewResult, BlockContext } from "../preview.ts";

export interface WithConsoleConfig {
  /** Where to show console output: before, after, or replace preview */
  position?: "before" | "after" | "replace";

  /** CSS class for the console container */
  className?: string;

  /** Label for the console section */
  label?: string;

  /** Maximum number of lines to show (0 = unlimited) */
  maxLines?: number;
}

/**
 * Extended result type that may include console output
 */
interface ResultWithConsole {
  value?: unknown;
  console?: ConsoleEntry[];
}

interface ConsoleEntry {
  type: "log" | "warn" | "error" | "info" | "debug";
  args: unknown[];
  timestamp?: number;
}

/**
 * Creates a wrapper that displays console output
 *
 * The execution result should be an object with `value` and `console` properties:
 * { value: actualResult, console: [{ type: "log", args: ["Hello"] }] }
 *
 * @example
 * ```typescript
 * // Show console after result
 * ":use preview | withConsole"
 *
 * // Show console before result
 * ":use preview | withConsole?position=before"
 *
 * // Limit output
 * ":use preview | withConsole?maxLines=10"
 * ```
 */
export const withConsole: WrapperFactory = (config?: Record<string, unknown>) => {
  const {
    position = "after",
    className = "org-console",
    label = "Console",
    maxLines = 0,
  } = (config ?? {}) as WithConsoleConfig;

  return (preview: PreviewFn): PreviewFn => {
    return (result: unknown, ctx: BlockContext): PreviewResult => {
      // Check if result has console data
      const hasConsoleData = isResultWithConsole(result);
      const actualResult = hasConsoleData ? result.value : result;
      const consoleEntries = hasConsoleData ? result.console ?? [] : [];

      // Format console output
      const consoleHtml = formatConsoleOutput(consoleEntries, { maxLines, className, label });

      if (position === "replace") {
        return consoleHtml || null;
      }

      // Get preview of actual result
      const previewResult = preview(actualResult, ctx);
      const previewHtml = typeof previewResult === "string" ? previewResult : "";

      if (!consoleHtml) {
        return previewHtml;
      }

      if (position === "before") {
        return `${consoleHtml}\n${previewHtml}`;
      }

      // position === "after"
      return `${previewHtml}\n${consoleHtml}`;
    };
  };
};

/**
 * Type guard for result with console data
 */
function isResultWithConsole(result: unknown): result is ResultWithConsole {
  return (
    typeof result === "object" &&
    result !== null &&
    "console" in result &&
    Array.isArray((result as ResultWithConsole).console)
  );
}

/**
 * Format console entries to HTML
 */
function formatConsoleOutput(
  entries: ConsoleEntry[],
  options: { maxLines: number; className: string; label: string }
): string {
  if (entries.length === 0) {
    return "";
  }

  let displayEntries = entries;
  if (options.maxLines > 0 && entries.length > options.maxLines) {
    displayEntries = entries.slice(-options.maxLines);
  }

  const lines = displayEntries.map((entry) => {
    const typeClass = `org-console-${entry.type}`;
    const content = entry.args.map(formatValue).join(" ");
    return `<div class="${typeClass}">${escapeHtml(content)}</div>`;
  });

  const truncated = options.maxLines > 0 && entries.length > options.maxLines
    ? `<div class="org-console-truncated">(${entries.length - options.maxLines} earlier entries hidden)</div>`
    : "";

  return `<div class="${options.className}">
    ${options.label ? `<div class="org-console-label">${options.label}</div>` : ""}
    ${truncated}
    ${lines.join("\n")}
  </div>`;
}

/**
 * Format a value for display
 */
function formatValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "function") return `[Function: ${value.name || "anonymous"}]`;

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

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
