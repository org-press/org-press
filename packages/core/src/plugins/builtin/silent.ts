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
 * Languages that can be executed
 */
const EXECUTABLE_LANGUAGES = [
  "javascript", "js",
  "typescript", "ts",
  "tsx", "jsx",
];

/**
 * Silent Plugin
 *
 * Handles blocks with :use silent.
 * Executes code but produces no visible output.
 * Useful for setup code or side effects.
 *
 * Usage:
 * #+begin_src javascript :use silent
 * // This code runs but produces no output
 * window.myGlobal = "initialized";
 * #+end_src
 */
export const silentPlugin: BlockPlugin = {
  name: "silent",
  defaultExtension: "js",
  priority: 50, // Higher than language plugins (10)

  /**
   * Match blocks with :use silent
   */
  matches(block) {
    const params = parseBlockParameters(block.meta);
    const useValue = params.use || "";
    const firstPart = useValue.split("|")[0].trim();
    return firstPart === "silent";
  },

  /**
   * Transform code for silent execution (no output)
   */
  async transform(block, context) {
    const language = block.language.toLowerCase();

    // For executable languages, execute but don't export result
    if (EXECUTABLE_LANGUAGES.includes(language)) {
      // Rewrite .org imports
      let code = rewriteOrgImports(block.value, context.orgFilePath);

      // Check if code already uses ES module syntax
      const hasModuleSyntax = usesModuleSyntax(code);

      if (!hasModuleSyntax) {
        // Wrap in IIFE that doesn't return anything
        code = `(async () => {\n${code}\n})();`;
      }

      return { code };
    }

    // For CSS, still inject styles (silent doesn't change CSS behavior)
    if (["css", "scss", "sass", "less"].includes(language)) {
      return { code: block.value };
    }

    // For other languages, do nothing
    return { code: "" };
  },
};
