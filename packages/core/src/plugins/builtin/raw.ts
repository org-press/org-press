/**
 * Raw mode plugin
 *
 * Intercepts `:use raw` blocks and executes code, outputting the raw result
 * without additional formatting. Uses CreateBlock with a matches function to
 * check the :use parameter.
 *
 * Usage:
 * #+begin_src javascript :use raw
 * "<div>Raw HTML output</div>"
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
 * Raw plugin using CreateBlock factory
 *
 * Priority: 50 (mode plugins have higher priority than language plugins)
 */
export const rawPlugin = CreateBlock(ALL_LANGUAGES, {
  priority: 50, // Higher than language plugins (10)

  /**
   * Match blocks with :use raw
   */
  matches: (_block, ctx) => {
    const useValue = ctx.params.use || "";
    const firstPart = useValue.split("|")[0].trim();
    return firstPart === "raw";
  },

  /**
   * Transform code for raw output execution
   */
  transform: (code, ctx) => {
    const language = ctx.language.toLowerCase();

    // For executable languages, execute and return raw result
    if (EXECUTABLE_LANGUAGES.includes(language)) {
      // Rewrite .org imports
      let transformedCode = rewriteOrgImports(code, ctx.orgFilePath);

      // Check if code already uses ES module syntax
      const hasModuleSyntax = usesModuleSyntax(transformedCode);

      if (!hasModuleSyntax) {
        // Wrap in IIFE and export result
        transformedCode = `export default (async () => {\n${transformedCode}\n})();`;
      }

      return { code: transformedCode };
    }

    // For CSS, return as-is
    if (CSS_LANGUAGES.includes(language)) {
      return { code };
    }

    // For other languages, return raw content
    return {
      code: `export default ${JSON.stringify(code)};`,
    };
  },

  defaultExtension: "js",
});

// Override the plugin name for clarity
rawPlugin.name = "raw";

// Expose v1-compatible properties for backward compatibility
(rawPlugin as any).defaultExtension = "js";
(rawPlugin as any).languages = ALL_LANGUAGES;

// v1-compatible matches function
(rawPlugin as any).matches = (block: { meta?: string | null }) => {
  if (!block.meta) return false;
  const useMatch = block.meta.match(/:use\s+((?:[^:]|:(?!\w))+?)(?=\s*:\w|$)/);
  if (!useMatch) return false;
  const useValue = useMatch[1].trim();
  const firstPart = useValue.split("|")[0].trim();
  return firstPart === "raw";
};

// v1-compatible transform function
(rawPlugin as any).transform = async (
  block: { value: string; language: string; meta?: string | null },
  ctx: { orgFilePath: string }
) => {
  const language = block.language.toLowerCase();

  // For executable languages, execute and return raw result
  if (EXECUTABLE_LANGUAGES.includes(language)) {
    // Rewrite .org imports
    let code = rewriteOrgImports(block.value, ctx.orgFilePath);

    // Check if code already uses ES module syntax
    const hasModuleSyntax = usesModuleSyntax(code);

    if (!hasModuleSyntax) {
      // Wrap in IIFE and export result
      code = `export default (async () => {\n${code}\n})();`;
    }

    return { code };
  }

  // For CSS, return as-is
  if (CSS_LANGUAGES.includes(language)) {
    return { code: block.value };
  }

  // For other languages, return raw content
  return {
    code: `export default ${JSON.stringify(block.value)};`,
  };
};
