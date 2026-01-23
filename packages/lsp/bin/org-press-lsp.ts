/**
 * org-press-lsp CLI
 *
 * LSP server for org-press code blocks
 *
 * Usage:
 *   org-press-lsp [options]
 *
 * Options:
 *   --content-dir <dir>   Content directory (default: "content")
 *   --no-diagnostics      Disable diagnostics
 *   --help                Show help
 *   --version             Show version
 */

import { startLspServer } from "../src/index.js";

interface CliOptions {
  contentDir: string;
  enableDiagnostics: boolean;
  help: boolean;
  version: boolean;
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    contentDir: "content",
    enableDiagnostics: true,
    help: false,
    version: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case "--content-dir":
      case "-c":
        options.contentDir = args[++i] || "content";
        break;

      case "--no-diagnostics":
        options.enableDiagnostics = false;
        break;

      case "--help":
      case "-h":
        options.help = true;
        break;

      case "--version":
      case "-v":
        options.version = true;
        break;
    }
  }

  return options;
}

function showHelp(): void {
  console.log(`
org-press-lsp - LSP server for org-press code blocks

USAGE:
  org-press-lsp [options]

OPTIONS:
  --content-dir, -c <dir>   Content directory containing org files
                            Default: "content"

  --no-diagnostics          Disable TypeScript diagnostics

  --help, -h                Show this help message

  --version, -v             Show version

DESCRIPTION:
  This LSP server provides IDE features for code blocks in org-mode files:
  - Auto-completion for TypeScript/JavaScript
  - Hover information with type signatures
  - Go-to-definition within blocks
  - Type-checking diagnostics

EMACS INTEGRATION:
  Add to your init.el:

    (require 'org-press-lsp)
    (add-hook 'org-mode-hook #'org-press-lsp-enable)

  Or with use-package:

    (use-package org-press-lsp
      :hook (org-mode . org-press-lsp-enable))

EXAMPLES:
  Start server with default options:
    org-press-lsp

  Start with custom content directory:
    org-press-lsp --content-dir src/content

  Start without diagnostics:
    org-press-lsp --no-diagnostics
`);
}

function showVersion(): void {
  console.log("org-press-lsp 0.1.0");
}

function main(): void {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  if (options.version) {
    showVersion();
    process.exit(0);
  }

  // Start the LSP server
  console.error("[org-press-lsp] Starting LSP server...");
  console.error(`[org-press-lsp] Content directory: ${options.contentDir}`);
  console.error(`[org-press-lsp] Diagnostics: ${options.enableDiagnostics ? "enabled" : "disabled"}`);

  startLspServer({
    contentDir: options.contentDir,
    enableDiagnostics: options.enableDiagnostics,
  });
}

main();
