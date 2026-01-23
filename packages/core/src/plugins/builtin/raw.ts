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
 * Raw Plugin
 *
 * Handles blocks with :use raw.
 * Executes code and outputs the raw result without formatting.
 *
 * Usage:
 * #+begin_src javascript :use raw
 * "<div>Raw HTML output</div>"
 * #+end_src
 */
export const rawPlugin: BlockPlugin = {
  name: "raw",
  defaultExtension: "js",
  priority: 50, // Higher than language plugins (10)

  /**
   * Match blocks with :use raw
   */
  matches(block) {
    const params = parseBlockParameters(block.meta);
    const useValue = params.use || "";
    const firstPart = useValue.split("|")[0].trim();
    return firstPart === "raw";
  },

  /**
   * Transform code for raw output execution
   */
  async transform(block, context) {
    const language = block.language.toLowerCase();

    // For executable languages, execute and return raw result
    if (EXECUTABLE_LANGUAGES.includes(language)) {
      // Rewrite .org imports
      let code = rewriteOrgImports(block.value, context.orgFilePath);

      // Check if code already uses ES module syntax
      const hasModuleSyntax = usesModuleSyntax(code);

      if (!hasModuleSyntax) {
        // Wrap in IIFE and export result
        code = `export default (async () => {\n${code}\n})();`;
      }

      return { code };
    }

    // For CSS, return as-is
    if (["css", "scss", "sass", "less"].includes(language)) {
      return { code: block.value };
    }

    // For other languages, return raw content
    return {
      code: `export default ${JSON.stringify(block.value)};`,
    };
  },
};
