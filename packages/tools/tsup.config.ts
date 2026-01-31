import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  external: [
    "org-press",
    "prettier",
    "eslint",
    "typescript",
    "uniorg",
    "uniorg-parse",
  ],
});
