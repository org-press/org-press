import type { OrgPressUserConfig } from "org-press";
import { cssPlugin, serverPlugin } from "org-press";
import { plugin as jscadPlugin } from "@org-press/block-jscad";
import { plugin as excalidrawPlugin } from "@org-press/block-excalidraw";
import { plugin as echartsPlugin } from "@org-press/block-echarts";

/**
 * Org-press configuration for the documentation site
 */
const config: OrgPressUserConfig = {
  contentDir: "content",
  outDir: "dist",
  base: process.env.BASE_PATH || "/",

  theme: ".org-press/themes/docs.ts",

  // Plugins
  plugins: [serverPlugin, cssPlugin, jscadPlugin, excalidrawPlugin, echartsPlugin],
};

export default config;
