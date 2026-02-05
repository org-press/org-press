import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: false, // Disabled: core doesn't export .d.ts files
  clean: true,
  external: [
    "@org-press/deploy",
  ],
});
