/**
 * Types for @org-press/lint
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
