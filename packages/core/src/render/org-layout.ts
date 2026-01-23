/**
 * Org-defined Layout System
 *
 * Layouts can be defined in .org files by:
 * 1. Creating a named code block with the layout function
 * 2. Referencing it with #+LAYOUT: #blockName
 *
 * Example:
 * ```org
 * #+TITLE: My Page
 * #+LAYOUT: #my-layout
 *
 * #+NAME: my-layout
 * #+begin_src js
 * function layout({ content, metadata, head, scripts }) {
 *   return `<!DOCTYPE html>
 *     <html>
 *       <head><title>${metadata.title}</title>${head}</head>
 *       <body>${content}${scripts}</body>
 *     </html>`;
 * }
 * #+end_src
 *
 * * Content
 * Hello world
 * ```
 *
 * Similarly for content wrappers:
 * #+WRAPPER: #my-wrapper
 */

import type { OrgData } from "uniorg";
import type { PageMetadata } from "../config/types.ts";
import { parseBlockParameters } from "../plugins/utils.ts";
import {
  isCrossFileLayoutRef,
  loadCrossFileLayout,
} from "./cross-file-layout.ts";

/**
 * Types of layout blocks supported
 */
export type LayoutBlockType = "html" | "jsx" | "tsx" | "js" | "ts";

/**
 * Extracted layout block
 */
export interface LayoutBlock {
  /** Block name */
  name: string;
  /** Block type */
  type: LayoutBlockType;
  /** Source code of the block */
  code: string;
  /** Block language */
  language: string;
}

/**
 * Result of extracting layouts from an org file
 */
export interface ExtractedLayouts {
  /** Full page layout (from #+LAYOUT: #blockName) */
  layout?: LayoutBlock;
  /** Content wrapper (from #+WRAPPER: #blockName) */
  wrapper?: LayoutBlock;
  /** AST with layout/wrapper blocks removed */
  contentAst: OrgData;
}

/**
 * Layout function context
 *
 * Passed to layout functions when rendering.
 */
export interface LayoutContext {
  /** Rendered HTML content */
  content: string;
  /** Page metadata */
  metadata: PageMetadata;
  /** Injected head elements */
  head?: string;
  /** Injected script elements */
  scripts?: string;
  /** Base URL path */
  base?: string;
}

/**
 * Layout function signature
 *
 * A layout is a function that takes context and returns HTML string.
 */
export type LayoutFunction = (ctx: LayoutContext) => string | Promise<string>;

/**
 * Wrapper function context
 */
export interface WrapperContext {
  /** Rendered HTML content */
  content: string;
  /** Page metadata */
  metadata: PageMetadata;
}

/**
 * Wrapper function signature
 */
export type WrapperFunction = (ctx: WrapperContext) => string | Promise<string>;

/**
 * Determine block type from language
 */
function getBlockType(language: string): LayoutBlockType {
  const lang = language.toLowerCase();
  if (lang === "jsx") return "jsx";
  if (lang === "tsx") return "tsx";
  if (lang === "javascript" || lang === "js") return "js";
  if (lang === "typescript" || lang === "ts") return "ts";
  return "html";
}

/**
 * Find a named block in the AST
 *
 * @param ast - Parsed org AST
 * @param blockName - Name of the block to find (without #)
 * @returns The block node or undefined
 */
function findNamedBlock(ast: OrgData, blockName: string): any | undefined {
  let foundBlock: any | undefined;

  function walk(node: any): void {
    if (foundBlock || !node) return;

    if (node.type === "src-block") {
      const name = node.affiliated?.NAME;
      if (name === blockName) {
        foundBlock = node;
        return;
      }
    }

    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        walk(child);
      }
    }
  }

  walk(ast);
  return foundBlock;
}

/**
 * Extract layout reference from metadata
 *
 * Looks for #+LAYOUT: #blockName and #+WRAPPER: #blockName
 */
function extractLayoutReference(metadata: PageMetadata): {
  layoutRef?: string;
  wrapperRef?: string;
} {
  const layoutRef = metadata.layout;
  const wrapperRef = metadata.wrapper;

  return {
    layoutRef: layoutRef?.startsWith("#") ? layoutRef.slice(1) : undefined,
    wrapperRef: wrapperRef?.startsWith("#") ? wrapperRef.slice(1) : undefined,
  };
}

/**
 * Extract layout and wrapper from org AST
 *
 * Finds blocks referenced by #+LAYOUT: #blockName and #+WRAPPER: #blockName
 * and returns them along with an AST that has those blocks removed.
 *
 * @param ast - Parsed org-mode AST
 * @param metadata - Extracted metadata containing LAYOUT and WRAPPER keywords
 * @returns Extracted layouts and cleaned AST
 */
export function extractOrgLayouts(
  ast: OrgData,
  metadata: PageMetadata
): ExtractedLayouts {
  let layout: LayoutBlock | undefined;
  let wrapper: LayoutBlock | undefined;

  // Get layout/wrapper references from metadata
  const { layoutRef, wrapperRef } = extractLayoutReference(metadata);

  // Deep clone the AST to avoid modifying the original
  const clonedAst = JSON.parse(JSON.stringify(ast)) as OrgData;

  // Track block names to remove
  const blocksToRemove = new Set<string>();

  // Find layout block
  if (layoutRef) {
    const block = findNamedBlock(ast, layoutRef);
    if (block) {
      layout = {
        name: layoutRef,
        type: getBlockType(block.language || "js"),
        code: block.value || "",
        language: block.language || "javascript",
      };
      blocksToRemove.add(layoutRef);
    } else {
      console.warn(`[org-layout] Layout block not found: #${layoutRef}`);
    }
  }

  // Find wrapper block
  if (wrapperRef) {
    const block = findNamedBlock(ast, wrapperRef);
    if (block) {
      wrapper = {
        name: wrapperRef,
        type: getBlockType(block.language || "js"),
        code: block.value || "",
        language: block.language || "javascript",
      };
      blocksToRemove.add(wrapperRef);
    } else {
      console.warn(`[org-layout] Wrapper block not found: #${wrapperRef}`);
    }
  }

  // Remove layout/wrapper blocks from cloned AST
  if (blocksToRemove.size > 0) {
    removeNamedBlocks(clonedAst, blocksToRemove);
  }

  return {
    layout,
    wrapper,
    contentAst: clonedAst,
  };
}

/**
 * Remove named blocks from AST
 */
function removeNamedBlocks(ast: OrgData, names: Set<string>): void {
  function walk(node: any): void {
    if (!node) return;

    if (node.children && Array.isArray(node.children)) {
      // Filter out blocks with matching names
      node.children = node.children.filter((child: any) => {
        if (child.type === "src-block") {
          const name = child.affiliated?.NAME;
          if (name && names.has(name)) {
            return false; // Remove this block
          }
        }
        return true;
      });

      // Recurse into remaining children
      for (const child of node.children) {
        walk(child);
      }
    }
  }

  walk(ast);
}

/**
 * Create a layout function from extracted block code
 *
 * Compiles the layout code into an executable function.
 * The function receives a LayoutContext and returns HTML string.
 *
 * @param block - Extracted layout block
 * @returns Compiled layout function
 */
export async function createLayoutFunction(block: LayoutBlock): Promise<LayoutFunction> {
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

  // The code can either:
  // 1. Define a function named 'layout' or 'Layout'
  // 2. Export default a function
  // 3. Be a direct function expression
  const wrappedCode = `
    const exports = {};
    const module = { exports: {} };
    ${block.code}
    // Try to find the layout function
    if (typeof layout === 'function') return layout;
    if (typeof Layout === 'function') return Layout;
    if (typeof exports.default === 'function') return exports.default;
    if (typeof module.exports === 'function') return module.exports;
    if (typeof module.exports.default === 'function') return module.exports.default;
    throw new Error('No layout function found. Define a function named "layout" or "Layout".');
  `;

  try {
    const fn = new AsyncFunction(wrappedCode);
    const layoutFn = await fn();

    if (typeof layoutFn !== "function") {
      throw new Error("Layout block must define a function");
    }

    return layoutFn;
  } catch (error) {
    console.error("[org-layout] Failed to compile layout function:", error);
    // Return a fallback layout
    return (ctx: LayoutContext) => `<!DOCTYPE html>
<html>
<head>${ctx.head || ""}</head>
<body>${ctx.content}${ctx.scripts || ""}</body>
</html>`;
  }
}

/**
 * Create a wrapper function from extracted block code
 *
 * @param block - Extracted wrapper block
 * @returns Compiled wrapper function
 */
export async function createWrapperFunction(block: LayoutBlock): Promise<WrapperFunction> {
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

  const wrappedCode = `
    const exports = {};
    const module = { exports: {} };
    ${block.code}
    // Try to find the wrapper function
    if (typeof wrapper === 'function') return wrapper;
    if (typeof Wrapper === 'function') return Wrapper;
    if (typeof exports.default === 'function') return exports.default;
    if (typeof module.exports === 'function') return module.exports;
    if (typeof module.exports.default === 'function') return module.exports.default;
    throw new Error('No wrapper function found. Define a function named "wrapper" or "Wrapper".');
  `;

  try {
    const fn = new AsyncFunction(wrappedCode);
    const wrapperFn = await fn();

    if (typeof wrapperFn !== "function") {
      throw new Error("Wrapper block must define a function");
    }

    return wrapperFn;
  } catch (error) {
    console.error("[org-layout] Failed to compile wrapper function:", error);
    // Return a passthrough wrapper
    return (ctx: WrapperContext) => ctx.content;
  }
}

/**
 * Apply content wrapper to rendered content
 *
 * @param wrapperFn - Compiled wrapper function
 * @param content - Rendered HTML content
 * @param metadata - Page metadata
 * @returns Wrapped content HTML
 */
export async function applyContentWrapper(
  wrapperFn: WrapperFunction,
  content: string,
  metadata: PageMetadata
): Promise<string> {
  return wrapperFn({ content, metadata });
}

/**
 * Apply layout to content
 *
 * @param layoutFn - Compiled layout function
 * @param content - Wrapped/raw content HTML
 * @param metadata - Page metadata
 * @param head - Head elements to inject
 * @param scripts - Script elements to inject
 * @param base - Base URL path
 * @returns Full HTML document
 */
export async function applyLayout(
  layoutFn: LayoutFunction,
  content: string,
  metadata: PageMetadata,
  head: string = "",
  scripts: string = "",
  base: string = "/"
): Promise<string> {
  return layoutFn({ content, metadata, head, scripts, base });
}

/**
 * Check if org file has custom layout defined (self-reference with #)
 *
 * Returns true for #+LAYOUT: #blockName
 */
export function hasOrgLayout(metadata: PageMetadata): boolean {
  return typeof metadata.layout === "string" && metadata.layout.startsWith("#");
}

/**
 * Check if org file has custom content wrapper defined
 */
export function hasOrgWrapper(metadata: PageMetadata): boolean {
  return typeof metadata.wrapper === "string" && metadata.wrapper.startsWith("#");
}

/**
 * Check if org file specifies a theme layout (no # prefix)
 *
 * Returns true for #+LAYOUT: themeName (where themeName doesn't start with #)
 * This indicates the layout should be loaded from .org-press/themes/
 */
export function hasThemeLayout(metadata: PageMetadata): boolean {
  // Check for cross-file layout first (e.g., ./layouts.org#base)
  if (isCrossFileLayoutRef(metadata.layout)) {
    return false;
  }
  return typeof metadata.layout === "string" &&
         metadata.layout.length > 0 &&
         !metadata.layout.startsWith("#");
}

/**
 * Check if org file has a cross-file layout reference
 *
 * Returns true for #+LAYOUT: ./path.org#blockName
 */
export function hasCrossFileLayout(metadata: PageMetadata): boolean {
  return isCrossFileLayoutRef(metadata.layout);
}

/**
 * Check if org file has a cross-file wrapper reference
 *
 * Returns true for #+WRAPPER: ./path.org#blockName
 */
export function hasCrossFileWrapper(metadata: PageMetadata): boolean {
  return isCrossFileLayoutRef(metadata.wrapper);
}

/**
 * Options for async layout extraction
 */
export interface ExtractLayoutsOptions {
  /** Absolute path to the current .org file */
  currentOrgFile: string;
  /** Content directory root (for absolute cross-file paths) */
  contentDir: string;
  /** Dev mode flag for cache invalidation */
  devMode?: boolean;
}

/**
 * Get the theme layout name from metadata
 *
 * @returns Layout name or undefined if not a theme layout
 */
export function getThemeLayoutName(metadata: PageMetadata): string | undefined {
  if (hasThemeLayout(metadata)) {
    return metadata.layout;
  }
  return undefined;
}

/**
 * Extract layout and wrapper from org AST with cross-file support
 *
 * This async version can load layouts/wrappers from external .org files
 * when using cross-file references like #+LAYOUT: ./layouts.org#base
 *
 * @param ast - Parsed org-mode AST
 * @param metadata - Extracted metadata containing LAYOUT and WRAPPER keywords
 * @param options - Options including current file path and content directory
 * @returns Extracted layouts and cleaned AST
 */
export async function extractOrgLayoutsAsync(
  ast: OrgData,
  metadata: PageMetadata,
  options: ExtractLayoutsOptions
): Promise<ExtractedLayouts> {
  let layout: LayoutBlock | undefined;
  let wrapper: LayoutBlock | undefined;

  const { currentOrgFile, contentDir, devMode = false } = options;

  // Deep clone the AST to avoid modifying the original
  const clonedAst = JSON.parse(JSON.stringify(ast)) as OrgData;

  // Track block names to remove (for self-references only)
  const blocksToRemove = new Set<string>();

  // Handle layout reference
  const layoutRef = metadata.layout;
  if (layoutRef) {
    if (isCrossFileLayoutRef(layoutRef)) {
      // Cross-file layout reference
      layout = await loadCrossFileLayout(layoutRef, currentOrgFile, contentDir, devMode);
    } else if (layoutRef.startsWith("#")) {
      // Self-reference layout
      const blockName = layoutRef.slice(1);
      const block = findNamedBlock(ast, blockName);
      if (block) {
        layout = {
          name: blockName,
          type: getBlockType(block.language || "js"),
          code: block.value || "",
          language: block.language || "javascript",
        };
        blocksToRemove.add(blockName);
      } else {
        console.warn(`[org-layout] Layout block not found: #${blockName}`);
      }
    }
    // If layoutRef doesn't start with # and isn't cross-file, it's a theme name (handled elsewhere)
  }

  // Handle wrapper reference
  const wrapperRef = metadata.wrapper;
  if (wrapperRef) {
    if (isCrossFileLayoutRef(wrapperRef)) {
      // Cross-file wrapper reference
      wrapper = await loadCrossFileLayout(wrapperRef, currentOrgFile, contentDir, devMode);
    } else if (wrapperRef.startsWith("#")) {
      // Self-reference wrapper
      const blockName = wrapperRef.slice(1);
      const block = findNamedBlock(ast, blockName);
      if (block) {
        wrapper = {
          name: blockName,
          type: getBlockType(block.language || "js"),
          code: block.value || "",
          language: block.language || "javascript",
        };
        blocksToRemove.add(blockName);
      } else {
        console.warn(`[org-layout] Wrapper block not found: #${blockName}`);
      }
    }
  }

  // Remove self-reference layout/wrapper blocks from cloned AST
  if (blocksToRemove.size > 0) {
    removeNamedBlocks(clonedAst, blocksToRemove);
  }

  return {
    layout,
    wrapper,
    contentAst: clonedAst,
  };
}

/**
 * Render org file with its embedded layout
 *
 * Full pipeline: extract layouts -> render content -> apply wrapper -> apply layout
 *
 * @param ast - Parsed org AST
 * @param metadata - Page metadata
 * @param renderContent - Function to render the content AST to HTML
 * @param head - Head elements to inject
 * @param scripts - Scripts to inject
 * @returns Full HTML document (or just content if no layout)
 */
export async function renderWithOrgLayout(
  ast: OrgData,
  metadata: PageMetadata,
  renderContent: (ast: OrgData) => Promise<string>,
  head: string = "",
  scripts: string = ""
): Promise<{ html: string; hasLayout: boolean }> {
  // Extract layouts and clean AST
  const { layout, wrapper, contentAst } = extractOrgLayouts(ast, metadata);

  // Render the content (without layout/wrapper blocks)
  let content = await renderContent(contentAst);

  // Apply wrapper if defined
  if (wrapper) {
    const wrapperFn = await createWrapperFunction(wrapper);
    content = await applyContentWrapper(wrapperFn, content, metadata);
  }

  // Apply layout if defined
  if (layout) {
    const layoutFn = await createLayoutFunction(layout);
    const html = await applyLayout(layoutFn, content, metadata, head, scripts);
    return { html, hasLayout: true };
  }

  // No layout defined - return content only (caller should apply default layout)
  return { html: content, hasLayout: false };
}

/**
 * Render org file with cross-file layout support
 *
 * Full pipeline: extract layouts (including cross-file) -> render content -> apply wrapper -> apply layout
 *
 * This version supports cross-file references:
 * - #+LAYOUT: ./layouts.org#base
 * - #+WRAPPER: ../shared/wrappers.org#article
 *
 * @param ast - Parsed org AST
 * @param metadata - Page metadata
 * @param renderContent - Function to render the content AST to HTML
 * @param options - Options including current file path and content directory
 * @param head - Head elements to inject
 * @param scripts - Scripts to inject
 * @returns Full HTML document (or just content if no layout)
 */
export async function renderWithOrgLayoutAsync(
  ast: OrgData,
  metadata: PageMetadata,
  renderContent: (ast: OrgData) => Promise<string>,
  options: ExtractLayoutsOptions,
  head: string = "",
  scripts: string = ""
): Promise<{ html: string; hasLayout: boolean }> {
  // Extract layouts with cross-file support
  const { layout, wrapper, contentAst } = await extractOrgLayoutsAsync(
    ast,
    metadata,
    options
  );

  // Render the content (without layout/wrapper blocks)
  let content = await renderContent(contentAst);

  // Apply wrapper if defined
  if (wrapper) {
    const wrapperFn = await createWrapperFunction(wrapper);
    content = await applyContentWrapper(wrapperFn, content, metadata);
  }

  // Apply layout if defined
  if (layout) {
    const layoutFn = await createLayoutFunction(layout);
    const html = await applyLayout(layoutFn, content, metadata, head, scripts);
    return { html, hasLayout: true };
  }

  // No layout defined - return content only (caller should apply default layout)
  return { html: content, hasLayout: false };
}
