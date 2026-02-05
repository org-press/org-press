/**
 * Block Manifest Generation
 *
 * Utilities for generating and managing the block manifest used by the hydration system.
 * The manifest maps block IDs to their bundled JavaScript modules.
 */

import type { BlockManifest, BlockManifestEntry } from "../../client/hydrate.ts";
import type { CollectedBlock } from "../../parser/types.ts";

export type { BlockManifest, BlockManifestEntry, CollectedBlock };

/**
 * Page manifest - blocks collected for a single page
 */
export interface PageManifest {
  /** Route URL for this page */
  route: string;
  /** Blocks that need hydration */
  blocks: CollectedBlock[];
}

/**
 * Site manifest - all blocks across all pages
 */
export interface SiteManifest {
  /** All pages with their blocks */
  pages: PageManifest[];
  /** Unique blocks (deduplicated by cache path) */
  uniqueBlocks: Map<string, CollectedBlock>;
}

/**
 * Create an empty site manifest
 */
export function createSiteManifest(): SiteManifest {
  return {
    pages: [],
    uniqueBlocks: new Map(),
  };
}

/**
 * Add a page's blocks to the site manifest
 */
export function addPageToManifest(
  siteManifest: SiteManifest,
  route: string,
  blocks: CollectedBlock[]
): void {
  siteManifest.pages.push({ route, blocks });

  // Add to unique blocks
  for (const block of blocks) {
    if (!siteManifest.uniqueBlocks.has(block.cachePath)) {
      siteManifest.uniqueBlocks.set(block.cachePath, block);
    }
  }
}

/**
 * Generate the client-side block manifest from Vite's build manifest
 *
 * Maps block IDs to their bundled asset URLs.
 *
 * @param siteManifest - Site manifest with collected blocks
 * @param viteManifest - Vite's build manifest
 * @param base - Base path for URLs
 * @returns Client-side block manifest
 */
export function generateClientManifest(
  siteManifest: SiteManifest,
  viteManifest: Record<string, { file: string; src?: string }>,
  base: string = "/"
): BlockManifest {
  const clientManifest: BlockManifest = {};
  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;

  // Map cache paths to bundled output paths
  const cachePathToOutput = new Map<string, string>();

  for (const [key, value] of Object.entries(viteManifest)) {
    // Vite manifest keys are relative paths
    if (value.file) {
      cachePathToOutput.set(key, `${normalizedBase}/${value.file}`);
    }
  }

  // Generate manifest entries for each page's blocks
  for (const page of siteManifest.pages) {
    for (const block of page.blocks) {
      // Find the bundled output for this block's cache path
      // Try different path formats that might be in the manifest
      let outputPath: string | undefined;

      // Try relative path from cwd
      const relativeCachePath = block.cachePath.replace(process.cwd() + "/", "");
      outputPath = cachePathToOutput.get(relativeCachePath);

      if (!outputPath) {
        // Try with normalized slashes
        const normalizedPath = relativeCachePath.replace(/\\/g, "/");
        outputPath = cachePathToOutput.get(normalizedPath);
      }

      if (!outputPath) {
        // Try just the filename for backwards compatibility
        const filename = block.cachePath.split("/").pop() || "";
        for (const [key, value] of cachePathToOutput.entries()) {
          if (key.endsWith(filename)) {
            outputPath = value;
            break;
          }
        }
      }

      if (outputPath) {
        clientManifest[block.id] = {
          src: outputPath,
          name: block.name,
          language: block.language,
        };
      } else {
        console.warn(
          `[org-press] Could not find bundled output for block: ${block.cachePath}`
        );
      }
    }
  }

  return clientManifest;
}

/**
 * Generate inline manifest script tag
 *
 * Creates a script tag that embeds the manifest in the page.
 *
 * @param manifest - Block manifest for this page
 * @returns HTML script tag
 */
export function generateManifestScript(manifest: BlockManifest): string {
  if (Object.keys(manifest).length === 0) {
    return "";
  }

  const json = JSON.stringify(manifest);
  return `<script>window.__ORG_PRESS_MANIFEST__=${json};</script>`;
}

/**
 * Generate hydration script tag
 *
 * Creates a script tag that loads the hydration script.
 *
 * @param hydrateSrc - Path to the hydration script
 * @returns HTML script tag
 */
export function generateHydrateScript(hydrateSrc: string): string {
  return `<script type="module" src="${hydrateSrc}"></script>`;
}

/**
 * Filter manifest to only include blocks present in the HTML
 *
 * @param fullManifest - Full site manifest
 * @param html - HTML content to check for block IDs
 * @returns Filtered manifest with only blocks in the HTML
 */
export function filterManifestForPage(
  fullManifest: BlockManifest,
  html: string
): BlockManifest {
  const filtered: BlockManifest = {};

  for (const [blockId, entry] of Object.entries(fullManifest)) {
    // Check if this block ID appears in the HTML
    if (html.includes(`data-org-block="${blockId}"`)) {
      filtered[blockId] = entry;
    }
  }

  return filtered;
}
