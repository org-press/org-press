import type { BlockPlugin } from "../types.ts";
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
export const jsxPlugin: BlockPlugin = {
  name: "jsx",
  defaultExtension: "jsx",
  languages: ["jsx"],
  priority: 10,

  /**
   * Transform JSX code
   *
   * This is a fallback when no mode plugin matches.
   * Default behavior: execute code and return result (like preview mode).
   */
  async transform(block, context) {
    // Rewrite .org imports to .html
    let code = rewriteOrgImports(block.value, context.orgFilePath);

    // Check if code already uses ES module syntax
    const hasModuleSyntax = usesModuleSyntax(code);

    // Default behavior: execute the code (like preview mode)
    if (!hasModuleSyntax) {
      // Wrap code in IIFE for execution
      code = `export default (async () => {\n${code}\n})();`;
    }

    return { code };
  },
};
