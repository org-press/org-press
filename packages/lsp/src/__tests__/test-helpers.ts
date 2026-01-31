/**
 * Test Helpers for LSP Tests
 *
 * Provides utilities for creating test scenarios, parsing cursor positions,
 * and setting up test services.
 */

import { tmpdir } from "os";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import type { Position } from "vscode-languageserver/node.js";
import { TextDocument } from "vscode-languageserver-textdocument";
import type { BlockInfo, BlockManifest } from "org-press";
import { TypeScriptService } from "../typescript-service.js";
import { TypeScriptVirtualEnv } from "../virtual-fs.js";

/**
 * Marker for cursor position in test content
 */
export const CURSOR_MARKER = "$CURSOR$";

/**
 * Parse content with cursor marker and return position
 */
export function parseCursorPosition(content: string): {
  content: string;
  position: Position;
  offset: number;
} {
  const markerIndex = content.indexOf(CURSOR_MARKER);
  if (markerIndex === -1) {
    throw new Error(`No ${CURSOR_MARKER} marker found in content`);
  }

  const cleanContent = content.replace(CURSOR_MARKER, "");
  const beforeCursor = content.slice(0, markerIndex);
  const lines = beforeCursor.split("\n");
  const line = lines.length - 1;
  const character = lines[lines.length - 1].length;

  return {
    content: cleanContent,
    position: { line, character },
    offset: markerIndex,
  };
}

/**
 * Create a temporary test directory
 */
export function createTempDir(prefix: string = "lsp-test"): string {
  const dir = join(tmpdir(), `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Write a file to a directory
 */
export function writeTestFile(dir: string, relativePath: string, content: string): string {
  const fullPath = join(dir, relativePath);
  const parentDir = join(fullPath, "..");
  mkdirSync(parentDir, { recursive: true });
  writeFileSync(fullPath, content, "utf-8");
  return fullPath;
}

/**
 * Clean up a test directory
 */
export function cleanupDir(dir: string): void {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Create a test manifest with blocks
 */
export function createTestManifest(blocks: BlockInfo[]): BlockManifest {
  const blocksByFile = new Map<string, BlockInfo[]>();
  const blocksByVirtualId = new Map<string, BlockInfo>();

  for (const block of blocks) {
    const existing = blocksByFile.get(block.orgFilePath) || [];
    existing.push(block);
    blocksByFile.set(block.orgFilePath, existing);
    blocksByVirtualId.set(block.virtualModuleId, block);
  }

  return {
    blocksByFile,
    blocksByVirtualId,
    projectRoot: "/test",
    contentDir: "/test/content",
  };
}

/**
 * Create a mock BlockInfo
 */
export function createBlockInfo(options: {
  name: string;
  content: string;
  language?: string;
  orgFilePath: string;
  startLine: number;
  index?: number;
}): BlockInfo {
  const lines = options.content.split("\n");
  const endLine = options.startLine + lines.length - 1;
  const language = options.language || "typescript";
  const index = options.index || 0;

  return {
    name: options.name,
    content: options.content,
    language,
    orgFilePath: options.orgFilePath,
    virtualModuleId: `virtual:org-block:${options.orgFilePath}/${options.name}`,
    startLine: options.startLine,
    endLine,
    index,
  };
}

/**
 * Create a TextDocument for testing
 */
export function createTextDocument(uri: string, content: string): TextDocument {
  return TextDocument.create(uri, "org", 1, content);
}

/**
 * Test context for integration tests
 */
export interface TestContext {
  projectRoot: string;
  contentDir: string;
  cleanup: () => void;
}

/**
 * Create a test context with temp directories
 */
export function createTestContext(): TestContext {
  const projectRoot = createTempDir("lsp-project");
  const contentDir = join(projectRoot, "content");
  mkdirSync(contentDir, { recursive: true });

  return {
    projectRoot,
    contentDir,
    cleanup: () => cleanupDir(projectRoot),
  };
}

/**
 * Create a TypeScriptService for testing with pre-loaded blocks
 */
export async function createTestService(
  ctx: TestContext,
  orgFiles: Record<string, string>
): Promise<TypeScriptService> {
  // Write org files
  for (const [relativePath, content] of Object.entries(orgFiles)) {
    writeTestFile(ctx.contentDir, relativePath, content);
  }

  const service = new TypeScriptService({
    contentDir: ctx.contentDir,
    projectRoot: ctx.projectRoot,
  });

  await service.initialize();
  return service;
}

/**
 * Create a pre-configured TypeScriptVirtualEnv for unit tests
 */
export function createTestEnv(): TypeScriptVirtualEnv {
  return new TypeScriptVirtualEnv();
}

/**
 * Get offset for a line and character in content
 */
export function getOffset(content: string, line: number, character: number): number {
  const lines = content.split("\n");
  let offset = 0;
  for (let i = 0; i < line; i++) {
    offset += lines[i].length + 1; // +1 for newline
  }
  return offset + character;
}

/**
 * Extract a position from content using a pattern
 * Returns position at the start of the pattern match
 */
export function findPosition(content: string, pattern: string | RegExp): Position {
  const match = typeof pattern === "string"
    ? content.indexOf(pattern)
    : content.search(pattern);

  if (match === -1) {
    throw new Error(`Pattern not found in content: ${pattern}`);
  }

  const beforeMatch = content.slice(0, match);
  const lines = beforeMatch.split("\n");

  return {
    line: lines.length - 1,
    character: lines[lines.length - 1].length,
  };
}

/**
 * Create org file content with code blocks
 */
export function createOrgContent(blocks: Array<{
  name: string;
  language?: string;
  content: string;
}>): string {
  const parts: string[] = ["#+TITLE: Test File", ""];

  for (const block of blocks) {
    const lang = block.language || "typescript";
    parts.push(`#+name: ${block.name}`);
    parts.push(`#+begin_src ${lang}`);
    parts.push(block.content);
    parts.push("#+end_src");
    parts.push("");
  }

  return parts.join("\n");
}
