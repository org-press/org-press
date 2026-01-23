import { defineConfig } from 'tsup';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'node/vite-plugin-org-press': 'src/node/vite-plugin-org-press.ts',
    'bin/orgp': 'src/bin/orgp.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  onSuccess: async () => {
    // Copy client and node entry files to dist (needed for build command)
    const { rmSync, readdirSync, copyFileSync, existsSync } = await import('node:fs');

    // Copy client folder
    const srcClient = resolve('src/client');
    const distClient = resolve('dist/client');
    try {
      rmSync(distClient, { recursive: true, force: true });
      mkdirSync(distClient, { recursive: true });
      for (const file of readdirSync(srcClient)) {
        copyFileSync(resolve(srcClient, file), resolve(distClient, file));
      }
      console.log('Copied client folder to dist/client');
    } catch (err) {
      console.error('Failed to copy client folder:', err);
    }

    // Copy node entry-generate.tsx
    const srcEntryGenerate = resolve('src/node/entry-generate.tsx');
    const distNode = resolve('dist/node');
    const distEntryGenerate = resolve(distNode, 'entry-generate.tsx');
    try {
      if (!existsSync(distNode)) {
        mkdirSync(distNode, { recursive: true });
      }
      copyFileSync(srcEntryGenerate, distEntryGenerate);
      console.log('Copied entry-generate.tsx to dist/node');
    } catch (err) {
      console.error('Failed to copy entry-generate.tsx:', err);
    }

    // Copy default layout folder (used as fallback when no custom theme exists)
    const srcLayouts = resolve('src/layouts');
    const distLayouts = resolve('dist/layouts');
    try {
      rmSync(distLayouts, { recursive: true, force: true });
      mkdirSync(distLayouts, { recursive: true });
      // Use shell cp command as cpSync has permission issues
      const { execSync } = await import('node:child_process');
      execSync(`cp -r "${srcLayouts}/"* "${distLayouts}/"`);
      console.log('Copied layouts folder to dist/layouts');
    } catch (err) {
      console.error('Failed to copy layouts folder:', err);
    }
  },
  external: [
    'vite',
    'react',
    'react-dom',
    'react-dom/server',
    'esbuild',
    'typescript', // TypeScript uses CommonJS internally
    'eslint', // ESLint dynamically imported at runtime
    // Node.js built-ins
    'node:fs',
    'node:path',
    'node:crypto',
    'node:module',
    'node:os',
  ],
  noExternal: [
    // Bundle these dependencies
  ],
});
