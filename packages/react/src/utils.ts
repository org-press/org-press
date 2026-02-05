/**
 * Utility functions for React mode plugin
 */

/**
 * Check if a value is a React element
 *
 * React elements have a $$typeof symbol property that identifies them.
 * This works for both React 18 (react.element) and React 19 (react.transitional.element).
 *
 * @param value - The value to check
 * @returns true if the value is a React element
 */
export function isReactElement(value: unknown): boolean {
  if (value === null || typeof value !== "object") return false;
  const obj = value as { $$typeof?: symbol };
  return (
    obj.$$typeof === Symbol.for("react.element") ||
    obj.$$typeof === Symbol.for("react.transitional.element")
  );
}
