import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/test-wrapper.tsx"],
  format: ["esm"],
  dts: true,
  clean: true,
  external: [
    "org-press",
    "vitest",
    "vitest/node",
    "vite",
    "react",
    "react-dom",
    "uniorg",
    "uniorg-parse",
  ],
});
