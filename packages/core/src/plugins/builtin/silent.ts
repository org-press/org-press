/**
 * Silent mode plugin
 *
 * Intercepts `:use silent` blocks and executes code for side effects without
 * rendering visible output. Uses CreateBlock with a matches function to check
 * the :use parameter.
 *
 * Usage:
 * #+begin_src javascript :use silent
 * // This code runs but produces no output
 * window.myGlobal = "initialized";
 * #+end_src
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
 * Languages that can be executed
 */
const EXECUTABLE_LANGUAGES = [
  "javascript", "js",
  "typescript", "ts",
  "tsx", "jsx",
];

/**
 * CSS-like languages
 */
const CSS_LANGUAGES = ["css", "scss", "sass", "less"];

/**
 * All languages that this plugin can handle
 */
const ALL_LANGUAGES = [
  ...EXECUTABLE_LANGUAGES,
  ...CSS_LANGUAGES,
  "html", "xml",
  "python", "py",
  "ruby", "rb",
  "go", "rust", "c", "cpp", "java",
  "json", "yaml", "yml", "toml",
  "markdown", "md",
  "shell", "bash", "sh", "zsh",
  "sql", "graphql",
  "text", "plaintext",
];

/**
 * Silent plugin using CreateBlock factory
 *
 * Priority: 50 (mode plugins have higher priority than language plugins)
 */
export const silentPlugin = CreateBlock(ALL_LANGUAGES, {
  priority: 50, // Higher than language plugins (10)

  /**
   * Match blocks with :use silent
   */
  matches: (_block, ctx) => {
    const useValue = ctx.params.use || "";
    const firstPart = useValue.split("|")[0].trim();
    return firstPart === "silent";
  },

  /**
   * Transform code for silent execution (no output)
   */
  transform: (code, ctx) => {
    const language = ctx.language.toLowerCase();

    // For executable languages, execute but don't export result
    if (EXECUTABLE_LANGUAGES.includes(language)) {
      // Rewrite .org imports
      let transformedCode = rewriteOrgImports(code, ctx.orgFilePath);

      // Check if code already uses ES module syntax
      const hasModuleSyntax = usesModuleSyntax(transformedCode);

      if (!hasModuleSyntax) {
        // Wrap in IIFE that doesn't return anything
        transformedCode = `(async () => {\n${transformedCode}\n})();`;
      }

      return { code: transformedCode };
    }

    // For CSS, still inject styles (silent doesn't change CSS behavior)
    if (CSS_LANGUAGES.includes(language)) {
      return { code };
    }

    // For other languages, do nothing
    return { code: "" };
  },

  defaultExtension: "js",
});

// Override the plugin name for clarity
silentPlugin.name = "silent";

// Expose v1-compatible properties for backward compatibility
(silentPlugin as any).defaultExtension = "js";
(silentPlugin as any).languages = ALL_LANGUAGES;

// v1-compatible matches function
(silentPlugin as any).matches = (block: { meta?: string | null }) => {
  if (!block.meta) return false;
  const useMatch = block.meta.match(/:use\s+((?:[^:]|:(?!\w))+?)(?=\s*:\w|$)/);
  if (!useMatch) return false;
  const useValue = useMatch[1].trim();
  const firstPart = useValue.split("|")[0].trim();
  return firstPart === "silent";
};

// v1-compatible transform function
(silentPlugin as any).transform = async (
  block: { value: string; language: string; meta?: string | null },
  ctx: { orgFilePath: string }
) => {
  const language = block.language.toLowerCase();

  // For executable languages, execute but don't export result
  if (EXECUTABLE_LANGUAGES.includes(language)) {
    // Rewrite .org imports
    let code = rewriteOrgImports(block.value, ctx.orgFilePath);

    // Check if code already uses ES module syntax
    const hasModuleSyntax = usesModuleSyntax(code);

    if (!hasModuleSyntax) {
      // Wrap in IIFE that doesn't return anything
      code = `(async () => {\n${code}\n})();`;
    }

    return { code };
  }

  // For CSS, still inject styles (silent doesn't change CSS behavior)
  if (CSS_LANGUAGES.includes(language)) {
    return { code: block.value };
  }

  // For other languages, do nothing
  return { code: "" };
};
