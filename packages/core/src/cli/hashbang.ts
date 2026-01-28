/**
 * Hashbang invocation handler for org-press CLI
 *
 * Detects and parses when orgp is invoked with an org file as the first argument,
 * enabling org files to be used as executable scripts with a shebang line.
 *
 * @example Shebang usage in an org file:
 * ```
 * #!/usr/bin/env orgp
 * #+TITLE: My Script
 *
 * #+NAME: default
 * #+BEGIN_SRC javascript :exec
 * console.log("Hello from org-press!");
 * #+END_SRC
 * ```
 */

/**
 * Represents a parsed hashbang invocation
 */
export interface HashbangInvocation {
  /** The org file path */
  file: string;
  /** The subcommand to execute (built-in or plugin command) */
  subcommand: "run" | "serve" | "build" | "deploy" | "help" | "default" | string;
  /** For 'run' subcommand, the name of the block to execute */
  blockName?: string;
  /** Remaining arguments after parsing */
  args: string[];
}

/**
 * Built-in subcommands for hashbang invocation
 * Plugin commands are handled dynamically by orgp.ts
 * Note: "dev" is an alias for "serve" for consistency with standard CLI
 */
const SUBCOMMANDS = ["run", "serve", "dev", "build", "deploy"] as const;

/**
 * Help flags that trigger help subcommand
 */
const HELP_FLAGS = ["--help", "-h", "help"] as const;

/**
 * Check if a string is an org file path
 *
 * @param arg - The argument to check
 * @returns true if the argument appears to be an org file path
 */
function isOrgFile(arg: string): boolean {
  return arg.endsWith(".org");
}

/**
 * Check if this is a hashbang invocation (first arg is an org file)
 *
 * When an org file with a shebang line is executed directly, the kernel
 * passes the script path as the first argument. This function detects
 * that scenario.
 *
 * @param args - Command line arguments (typically process.argv.slice(2))
 * @returns true if the first argument is an org file
 *
 * @example
 * ```typescript
 * isHashbangInvocation(["./script.org"]);  // true
 * isHashbangInvocation(["./script.org", "run", "build"]);  // true
 * isHashbangInvocation(["build", "./site"]);  // false
 * isHashbangInvocation([]);  // false
 * ```
 */
export function isHashbangInvocation(args: string[]): boolean {
  if (args.length === 0) {
    return false;
  }
  return isOrgFile(args[0]);
}

/**
 * Parse hashbang invocation arguments
 *
 * Parses the command line when invoked via hashbang (org file as first argument).
 * Supports subcommands and argument passing.
 *
 * @param args - Command line arguments (typically process.argv.slice(2))
 * @returns Parsed hashbang invocation
 * @throws Error if no arguments provided or first argument is not an org file
 *
 * @example Basic invocation (runs :default block)
 * ```typescript
 * parseHashbangArgs(["./file.org"]);
 * // => { file: "./file.org", subcommand: "default", args: [] }
 * ```
 *
 * @example With arguments passed to default block
 * ```typescript
 * parseHashbangArgs(["./file.org", "arg1", "arg2"]);
 * // => { file: "./file.org", subcommand: "default", args: ["arg1", "arg2"] }
 * ```
 *
 * @example Run specific named block
 * ```typescript
 * parseHashbangArgs(["./file.org", "run", "build"]);
 * // => { file: "./file.org", subcommand: "run", blockName: "build", args: [] }
 * ```
 *
 * @example Run block with arguments (after --)
 * ```typescript
 * parseHashbangArgs(["./file.org", "run", "build", "--", "-v", "--force"]);
 * // => { file: "./file.org", subcommand: "run", blockName: "build", args: ["-v", "--force"] }
 * ```
 *
 * @example Serve subcommand with options
 * ```typescript
 * parseHashbangArgs(["./file.org", "serve", "--port", "3000"]);
 * // => { file: "./file.org", subcommand: "serve", args: ["--port", "3000"] }
 * ```
 *
 * @example Build subcommand
 * ```typescript
 * parseHashbangArgs(["./file.org", "build"]);
 * // => { file: "./file.org", subcommand: "build", args: [] }
 * ```
 *
 * @example Deploy subcommand
 * ```typescript
 * parseHashbangArgs(["./file.org", "deploy"]);
 * // => { file: "./file.org", subcommand: "deploy", args: [] }
 * ```
 *
 * @example Help flag
 * ```typescript
 * parseHashbangArgs(["./file.org", "--help"]);
 * // => { file: "./file.org", subcommand: "help", args: [] }
 * ```
 */
export function parseHashbangArgs(args: string[]): HashbangInvocation {
  if (args.length === 0) {
    throw new Error("No arguments provided");
  }

  const file = args[0];

  if (!isOrgFile(file)) {
    throw new Error(`First argument must be an org file, got: ${file}`);
  }

  // No additional args - run default block
  if (args.length === 1) {
    return {
      file,
      subcommand: "default",
      args: [],
    };
  }

  const secondArg = args[1];

  // Check for help flags
  if ((HELP_FLAGS as readonly string[]).includes(secondArg)) {
    return {
      file,
      subcommand: "help",
      args: [],
    };
  }

  // Check for built-in subcommands
  if ((SUBCOMMANDS as readonly string[]).includes(secondArg)) {
    const subcommand = secondArg as (typeof SUBCOMMANDS)[number];

    if (subcommand === "run") {
      return parseRunSubcommand(file, args.slice(2));
    }

    // serve, build, deploy - pass remaining args through
    return {
      file,
      subcommand,
      args: args.slice(2),
    };
  }

  // Check if it looks like a subcommand (letters and hyphens only, no numbers)
  // This allows plugin commands like "test" to work: ./file.org test
  // But "arg1" or "123" are treated as arguments to default block
  if (secondArg && /^[a-z][a-z-]*$/i.test(secondArg) && !secondArg.startsWith("-")) {
    return {
      file,
      subcommand: secondArg,
      args: args.slice(2),
    };
  }

  // Not a subcommand - treat as args to default block
  return {
    file,
    subcommand: "default",
    args: args.slice(1),
  };
}

/**
 * Parse the 'run' subcommand arguments
 *
 * The run subcommand expects a block name, followed by optional arguments
 * after a -- separator.
 *
 * @param file - The org file path
 * @param args - Arguments after 'run'
 * @returns Parsed hashbang invocation for run subcommand
 */
function parseRunSubcommand(file: string, args: string[]): HashbangInvocation {
  // run requires a block name
  if (args.length === 0) {
    throw new Error("'run' subcommand requires a block name");
  }

  const blockName = args[0];
  const remainingArgs = args.slice(1);

  // Find -- separator for additional arguments
  const separatorIndex = remainingArgs.indexOf("--");

  if (separatorIndex === -1) {
    // No separator - no additional args
    return {
      file,
      subcommand: "run",
      blockName,
      args: [],
    };
  }

  // Arguments after -- are passed to the block
  return {
    file,
    subcommand: "run",
    blockName,
    args: remainingArgs.slice(separatorIndex + 1),
  };
}
