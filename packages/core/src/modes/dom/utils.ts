/**
 * DOM Mode Utilities
 *
 * Helper functions for rendering various result types to HTML and DOM.
 */

/**
 * Symbol used by React to identify React elements
 */
const REACT_ELEMENT_SYMBOL = Symbol.for("react.element");
const REACT_TRANSITIONAL_ELEMENT_SYMBOL = Symbol.for(
  "react.transitional.element"
);

/**
 * Check if a value is a React element
 *
 * React elements have a special $$typeof symbol that identifies them.
 * This is used to detect when blocks return React elements without
 * having the React mode registered.
 *
 * @param value - Value to check
 * @returns true if the value is a React element
 */
export function isReactElement(value: unknown): boolean {
  if (value === null || typeof value !== "object") return false;
  const obj = value as { $$typeof?: symbol };
  return (
    obj.$$typeof === REACT_ELEMENT_SYMBOL ||
    obj.$$typeof === REACT_TRANSITIONAL_ELEMENT_SYMBOL
  );
}

/**
 * Escape HTML special characters to prevent XSS
 *
 * @param str - String to escape
 * @returns Escaped string safe for HTML content
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Render a result to an HTML string for server-side rendering
 *
 * Handles various result types:
 * - null/undefined: empty string
 * - string: rendered as HTML if starts with '<', otherwise escaped
 * - number/boolean: converted to string
 * - object: rendered as formatted JSON in a pre tag
 * - other: converted to escaped string
 *
 * @param result - The block's execution result
 * @returns HTML string representation
 */
export function renderToHtml(result: unknown): string {
  if (result === null || result === undefined) return "";

  if (typeof result === "string") {
    // If it looks like HTML, return as-is
    return result.trim().startsWith("<") ? result : escapeHtml(result);
  }

  if (typeof result === "number" || typeof result === "boolean") {
    return String(result);
  }

  if (typeof result === "object") {
    return `<pre>${escapeHtml(JSON.stringify(result, null, 2))}</pre>`;
  }

  return escapeHtml(String(result));
}

/**
 * Render a result directly to a DOM element
 *
 * Handles various result types:
 * - null/undefined: no-op
 * - function: called with container id
 * - HTMLElement: appended if container is empty
 * - DocumentFragment: appended to container
 * - string: innerHTML if HTML-like, otherwise textContent
 * - number/boolean: set as textContent
 * - object: rendered as JSON in a pre tag
 *
 * @param container - The DOM element to render into
 * @param result - The block's execution result
 */
export function renderResult(container: HTMLElement, result: unknown): void {
  if (result === null || result === undefined) return;

  // Function: call with container id
  if (typeof result === "function") {
    (result as (id: string) => void)(container.id);
    return;
  }

  // HTMLElement: append if container is empty
  if (result instanceof HTMLElement) {
    if (!container.hasChildNodes()) container.appendChild(result);
    return;
  }

  // DocumentFragment: append to container
  if (result instanceof DocumentFragment) {
    container.appendChild(result);
    return;
  }

  // String: innerHTML if HTML-like, otherwise textContent
  if (typeof result === "string") {
    if (result.trim().startsWith("<")) {
      container.innerHTML = result;
    } else {
      container.textContent = result;
    }
    return;
  }

  // Number/boolean: set as textContent
  if (typeof result === "number" || typeof result === "boolean") {
    container.textContent = String(result);
    return;
  }

  // Object: render as JSON
  if (typeof result === "object") {
    container.innerHTML = `<pre>${JSON.stringify(result, null, 2)}</pre>`;
    return;
  }

  // Fallback: convert to string
  container.textContent = String(result);
}
