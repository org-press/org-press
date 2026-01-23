import { parseBlockParameters } from "../plugins/utils.ts";
import { resolveUse } from "../plugins/pipe-parser.ts";
import type { BlockParameters } from "./types.ts";

/**
 * Parameter parsing for code blocks
 *
 * Parses org-mode block parameters into typed structures.
 * The `:use` parameter controls block behavior through the Preview API.
 */

/**
 * Parse code block parameters into typed structure
 *
 * Takes the raw meta string from a code block and extracts all parameters
 * into a typed BlockParameters object.
 *
 * @param meta - Raw meta string from code block
 * @returns Parsed and typed block parameters
 *
 * @example
 * parseCodeBlockParameters(":use preview | withSourceCode")
 * // Returns: {
 * //   use: "preview | withSourceCode"
 * // }
 *
 * @example
 * parseCodeBlockParameters(":use server | json :height 400px")
 * // Returns: {
 * //   use: "server | json",
 * //   height: "400px"
 * // }
 */
export function parseCodeBlockParameters(
  meta: string | null | undefined
): BlockParameters {
  // Use the shared utility to parse raw parameters
  const raw = parseBlockParameters(meta);

  // Return typed parameters
  const params: BlockParameters = {
    ...raw,
  };

  return params;
}

/**
 * Check if block should be included in output
 *
 * Blocks are included unless they use the "silent" mode.
 *
 * @param params - Block parameters
 * @returns True if block should be included in output
 */
export function shouldExportBlock(params: BlockParameters): boolean {
  // Get the mode from :use (first segment before any pipe)
  const useValue = params.use || "preview";
  const mode = useValue.split("|")[0].trim();

  // Silent mode means no output
  return mode !== "silent";
}

/**
 * Check if block should execute on server
 *
 * @param params - Block parameters
 * @returns True if :use server or :use server | ...
 */
export function isServerBlock(params: BlockParameters): boolean {
  const useValue = params.use || "";
  const mode = useValue.split("|")[0].trim();
  return mode === "server";
}

/**
 * Check if block should be executed (by orgp CLI)
 *
 * @param params - Block parameters
 * @returns True if :exec parameter is present or :use server
 */
export function isExecBlock(params: BlockParameters): boolean {
  return params.exec !== undefined || isServerBlock(params);
}

/**
 * Check if block should be tangled (written to external file)
 *
 * @param params - Block parameters
 * @returns True if tangle parameter is present
 */
export function shouldTangle(params: BlockParameters): boolean {
  return Boolean(params.tangle);
}

/**
 * Check if block should show source code
 *
 * Source code is shown for:
 * - sourceOnly mode
 * - Any mode with withSourceCode wrapper
 *
 * @param params - Block parameters
 * @returns True if source code should be shown
 */
export function shouldShowSource(params: BlockParameters): boolean {
  const useValue = params.use || "preview";
  const mode = useValue.split("|")[0].trim();

  // sourceOnly mode always shows source
  if (mode === "sourceOnly") {
    return true;
  }

  // Check if withSourceCode wrapper is in the pipeline
  return useValue.includes("withSourceCode");
}

/**
 * Get the resolved :use value for a block
 *
 * Resolves the :use value based on:
 * 1. Explicit :use parameter
 * 2. Language-specific defaults
 * 3. Global default
 *
 * @param params - Block parameters
 * @param language - Block language
 * @param config - Optional config with defaults
 * @returns Resolved :use value
 */
export function getResolvedUse(
  params: BlockParameters,
  language: string,
  config?: { defaultUse?: string; languageDefaults?: Record<string, string> }
): string {
  return resolveUse({
    useParam: params.use,
    language,
    defaultUse: config?.defaultUse,
    languageDefaults: config?.languageDefaults,
  });
}
