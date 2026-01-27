import { defineConfig } from "vite";
import { orgPress } from "org-press/vite";

export default defineConfig(async () => {
  // Load org-press config
  const config = await import("./.org-press/config.ts");

  return {
    plugins: await orgPress(config.default),
  };
});
