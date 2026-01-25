import type { OrgPressUserConfig } from "org-press/config-types";
import { reactPlugin } from "@org-press/react";

const config: OrgPressUserConfig = {
  contentDir: "content",
  outDir: "dist",
  theme: ".org-press/themes/layout.tsx",
  plugins: [reactPlugin],
};

export default config;
