/**
 * Format Wrappers
 *
 * Wrappers that format execution results for display.
 * Primarily used with server execution to format output.
 *
 * @example
 * ```org
 * #+begin_src javascript :use server | json
 * return { name: "Alice", age: 30 };
 * #+end_src
 *
 * #+begin_src javascript :use server | yaml
 * return { config: { debug: true } };
 * #+end_src
 *
 * #+begin_src javascript :use server | csv
 * return [{ name: "Alice", age: 30 }, { name: "Bob", age: 25 }];
 * #+end_src
 * ```
 */

export { jsonFormat } from "./json.ts";
export type { JsonFormatConfig } from "./json.ts";
export { yamlFormat } from "./yaml.ts";
export type { YamlFormatConfig } from "./yaml.ts";
export { csvFormat } from "./csv.ts";
export type { CsvFormatConfig } from "./csv.ts";
export { htmlFormat } from "./html.ts";
export type { HtmlFormatConfig } from "./html.ts";

import { jsonFormat } from "./json.ts";
import { yamlFormat } from "./yaml.ts";
import { csvFormat } from "./csv.ts";
import { htmlFormat } from "./html.ts";
import { registerWrapper, type WrapperFactory } from "../wrapper-compose.ts";

/**
 * Map of all built-in format wrappers
 */
export const formatWrappers = {
  json: jsonFormat,
  yaml: yamlFormat,
  csv: csvFormat,
  html: htmlFormat,
} as const;

/**
 * Register all built-in format wrappers with the global registry
 */
export function registerFormatWrappers(): void {
  registerWrapper("json", jsonFormat as WrapperFactory);
  registerWrapper("yaml", yamlFormat as WrapperFactory);
  registerWrapper("csv", csvFormat as WrapperFactory);
  registerWrapper("html", htmlFormat as WrapperFactory);
}

/**
 * Check if a name is a built-in format wrapper
 */
export function isFormat(name: string): boolean {
  return name in formatWrappers;
}
