import type { BlockPlugin } from "../types.ts";
import { rewriteOrgImports, parseBlockParameters } from "../utils.ts";

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
 * Languages that can be executed in preview mode
 */
const EXECUTABLE_LANGUAGES = [
  "javascript", "js",
  "typescript", "ts",
  "tsx", "jsx",
];

/**
 * Preview Plugin
 *
 * Handles blocks with :use preview (or default when no :use specified).
 * Executes code and displays the result.
 *
 * For JavaScript/TypeScript:
 * - Rewrites .org imports
 * - Wraps code in async IIFE for execution
 * - Returns the result via export default
 *
 * For CSS:
 * - Delegates to CSS handling (inject styles)
 *
 * Usage:
 * #+begin_src javascript :use preview
 * 1 + 1
 * #+end_src
 */
export const previewPlugin: BlockPlugin = {
  name: "preview",
  defaultExtension: "js",
  priority: 50, // Higher than language plugins (10)

  /**
   * Match blocks with :use preview
   */
  matches(block) {
    const params = parseBlockParameters(block.meta);
    const useValue = params.use || "";
    const firstPart = useValue.split("|")[0].trim();
    return firstPart === "preview";
  },

  /**
   * Transform code for preview execution
   */
  async transform(block, context) {
    const language = block.language.toLowerCase();

    // For executable languages, transform and wrap for execution
    if (EXECUTABLE_LANGUAGES.includes(language)) {
      // Rewrite .org imports
      let code = rewriteOrgImports(block.value, context.orgFilePath);

      // Check if code already uses ES module syntax
      const hasModuleSyntax = usesModuleSyntax(code);

      if (!hasModuleSyntax) {
        // Wrap code in async IIFE for execution
        code = `export default (async () => {\n${code}\n})();`;
      }

      return { code };
    }

    // For CSS, just return the code (will be injected as styles)
    if (["css", "scss", "sass", "less"].includes(language)) {
      return { code: block.value };
    }

    // For other languages, return as string
    return {
      code: `export default ${JSON.stringify(block.value)};`,
    };
  },
};
