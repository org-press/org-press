/**
 * Built-in CSS Plugin
 *
 * Handles CSS code blocks with automatic stylesheet injection.
 * CSS is written to cache and imported as a stylesheet.
 *
 * Usage in org-mode:
 * #+begin_src css
 * .my-class { color: blue; }
 * #+end_src
 */

import { CreateBlock } from "../index.ts";

/**
 * CSS plugin using CreateBlock factory
 *
 * Priority: 10 (built-in plugins have medium priority)
 * Languages: css, scss, sass, less
 */
export const cssPlugin = CreateBlock(["css", "scss", "sass", "less"], {
  transform: (code, ctx) => {
    // Return the CSS as-is
    // The cache system will write it to a .css file
    // Vite will handle the import and injection
    return { code };
  },
  defaultExtension: "css",
  priority: 10,
});

// Override the plugin name and expose v1 properties for backward compatibility
cssPlugin.name = "css";
(cssPlugin as any).defaultExtension = "css";
(cssPlugin as any).languages = ["css", "scss", "sass", "less"];
// Wrap transform to v1 signature: (block, context) => result
(cssPlugin as any).transform = async (block: { value: string; language: string; meta?: string }, ctx: any) => {
  const configTransform = (cssPlugin as any)._config?.transform;
  if (!configTransform) return { code: block.value };
  const simpleCtx = {
    blockId: `block-${ctx.blockIndex || 0}`,
    language: block.language,
    params: ctx.parameters || {},
    orgFilePath: ctx.orgFilePath || "",
    blockIndex: ctx.blockIndex || 0,
    base: ctx.base || "/",
  };
  return configTransform(block.value, simpleCtx);
};

/**
 * Alternative: Inline CSS plugin
 *
 * Injects CSS directly into the page as a <style> tag
 * instead of as a separate stylesheet.
 *
 * Useful for small amounts of CSS that should be inlined.
 */
export const cssInlinePlugin = CreateBlock([], {
  transform: (code, ctx) => {
    // Generate JS that injects a style tag
    const css = code.replace(/\\/g, "\\\\").replace(/`/g, "\\`");

    const jsCode = `
// Inline CSS injection for block
(function() {
  const css = \`${css}\`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
})();
`;

    return { code: jsCode };
  },
  defaultExtension: "js", // Returns JS that injects CSS
  priority: 5,
});

// Override the plugin name and expose v1 properties for backward compatibility
cssInlinePlugin.name = "css-inline";
(cssInlinePlugin as any).defaultExtension = "js";
(cssInlinePlugin as any).languages = [];
// Wrap transform to v1 signature
(cssInlinePlugin as any).transform = async (block: { value: string; language: string; meta?: string }, ctx: any) => {
  const configTransform = (cssInlinePlugin as any)._config?.transform;
  if (!configTransform) return { code: block.value };
  const simpleCtx = {
    blockId: `block-${ctx.blockIndex || 0}`,
    language: block.language,
    params: ctx.parameters || {},
    orgFilePath: ctx.orgFilePath || "",
    blockIndex: ctx.blockIndex || 0,
    base: ctx.base || "/",
  };
  return configTransform(block.value, simpleCtx);
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
export const cssScopedPlugin = CreateBlock([], {
  transform: (code, ctx) => {
    // Generate a scope selector based on block ID
    const scopeId = `#block-${ctx.orgFilePath
      .replace(/[^a-z0-9]/gi, "-")}-${ctx.blockIndex}`;

    // Parse and scope CSS rules
    const scopedCss = scopeCssRules(code, scopeId);

    return { code: scopedCss };
  },
  defaultExtension: "css",
  priority: 5,
});

// Override the plugin name and expose v1 properties for backward compatibility
cssScopedPlugin.name = "css-scoped";
(cssScopedPlugin as any).defaultExtension = "css";
(cssScopedPlugin as any).languages = [];
// Wrap transform to v1 signature
(cssScopedPlugin as any).transform = async (block: { value: string; language: string; meta?: string }, ctx: any) => {
  const configTransform = (cssScopedPlugin as any)._config?.transform;
  if (!configTransform) return { code: block.value };
  const simpleCtx = {
    blockId: `block-${ctx.blockIndex || 0}`,
    language: block.language,
    params: ctx.parameters || {},
    orgFilePath: ctx.orgFilePath || "",
    blockIndex: ctx.blockIndex || 0,
    base: ctx.base || "/",
  };
  return configTransform(block.value, simpleCtx);
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
