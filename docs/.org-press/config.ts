import type { OrgPressUserConfig } from "org-press";
import { defaultPlugins } from "org-press";
import { plugin as jscadPlugin } from "@org-press/block-jscad";
import { plugin as excalidrawPlugin } from "@org-press/block-excalidraw";
import { plugin as echartsPlugin } from "@org-press/block-echarts";

/**
 * Org-press configuration for the documentation site
 *
 * Uses defaultPlugins which includes:
 * - domPlugin, javascriptPlugin, typescriptPlugin, cssPlugin, serverPlugin
 */
const config: OrgPressUserConfig = {
  contentDir: "content",
  outDir: "dist",
  base: process.env.BASE_PATH || "/",

  theme: ".org-press/themes/docs.ts",

  // Plugins: spread defaultPlugins + add block plugins
  plugins: [...defaultPlugins, jscadPlugin, excalidrawPlugin, echartsPlugin],
};

export default config;
