/**
 * Built-in JSX plugin
 *
 * Handles JSX (JavaScript + JSX) code blocks when no explicit :use mode is specified.
 * Only handles transpilation and import rewriting.
 *
 * Mode handling (preview, sourceOnly, etc.) is done by dedicated mode plugins.
 *
 * Key insight: Using defaultExtension: "jsx" tells Vite to transpile the code
 * automatically using its built-in esbuild integration.
 */

import { CreateBlock } from "../index.ts";
import { rewriteOrgImports } from "../utils.ts";

/**
 * Check if code uses ES module syntax (export/import)
 */
function usesModuleSyntax(code: string): boolean {
  if (/\bexport\s+(default|const|let|var|function|class|async)\b/.test(code)) {
    return true;
  }
  if (/\bexport\s*\{/.test(code)) {
    return true;
  }
  if (/^import\s+/m.test(code)) {
    return true;
  }
  return false;
}

/**
 * JSX plugin using CreateBlock factory
 *
 * Priority: 10 (built-in plugins have medium priority)
 * Languages: jsx
 */
export const jsxPlugin = CreateBlock(["jsx"], {
  priority: 10,

  /**
   * Transform JSX code
   *
   * This is a fallback when no mode plugin matches.
   * Default behavior: execute code and return result (like preview mode).
   */
  transform: (code, ctx) => {
    // Rewrite .org imports to .html
    let transformedCode = rewriteOrgImports(code, ctx.orgFilePath);

    // Check if code already uses ES module syntax
    const hasModuleSyntax = usesModuleSyntax(transformedCode);

    // Default behavior: execute the code (like preview mode)
    if (!hasModuleSyntax) {
      // Wrap code in IIFE for execution
      transformedCode = `export default (async () => {\n${transformedCode}\n})();`;
    }

    return { code: transformedCode };
  },

  defaultExtension: "jsx",
});

// Override the plugin name for clarity
jsxPlugin.name = "jsx";

// Expose v1-compatible properties for backward compatibility
(jsxPlugin as any).defaultExtension = "jsx";
(jsxPlugin as any).languages = ["jsx"];

// v1-compatible transform function
(jsxPlugin as any).transform = async (
  block: { value: string; language: string; meta?: string | null },
  ctx: { orgFilePath: string }
) => {
  // Rewrite .org imports to .html
  let code = rewriteOrgImports(block.value, ctx.orgFilePath);

  // Check if code already uses ES module syntax
  const hasModuleSyntax = usesModuleSyntax(code);

  // Default behavior: execute the code (like preview mode)
  if (!hasModuleSyntax) {
    // Wrap code in IIFE for execution
    code = `export default (async () => {\n${code}\n})();`;
  }

  return { code };
};
