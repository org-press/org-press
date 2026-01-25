/**
 * Org file execution engine
 *
 * Parses org files and executes blocks marked with :exec, :executable, or :use server.
 * Used by the orgp CLI for running org files as scripts.
 *
 * Supports:
 * - :exec parameter (original)
 * - :executable parameter (new)
 * - :default parameter to mark the default block to run
 * - Running single blocks by name or index
 * - Running the default block in a file
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, isAbsolute } from "node:path";
import { createRequire } from "node:module";
import { parse } from "uniorg-parse/lib/parser.js";
import type { OrgData, SrcBlock } from "uniorg";
import { parseBlockParameters } from "../plugins/utils.ts";
import { extractMetadata } from "../parser/metadata.ts";

const require = createRequire(import.meta.url);

/**
 * Options for executing an org file
 */
export interface ExecuteOptions {
  /** Path to the org file */
  file: string;
  /** Execute only this named block */
  blockName?: string;
  /** Execute all executable blocks (default: only :exec blocks) */
  all?: boolean;
  /** Output as JSON */
  json?: boolean;
  /** Suppress non-output messages */
  quiet?: boolean;
  /** Input from stdin (available as `input` variable) */
  input?: string;
}

/**
 * Result of executing a single block
 */
export interface BlockOutput {
  /** Block index */
  blockIndex: number;
  /** Block name (if named) */
  blockName?: string;
  /** Execution result value */
  value: any;
  /** Execution time in milliseconds */
  executionTime: number;
}

/**
 * Error from executing a block
 */
export interface BlockError {
  /** Block index */
  blockIndex: number;
  /** Block name (if named) */
  blockName?: string;
  /** Error message */
  message: string;
  /** Stack trace */
  stack?: string;
}

/**
 * Result of executing an org file
 */
export interface ExecuteResult {
  /** File path that was executed */
  file: string;
  /** Extracted metadata from org file */
  metadata: Record<string, any>;
  /** Outputs from executed blocks */
  outputs: BlockOutput[];
  /** Errors from failed blocks */
  errors: BlockError[];
  /** Total execution time in milliseconds */
  totalTime: number;
}

/**
 * Parsed executable block
 */
export interface ExecutableBlock {
  /** Block index in file */
  index: number;
  /** Block name from #+NAME: */
  name?: string;
  /** Programming language */
  language: string;
  /** Source code */
  code: string;
  /** Parsed parameters */
  parameters: Record<string, string>;
}

/**
 * Options for running a single block
 */
export interface RunBlockOptions {
  /** Path to the org file */
  file: string;
  /** Block name or index */
  block: string | number;
  /** Arguments to pass to the block */
  args: string[];
  /** Timeout in milliseconds */
  timeout?: number;
  /** Environment variables */
  env?: Record<string, string>;
}

/**
 * Result of running a single block
 */
export interface RunBlockResult {
  /** Exit code (0 for success) */
  exitCode: number;
  /** Standard output */
  stdout: string;
  /** Standard error */
  stderr: string;
  /** Return value from the block */
  value: any;
}

/**
 * Languages supported for execution
 */
const EXECUTABLE_LANGUAGES = ["javascript", "js", "typescript", "ts", "jsx", "tsx"];

/**
 * Check if a block is marked as executable
 *
 * A block is executable if it has:
 * - :exec parameter
 * - :executable parameter
 * - :use server parameter
 */
export function isExecutableBlock(params: Record<string, string>): boolean {
  return (
    params.exec !== undefined ||
    params.executable !== undefined ||
    params.use === "server"
  );
}

/**
 * Check if a block is marked as the default block
 */
export function isDefaultBlock(params: Record<string, string>): boolean {
  return params.default !== undefined;
}

/**
 * Extract executable blocks from org AST
 */
function extractExecutableBlocks(
  ast: OrgData,
  options: ExecuteOptions
): ExecutableBlock[] {
  const blocks: ExecutableBlock[] = [];
  let index = 0;

  function walk(node: any): void {
    if (!node) return;

    if (node.type === "src-block") {
      // Use any cast since uniorg types don't include 'parameters' from uniorg-parse
      const srcBlock = node as any;
      const language = (srcBlock.language?.toLowerCase() || "") as string;
      const params = parseBlockParameters(srcBlock.parameters || null);
      const name = srcBlock.affiliated?.NAME as string | undefined;

      // Check if this block should be executed
      const isTargetLanguage = EXECUTABLE_LANGUAGES.includes(language);
      const isExec = isExecutableBlock(params);
      const isTargetBlock = options.blockName
        ? name === options.blockName
        : true;

      // Include if:
      // 1. Block matches target name (if specified)
      // 2. Language is supported
      // 3. Either: marked as :exec, or --all flag is set
      if (isTargetBlock && isTargetLanguage && (isExec || options.all)) {
        blocks.push({
          index,
          name,
          language,
          code: srcBlock.value || "",
          parameters: params,
        });
      }

      index++;
    }

    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        walk(child);
      }
    }
  }

  walk(ast);
  return blocks;
}

/**
 * Execute a JavaScript code block
 *
 * Creates an AsyncFunction with access to:
 * - require: Node.js require for imports
 * - input: stdin input (if provided)
 * - context: shared execution context (accumulated from previous blocks)
 */
async function executeBlock(
  code: string,
  context: Record<string, any>,
  input: string | undefined
): Promise<any> {
  // Create async function constructor
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

  // Wrap code to allow both explicit return and last expression
  // If code doesn't have explicit return, wrap it to return last expression
  const wrappedCode = code.includes("return ")
    ? code
    : `return (async () => { ${code} })()`;

  // Create function with injected dependencies
  const fn = new AsyncFunction("require", "input", "context", wrappedCode);

  // Execute and return result
  return await fn(require, input, context);
}

/**
 * Execute an org file
 *
 * Main entry point for the execution engine.
 * Parses the org file, extracts executable blocks, and runs them sequentially.
 *
 * @param options - Execution options
 * @returns Execution result with outputs and errors
 *
 * @example
 * const result = await executeOrgFile({ file: "script.org" });
 * console.log(result.outputs[0].value);
 */
export async function executeOrgFile(options: ExecuteOptions): Promise<ExecuteResult> {
  const startTime = Date.now();

  // Resolve file path
  const filePath = isAbsolute(options.file)
    ? options.file
    : resolve(process.cwd(), options.file);

  // Check file exists
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  // Read and parse org file
  const source = readFileSync(filePath, "utf-8");

  // Strip shebang line if present
  const cleanSource = source.startsWith("#!")
    ? source.replace(/^#!.*\n/, "")
    : source;

  const ast = parse(cleanSource) as OrgData;
  const metadata = extractMetadata(ast);

  // Extract executable blocks
  const blocks = extractExecutableBlocks(ast, options);

  if (blocks.length === 0 && !options.quiet) {
    if (options.blockName) {
      console.error(`No executable block found with name: ${options.blockName}`);
    } else {
      console.error("No executable blocks found. Use :exec parameter to mark blocks.");
    }
  }

  // Execute blocks sequentially with shared context
  const outputs: BlockOutput[] = [];
  const errors: BlockError[] = [];
  const context: Record<string, any> = {};

  for (const block of blocks) {
    const blockStartTime = Date.now();

    try {
      const result = await executeBlock(block.code, context, options.input);

      // Store result in context for subsequent blocks
      if (block.name) {
        context[block.name] = result;
      }
      context[`__block_${block.index}`] = result;

      outputs.push({
        blockIndex: block.index,
        blockName: block.name,
        value: result,
        executionTime: Date.now() - blockStartTime,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      errors.push({
        blockIndex: block.index,
        blockName: block.name,
        message: err.message,
        stack: err.stack,
      });
    }
  }

  return {
    file: filePath,
    metadata,
    outputs,
    errors,
    totalTime: Date.now() - startTime,
  };
}

/**
 * Extract all blocks from org AST (for finding by name/index)
 */
function extractAllBlocks(ast: OrgData): ExecutableBlock[] {
  const blocks: ExecutableBlock[] = [];
  let index = 0;

  function walk(node: any): void {
    if (!node) return;

    if (node.type === "src-block") {
      const srcBlock = node as any;
      const language = (srcBlock.language?.toLowerCase() || "") as string;
      const params = parseBlockParameters(srcBlock.parameters || null);
      const name = srcBlock.affiliated?.NAME as string | undefined;

      if (EXECUTABLE_LANGUAGES.includes(language)) {
        blocks.push({
          index,
          name,
          language,
          code: srcBlock.value || "",
          parameters: params,
        });
      }

      index++;
    }

    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        walk(child);
      }
    }
  }

  walk(ast);
  return blocks;
}

/**
 * Parse an org file and return its AST
 */
function parseOrgFile(filePath: string): OrgData {
  const resolvedPath = isAbsolute(filePath)
    ? filePath
    : resolve(process.cwd(), filePath);

  if (!existsSync(resolvedPath)) {
    throw new Error(`File not found: ${resolvedPath}`);
  }

  const source = readFileSync(resolvedPath, "utf-8");

  // Strip shebang line if present
  const cleanSource = source.startsWith("#!")
    ? source.replace(/^#!.*\n/, "")
    : source;

  return parse(cleanSource) as OrgData;
}

/**
 * Find the default executable block (marked with :default)
 *
 * @param ast - Parsed org file AST
 * @returns The default block, or null if none found
 */
export function findDefaultBlock(ast: OrgData): ExecutableBlock | null {
  const blocks = extractAllBlocks(ast);

  for (const block of blocks) {
    if (isDefaultBlock(block.parameters) && isExecutableBlock(block.parameters)) {
      return block;
    }
  }

  return null;
}

/**
 * Find a block by name or index
 *
 * @param ast - Parsed org file AST
 * @param blockId - Block name (string) or index (number)
 * @returns The matching block, or null if not found
 */
export function findBlock(ast: OrgData, blockId: string | number): ExecutableBlock | null {
  const blocks = extractAllBlocks(ast);

  if (typeof blockId === "number") {
    return blocks.find((b) => b.index === blockId) || null;
  }

  return blocks.find((b) => b.name === blockId) || null;
}

/**
 * Run a single block by name or index
 *
 * @param options - Run options including file, block identifier, and args
 * @returns Result with exit code, stdout, stderr, and return value
 *
 * @example
 * const result = await runSingleBlock({
 *   file: "script.org",
 *   block: "main",
 *   args: ["--verbose"]
 * });
 */
export async function runSingleBlock(options: RunBlockOptions): Promise<RunBlockResult> {
  const resolvedPath = isAbsolute(options.file)
    ? options.file
    : resolve(process.cwd(), options.file);

  const ast = parseOrgFile(resolvedPath);
  const block = findBlock(ast, options.block);

  if (!block) {
    const blockDesc = typeof options.block === "number"
      ? `index ${options.block}`
      : `"${options.block}"`;
    return {
      exitCode: 1,
      stdout: "",
      stderr: `Block not found: ${blockDesc}`,
      value: undefined,
    };
  }

  if (!isExecutableBlock(block.parameters)) {
    return {
      exitCode: 1,
      stdout: "",
      stderr: `Block "${options.block}" is not marked :executable or :exec`,
      value: undefined,
    };
  }

  // Set up environment if provided
  const originalEnv = { ...process.env };
  if (options.env) {
    Object.assign(process.env, options.env);
  }

  // Capture stdout/stderr
  let stdout = "";
  let stderr = "";
  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  const originalStderrWrite = process.stderr.write.bind(process.stderr);

  process.stdout.write = ((chunk: any, encoding?: any, callback?: any) => {
    stdout += chunk.toString();
    return originalStdoutWrite(chunk, encoding, callback);
  }) as any;

  process.stderr.write = ((chunk: any, encoding?: any, callback?: any) => {
    stderr += chunk.toString();
    return originalStderrWrite(chunk, encoding, callback);
  }) as any;

  // Set process.argv for the block
  const originalArgv = process.argv;
  process.argv = [process.argv[0], resolvedPath, ...options.args];

  try {
    // Create timeout promise if specified
    const timeoutMs = options.timeout || 30000;
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Execution timed out after ${timeoutMs}ms`)), timeoutMs);
    });

    // Execute with timeout
    const value = await Promise.race([
      executeBlock(block.code, {}, undefined),
      timeoutPromise,
    ]);

    return {
      exitCode: 0,
      stdout,
      stderr,
      value,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    return {
      exitCode: 1,
      stdout,
      stderr: stderr + err.message,
      value: undefined,
    };
  } finally {
    // Restore original state
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
    process.argv = originalArgv;
    process.env = originalEnv;
  }
}

/**
 * Run the default block in a file
 *
 * Finds and executes the block marked with :default parameter.
 *
 * @param file - Path to the org file
 * @param args - Arguments to pass to the block
 * @returns Result with exit code, stdout, stderr, and return value
 *
 * @example
 * const result = await runDefaultBlock("script.org", ["arg1", "arg2"]);
 */
export async function runDefaultBlock(file: string, args: string[]): Promise<RunBlockResult> {
  const resolvedPath = isAbsolute(file)
    ? file
    : resolve(process.cwd(), file);

  const ast = parseOrgFile(resolvedPath);
  const defaultBlock = findDefaultBlock(ast);

  if (!defaultBlock) {
    return {
      exitCode: 1,
      stdout: "",
      stderr: "No default block found. Mark a block with :default parameter.",
      value: undefined,
    };
  }

  // Run using the block's index since findDefaultBlock already found it
  return runSingleBlock({
    file: resolvedPath,
    block: defaultBlock.index,
    args,
  });
}
