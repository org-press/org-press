/**
 * DTS Generation Module
 *
 * Provides TypeScript declaration file generation for org-mode code blocks.
 * This module enables IDE features like completion, hover, and diagnostics
 * for code blocks inside org files.
 *
 * Key exports:
 * - DtsGenerator: Main class for generating .d.ts files
 * - generateBlockManifest: Create manifest of all blocks in project
 * - Position mapping utilities: Convert between org and block positions
 *
 * @example
 * ```typescript
 * import { DtsGenerator, generateBlockManifest } from "org-press/dts";
 *
 * // Generate DTS files for a project
 * const generator = new DtsGenerator({
 *   contentDir: "content",
 *   outDir: "dist/types",
 * });
 *
 * await generator.loadBlocks();
 * await generator.writeDeclarations();
 *
 * // Or just generate a manifest
 * const manifest = await generateBlockManifest("content");
 * console.log(`Found ${manifest.blocksByVirtualId.size} blocks`);
 * ```
 */

// Types
export type {
  BlockInfo,
  BlockManifest,
  Position,
  Range,
  Location,
  OrgToBlockResult,
  BlockToOrgResult,
  DtsGeneratorOptions,
  DtsGenerationResult,
  SerializableBlockInfo,
  SerializableManifest,
} from "./types.ts";

// Manifest generation
export {
  extractBlocksFromFile,
  generateBlockManifest,
  filterTsJsBlocks,
  isTsJsLanguage,
  TS_JS_LANGUAGES,
  EXTENSION_MAP,
} from "./manifest.ts";

// Position mapping
export {
  orgToBlock,
  blockToOrg,
  mapRangeToOrg,
  mapRangeToBlock,
  mapLocationToOrg,
  offsetToPosition,
  positionToOffset,
  isInsideBlock,
  getBlockAtLine,
} from "./position-mapping.ts";

// DTS Generator (will be added in generator.ts)
export { DtsGenerator } from "./generator.ts";
