import type { BlockPlugin } from "../types.ts";

/**
 * Built-in CSS plugin
 *
 * Handles CSS code blocks with automatic stylesheet injection.
 * CSS is written to cache and imported as a stylesheet.
 *
 * Usage in org-mode:
 * #+begin_src css
 * .my-class { color: blue; }
 * #+end_src
 */

/**
 * CSS plugin
 *
 * Priority: 10 (built-in plugins have medium priority)
 * Languages: css, scss, sass, less
 */
export const cssPlugin: BlockPlugin = {
  name: "css",
  defaultExtension: "css",
  languages: ["css", "scss", "sass", "less"],
  priority: 10,

  /**
   * Transform CSS code for stylesheet injection
   *
   * The CSS is written to cache and imported as a module.
   * Vite will process it and inject it into the page.
   */
  async transform(block, context) {
    // Return the CSS as-is
    // The cache system will write it to a .css file
    // Vite will handle the import and injection
    const code = block.value;

    return {
      code,
    };
  },

  /**
   * Generate-time transformation
   *
   * During build, we want to ensure the CSS is properly
   * extracted and bundled.
   */
  async onGenerate(block, context) {
    // Same as transform - let Vite handle it
    return {
      code: block.value,
    };
  },
};

/**
 * Alternative: Inline CSS plugin
 *
 * Injects CSS directly into the page as a <style> tag
 * instead of as a separate stylesheet.
 *
 * Useful for small amounts of CSS that should be inlined.
 */
export const cssInlinePlugin: BlockPlugin = {
  name: "css-inline",
  defaultExtension: "js", // Returns JS that injects CSS
  languages: [], // Not auto-matched, must use :use css-inline
  priority: 5,

  async transform(block, context) {
    // Generate JS that injects a style tag
    const css = block.value.replace(/\\/g, "\\\\").replace(/`/g, "\\`");

    const code = `
// Inline CSS injection for block
(function() {
  const css = \`${css}\`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
})();
`;

    return {
      code,
    };
  },
};

/**
 * Scoped CSS plugin
 *
 * Wraps CSS rules in a scoped selector based on block ID.
 * Useful for component-specific styles.
 *
 * Usage: :use css-scoped
 *
 * #+begin_src css :use css-scoped
 * .button { color: blue; }
 * #+end_src
 *
 * Becomes: #block-xyz .button { color: blue; }
 */
export const cssScopedPlugin: BlockPlugin = {
  name: "css-scoped",
  defaultExtension: "css",
  languages: [], // Not auto-matched
  priority: 5,

  async transform(block, context) {
    // Generate a scope selector based on block ID
    const scopeId = `#block-${context.orgFilePath
      .replace(/[^a-z0-9]/gi, "-")}-${context.blockIndex}`;

    // Parse and scope CSS rules
    const scopedCss = scopeCssRules(block.value, scopeId);

    return {
      code: scopedCss,
    };
  },
};

/**
 * Scope CSS rules to a specific selector
 *
 * Simple scoping that prepends the scope selector to each rule.
 * Note: This is basic scoping, doesn't handle all CSS syntax.
 *
 * @param css - CSS code to scope
 * @param scopeId - Scope selector (e.g., "#block-xyz")
 * @returns Scoped CSS
 */
function scopeCssRules(css: string, scopeId: string): string {
  // Simple regex-based scoping
  // Match CSS selectors and prepend scope
  return css.replace(
    /([^{}\s]+)\s*{/g,
    (match, selector) => {
      // Don't scope @-rules (like @media, @keyframes)
      if (selector.trim().startsWith("@")) {
        return match;
      }

      // Scope the selector
      const trimmedSelector = selector.trim();
      return `${scopeId} ${trimmedSelector} {`;
    }
  );
}
