import { defineConfig } from "vite";

export default defineConfig({
  // Ensure React is deduplicated across all imports
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  // Pre-bundle React for consistent resolution
  optimizeDeps: {
    include: ["react", "react-dom", "react-dom/client"],
  },
});
