/**
 * Pipe Parser
 *
 * Parses the `:use` parameter pipe syntax for composable Preview API.
 *
 * Syntax: `:use mode | wrapper1 | wrapper2?config=value`
 *
 * Examples:
 * - `:use preview` - just preview mode
 * - `:use preview | withTabs` - preview with tabs wrapper
 * - `:use preview | withSourceCode?position=before` - with query string config
 * - `:use preview | withContainer:{"class":"highlight"}` - with JSON config
 * - `:use server | json` - server mode with JSON formatter
 * - `:use ./utils.org?name=myWrapper` - org file import
 */

/**
 * Parsed pipe segment
 */
export interface PipeSegment {
  /** Segment name (e.g., "preview", "withTabs", "./file.org") */
  name: string;

  /** Configuration object (from ?key=value or :{json}) */
  config?: Record<string, unknown>;

  /** Whether this is an org file import */
  isOrgImport?: boolean;

  /** Block name for org imports (from ?name=...) */
  blockName?: string;
}

/**
 * Parse a pipe string into segments
 *
 * @param useValue - The :use parameter value (e.g., "preview | withTabs?default=code")
 * @returns Array of parsed segments
 *
 * @example
 * parsePipe("preview | withTabs?default=code | withSourceCode")
 * // Returns:
 * // [
 * //   { name: "preview" },
 * //   { name: "withTabs", config: { default: "code" } },
 * //   { name: "withSourceCode" }
 * // ]
 */
export function parsePipe(useValue: string): PipeSegment[] {
  if (!useValue || typeof useValue !== "string") {
    return [];
  }

  // Split by pipe, trim whitespace
  const parts = useValue.split("|").map((p) => p.trim()).filter(Boolean);

  return parts.map(parseSegment);
}

/**
 * Parse a single pipe segment
 *
 * Handles:
 * - Simple name: "preview"
 * - Query string config: "withTabs?default=code&showResult=true"
 * - JSON config: "withContainer:{\"class\":\"highlight\"}"
 * - Org imports: "./file.org?name=myWrapper"
 */
function parseSegment(segment: string): PipeSegment {
  // Check for org file import
  if (segment.includes(".org")) {
    return parseOrgImport(segment);
  }

  // Check for JSON config (name:{...})
  const jsonMatch = segment.match(/^([^:]+):(\{.+\})$/);
  if (jsonMatch) {
    const [, name, jsonStr] = jsonMatch;
    try {
      const config = JSON.parse(jsonStr);
      return { name: name.trim(), config };
    } catch {
      // If JSON parse fails, treat as simple name
      return { name: segment };
    }
  }

  // Check for query string config (name?key=value)
  const queryMatch = segment.match(/^([^?]+)\?(.+)$/);
  if (queryMatch) {
    const [, name, queryStr] = queryMatch;
    const config = parseQueryString(queryStr);
    return { name: name.trim(), config };
  }

  // Simple name
  return { name: segment };
}

/**
 * Parse an org file import segment
 *
 * Format: ./path/to/file.org?name=blockName&otherConfig=value
 */
function parseOrgImport(segment: string): PipeSegment {
  const queryIndex = segment.indexOf("?");

  if (queryIndex === -1) {
    // No query string, just the file path
    return {
      name: segment,
      isOrgImport: true,
    };
  }

  const filePath = segment.slice(0, queryIndex);
  const queryStr = segment.slice(queryIndex + 1);
  const params = parseQueryString(queryStr);

  // Extract blockName from params
  const blockName = params.name as string | undefined;
  delete params.name;

  // Remaining params become config
  const config = Object.keys(params).length > 0 ? params : undefined;

  return {
    name: filePath,
    isOrgImport: true,
    blockName,
    config,
  };
}

/**
 * Parse a query string into key-value pairs
 *
 * Supports:
 * - Simple values: key=value
 * - Boolean shortcuts: key (treated as key=true)
 * - Numeric values: key=123
 * - Boolean strings: key=true, key=false
 */
function parseQueryString(queryStr: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  const pairs = queryStr.split("&");
  for (const pair of pairs) {
    const eqIndex = pair.indexOf("=");

    if (eqIndex === -1) {
      // Boolean shortcut: just "key" means key=true
      result[pair.trim()] = true;
      continue;
    }

    const key = pair.slice(0, eqIndex).trim();
    const value = pair.slice(eqIndex + 1).trim();

    result[key] = parseValue(value);
  }

  return result;
}

/**
 * Parse a string value into appropriate type
 */
function parseValue(value: string): unknown {
  // Handle quoted strings
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  // Handle booleans
  if (value === "true") return true;
  if (value === "false") return false;

  // Handle numbers
  const num = Number(value);
  if (!isNaN(num) && value !== "") {
    return num;
  }

  // Handle null/undefined
  if (value === "null") return null;
  if (value === "undefined") return undefined;

  // Default to string
  return value;
}

/**
 * Check if a use value contains a pipe (multiple segments)
 */
export function hasPipe(useValue: string): boolean {
  return useValue.includes("|");
}

/**
 * Get the first segment (mode) from a use value
 */
export function getMode(useValue: string): string {
  const segments = parsePipe(useValue);
  return segments[0]?.name ?? "preview";
}

/**
 * Get wrapper segments (everything after the first segment)
 */
export function getWrappers(useValue: string): PipeSegment[] {
  const segments = parsePipe(useValue);
  return segments.slice(1);
}

/**
 * Serialize a pipe segment back to string
 */
export function serializeSegment(segment: PipeSegment): string {
  let result = segment.name;

  if (segment.isOrgImport && segment.blockName) {
    result += `?name=${segment.blockName}`;
    if (segment.config) {
      result += "&" + serializeConfig(segment.config);
    }
  } else if (segment.config) {
    // Use query string format for simple configs, JSON for complex
    if (isSimpleConfig(segment.config)) {
      result += "?" + serializeConfig(segment.config);
    } else {
      result += ":" + JSON.stringify(segment.config);
    }
  }

  return result;
}

/**
 * Check if config is simple (flat key-value pairs with primitive values)
 */
function isSimpleConfig(config: Record<string, unknown>): boolean {
  return Object.values(config).every(
    (v) => typeof v === "string" || typeof v === "number" || typeof v === "boolean"
  );
}

/**
 * Serialize config to query string format
 */
function serializeConfig(config: Record<string, unknown>): string {
  return Object.entries(config)
    .map(([k, v]) => {
      if (v === true) return k;
      return `${k}=${v}`;
    })
    .join("&");
}

/**
 * Options for resolving :use value
 */
export interface ResolveUseOptions {
  /** Explicit :use value from block header (if any) */
  useParam?: string;
  /** Block language */
  language: string;
  /** Default :use from config */
  defaultUse?: string;
  /** Language-specific defaults from config */
  languageDefaults?: Record<string, string>;
}

/**
 * Resolve the :use value for a block
 *
 * Priority order:
 * 1. Explicit :use parameter on block
 * 2. Language-specific default from config
 * 3. Global defaultUse from config
 * 4. Built-in default ("preview")
 *
 * @param options - Resolution options
 * @returns Resolved :use value string
 *
 * @example
 * ```typescript
 * // Block with explicit :use
 * resolveUse({ useParam: "server | json", language: "javascript" });
 * // => "server | json"
 *
 * // Block without :use, language has default
 * resolveUse({
 *   language: "css",
 *   languageDefaults: { css: "sourceOnly" }
 * });
 * // => "sourceOnly"
 *
 * // Block without :use, no language default
 * resolveUse({
 *   language: "typescript",
 *   defaultUse: "preview | withSourceCode"
 * });
 * // => "preview | withSourceCode"
 * ```
 */
export function resolveUse(options: ResolveUseOptions): string {
  const {
    useParam,
    language,
    defaultUse = "preview",
    languageDefaults = {},
  } = options;

  // 1. Explicit :use parameter takes priority
  if (useParam !== undefined && useParam !== "") {
    return useParam;
  }

  // 2. Check language-specific default
  if (language && languageDefaults[language]) {
    return languageDefaults[language];
  }

  // 3. Use global default
  return defaultUse;
}
