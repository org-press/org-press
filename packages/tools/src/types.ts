/**
 * Shared types for @org-press/tools
 */

/**
 * A collected code block from an org file
 */
export interface CollectedBlock {
  /** Relative path to the org file */
  orgFilePath: string;
  /** 0-based index of the block in the file */
  blockIndex: number;
  /** Block name from #+NAME: directive */
  blockName?: string;
  /** The source code content */
  code: string;
  /** Block language (e.g., "typescript", "javascript") */
  language: string;
  /** 1-based line number where the block starts (#+begin_src line) */
  startLine: number;
  /** 1-based line number where the block ends (#+end_src line) */
  endLine: number;
}

/**
 * Options for collecting code blocks
 */
export interface CollectOptions {
  /** Filter by file path patterns */
  files?: string[];
  /** Filter by languages */
  languages?: string[];
}

/**
 * Options for the format command
 */
export interface FmtOptions {
  /** Check only, don't write changes */
  check?: boolean;
  /** Write changes (default: true when not checking) */
  write?: boolean;
  /** Filter by languages */
  languages?: string[];
  /** Filter by file patterns */
  files?: string[];
}

/**
 * Options for the lint command
 */
export interface LintOptions {
  /** Auto-fix problems */
  fix?: boolean;
  /** Filter by languages */
  languages?: string[];
  /** Filter by file patterns */
  files?: string[];
}

/**
 * Options for the type-check command
 */
export interface TypeCheckOptions {
  /** Filter by file patterns */
  files?: string[];
}

/**
 * Language to Prettier parser mapping
 */
export const PRETTIER_PARSERS: Record<string, string> = {
  typescript: "typescript",
  ts: "typescript",
  tsx: "typescript",
  javascript: "babel",
  js: "babel",
  jsx: "babel",
  json: "json",
  css: "css",
  scss: "scss",
  less: "less",
  html: "html",
  yaml: "yaml",
  yml: "yaml",
  markdown: "markdown",
  md: "markdown",
  graphql: "graphql",
  gql: "graphql",
};

/**
 * Language to file extension mapping
 */
export const LANGUAGE_EXTENSIONS: Record<string, string> = {
  typescript: "ts",
  ts: "ts",
  tsx: "tsx",
  javascript: "js",
  js: "js",
  jsx: "jsx",
  json: "json",
  css: "css",
  scss: "scss",
  less: "less",
  html: "html",
  yaml: "yaml",
  yml: "yml",
  markdown: "md",
  md: "md",
  graphql: "graphql",
  gql: "graphql",
};

/**
 * Languages that can be linted with ESLint
 */
export const LINT_LANGUAGES = [
  "typescript",
  "ts",
  "tsx",
  "javascript",
  "js",
  "jsx",
];

/**
 * Languages that can be type-checked with TypeScript
 */
export const TYPECHECK_LANGUAGES = ["typescript", "ts", "tsx"];
