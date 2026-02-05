/**
 * CSV Format Wrapper
 *
 * Formats execution result (array of objects) as CSV.
 */

import type { RenderFunction, RenderResult, BlockContext } from "../preview.ts";

export interface CsvFormatConfig {
  /** Column delimiter (default: ",") */
  delimiter?: string;

  /** Whether to include header row (default: true) */
  header?: boolean;

  /** CSS class for the container */
  className?: string;

  /** Render as HTML table instead of pre/code */
  asTable?: boolean;
}

/**
 * CSV format wrapper factory
 *
 * Formats an array of objects as CSV.
 *
 * @example
 * ```org
 * #+begin_src javascript :use server | csv
 * return [
 *   { name: "Alice", age: 30 },
 *   { name: "Bob", age: 25 }
 * ];
 * #+end_src
 * ```
 *
 * @example
 * // As HTML table
 * :use server | csv?asTable
 *
 * @example
 * // Tab-separated
 * :use server | csv?delimiter=\t
 */
export const csvFormat = (config?: Record<string, unknown>) => {
  const {
    delimiter = ",",
    header = true,
    className = "org-csv",
    asTable = false,
  } = (config ?? {}) as CsvFormatConfig;

  return (_inputRender: RenderFunction): RenderFunction => {
    return (result: unknown, _ctx: BlockContext): RenderResult => {
      // Handle null/undefined
      if (result === null || result === undefined) {
        return null;
      }

      // Must be an array
      if (!Array.isArray(result)) {
        return `<pre class="${className} org-error"><code>Error: CSV format requires an array</code></pre>`;
      }

      if (result.length === 0) {
        return `<pre class="${className}"><code></code></pre>`;
      }

      try {
        // Get columns from first object
        const firstItem = result[0];
        if (typeof firstItem !== "object" || firstItem === null) {
          return `<pre class="${className} org-error"><code>Error: CSV format requires an array of objects</code></pre>`;
        }

        const columns = Object.keys(firstItem);

        if (asTable) {
          return renderAsTable(result, columns, header, className);
        }

        return renderAsCsv(result, columns, delimiter, header, className);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "CSV conversion error";
        return `<pre class="${className} org-error"><code>Error: ${escapeHtml(errorMsg)}</code></pre>`;
      }
    };
  };
};

/**
 * Render as CSV text in pre/code
 */
function renderAsCsv(
  data: unknown[],
  columns: string[],
  delimiter: string,
  includeHeader: boolean,
  className: string
): string {
  const lines: string[] = [];

  // Header row
  if (includeHeader) {
    lines.push(columns.map((col) => escapeCsvField(col, delimiter)).join(delimiter));
  }

  // Data rows
  for (const row of data) {
    if (typeof row === "object" && row !== null) {
      const values = columns.map((col) => {
        const value = (row as Record<string, unknown>)[col];
        return escapeCsvField(String(value ?? ""), delimiter);
      });
      lines.push(values.join(delimiter));
    }
  }

  const csv = lines.join("\n");
  return `<pre class="${className}"><code>${escapeHtml(csv)}</code></pre>`;
}

/**
 * Render as HTML table
 */
function renderAsTable(
  data: unknown[],
  columns: string[],
  includeHeader: boolean,
  className: string
): string {
  const lines: string[] = [];

  lines.push(`<table class="${className}">`);

  // Header row
  if (includeHeader) {
    lines.push("  <thead>");
    lines.push("    <tr>");
    for (const col of columns) {
      lines.push(`      <th>${escapeHtml(col)}</th>`);
    }
    lines.push("    </tr>");
    lines.push("  </thead>");
  }

  // Body
  lines.push("  <tbody>");
  for (const row of data) {
    if (typeof row === "object" && row !== null) {
      lines.push("    <tr>");
      for (const col of columns) {
        const value = (row as Record<string, unknown>)[col];
        lines.push(`      <td>${escapeHtml(String(value ?? ""))}</td>`);
      }
      lines.push("    </tr>");
    }
  }
  lines.push("  </tbody>");
  lines.push("</table>");

  return lines.join("\n");
}

/**
 * Escape a CSV field
 */
function escapeCsvField(value: string, delimiter: string): string {
  // If contains delimiter, quote, or newline, wrap in quotes
  if (
    value.includes(delimiter) ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    // Double any existing quotes
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
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
