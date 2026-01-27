import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "bin/org-press-mcp": "bin/org-press-mcp.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  external: [
    "org-press",
    "@org-press/lsp",
    "@org-press/tools",
  ],
});
