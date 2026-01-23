import { defineConfig } from "tsup";

export default defineConfig([
  // Main library entry
  {
    entry: {
      index: "src/index.ts",
    },
    format: ["esm"],
    dts: true,
    clean: true,
    external: ["typescript"],
  },
  // CLI entry with shebang
  {
    entry: {
      "bin/org-press-lsp": "bin/org-press-lsp.ts",
    },
    format: ["esm"],
    dts: true,
    clean: false, // Don't clean on second entry
    external: ["typescript"],
    banner: {
      js: "#!/usr/bin/env node",
    },
  },
]);
