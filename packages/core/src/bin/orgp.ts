#!/usr/bin/env node --experimental-strip-types
/**
 * orgp - Org-Press CLI
 *
 * Commands:
 *   orgp dev              Start development server
 *   orgp build            Build static site
 *   orgp build types      Generate TypeScript declarations for org code blocks
 *   orgp run <file>       Execute an org file
 *   orgp help             Show help
 *
 * Run options:
 *   --block <name>   Execute only the named block
 *   --all            Execute all executable blocks (default: only :exec blocks)
 *   --json           Output as JSON instead of raw text
 *   --quiet          Suppress non-output messages
 *   --stdin          Read input from stdin (available as `input` variable)
 *
 * Hashbang Execution:
 *   Make org files executable with: #!/usr/bin/env orgp
 *
 *   ./script.org                  Run :default block
 *   ./script.org arg1 arg2        Pass args to :default block
 *   ./script.org run build        Run named block "build"
 *   ./script.org serve            Start dev server for this file
 *   ./script.org build            Build this file
 *   ./script.org --help           Show available blocks and commands
 *
 * Examples:
 *   orgp dev                             # Start dev server
 *   orgp build                           # Build static site
 *   orgp build types                     # Generate .d.ts files for code blocks
 *   orgp script.org                      # Run :exec blocks in script.org
 *   orgp --block main script.org         # Run only block named "main"
 */

import { executeOrgFile, runSingleBlock, runDefaultBlock, type ExecuteOptions } from "../cli/execute.ts";
import { isHashbangInvocation, parseHashbangArgs } from "../cli/hashbang.ts";
import { serveSingleFile } from "../cli/commands/serve-single.ts";
import { buildSingleFile, parseBuildArgs } from "../cli/commands/build-single.ts";
import { deploySingleFile, parseDeployArgs } from "../cli/commands/deploy-single.ts";
// NOTE: buildTypes is imported dynamically to avoid loading typescript dependency at startup
import { buildBlock, parseBuildBlockArgs } from "../cli/commands/build-block.ts";
import type { BlockPlugin, CliContext } from "../plugins/types.ts";

interface ParsedArgs {
  command?: "dev" | "build" | "run" | "help";
  buildSubcommand?: "types";
  buildTypesArgs?: string[];
  file?: string;
  block?: string;
  all: boolean;
  json: boolean;
  quiet: boolean;
  stdin: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = {
    all: false,
    json: false,
    quiet: false,
    stdin: false,
  };

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];

    if (arg === "help" || arg === "--help" || arg === "-h") {
      args.command = "help";
      i++;
      continue;
    }

    if (arg === "dev") {
      args.command = "dev";
      i++;
      continue;
    }

    if (arg === "build") {
      args.command = "build";
      i++;
      // Check for build subcommand
      if (argv[i] === "types") {
        args.buildSubcommand = "types";
        i++;
        // Collect remaining args for build-types
        args.buildTypesArgs = argv.slice(i);
        break;
      }
      // For build command, stop parsing here and let subcommand parsers handle the rest
      // This allows --block, --out, etc. to be passed through
      break;
    }

    if (arg === "run") {
      args.command = "run";
      i++;
      continue;
    }

    if (arg === "--block" || arg === "-b") {
      args.block = argv[++i];
      i++;
      continue;
    }

    if (arg.startsWith("--block=")) {
      args.block = arg.slice("--block=".length);
      i++;
      continue;
    }

    if (arg === "--all" || arg === "-a") {
      args.all = true;
      i++;
      continue;
    }

    if (arg === "--json" || arg === "-j") {
      args.json = true;
      i++;
      continue;
    }

    if (arg === "--quiet" || arg === "-q") {
      args.quiet = true;
      i++;
      continue;
    }

    if (arg === "--stdin" || arg === "-s") {
      args.stdin = true;
      i++;
      continue;
    }

    // Positional argument: file path
    if (!arg.startsWith("-")) {
      args.file = arg;
      i++;
      continue;
    }

    // Unknown flag
    console.error(`Unknown option: ${arg}`);
    process.exit(1);
  }

  return args;
}

function showHelp(): void {
  console.log(`
orgp - Org-Press CLI

COMMANDS:
  orgp dev [target]     Start development server
  orgp build [target]   Build static site for production
  orgp build types      Generate TypeScript declarations for org code blocks
  orgp build <file> --block <names>  Extract and compile named blocks from org file
  orgp run <file>       Execute an org file (or just: orgp <file>)
  orgp help             Show this help message

CODE QUALITY:
  orgp fmt [files]      Format code blocks with Prettier
  orgp lint [files]     Lint code blocks with ESLint
  orgp type-check       Type-check TypeScript blocks

DEV OPTIONS:
  <target>                  File or directory to serve (optional)
  --port, -p <number>       Port to run dev server on (default: 5173)
  --host <address>          Host to bind to (default: localhost)
  --open, -o                Open browser on start
                            Also accepts ORGP_PORT or PORT env variable

BUILD OPTIONS:
  <target>                  File or directory to build (optional)
  --out-dir, -o <dir>       Output directory (default: "dist/static")

BUILD --BLOCK OPTIONS:
  --block, -b <names>       Block names to extract (comma-separated)
  --out, -o <dir>           Output directory (default: "dist")
  --format <format>         Output format: esm | cjs (default: "esm")
  --declaration, -d         Generate .d.ts files (default: true)

BUILD TYPES OPTIONS:
  --content-dir, -c <dir>   Content directory (default: "content")
  --out-dir, -o <dir>       Output directory (default: "dist/types")
  --quiet, -q               Suppress non-error output

RUN OPTIONS:
  --block, -b <name>   Execute only the named block
  --all, -a            Execute all executable blocks (default: only :exec blocks)
  --json, -j           Output as JSON instead of raw text
  --quiet, -q          Suppress non-output messages
  --stdin, -s          Read input from stdin (available as \`input\` variable)

EXAMPLES:
  orgp dev                            # Start dev server for project
  orgp dev demo.org                   # Serve a single org file
  orgp dev ./docs                     # Serve a directory
  orgp dev --port 3000                # Start on port 3000
  orgp build                          # Build full project to dist/
  orgp build demo.org                 # Build a single org file
  orgp build ./docs                   # Build a directory
  orgp build types                    # Generate .d.ts files
  orgp build index.org --block plugin --out dist/  # Extract blocks to dist/
  orgp script.org                     # Run :exec blocks in script.org
  orgp --block main script.org        # Run only block named "main"
  echo '{"x":1}' | orgp --stdin script.org  # Pipe input to script

ZERO-CONFIG USAGE:
  Org files can be executed directly with a shebang:

    #!/usr/bin/env orgp
    #+NAME: main
    #+begin_src javascript :exec :default
    console.log("Hello from org-press!");
    #+end_src

  Then run: ./script.org or ./script.org serve

CONFIGURATION:
  Create .org-press/config.ts in your project root:

    import { defineConfig } from "org-press";
    export default defineConfig({
      contentDir: "content",
      outDir: "dist",
    });
`);
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];

  return new Promise((resolve, reject) => {
    // Check if stdin is a TTY (interactive terminal)
    if (process.stdin.isTTY) {
      resolve("");
      return;
    }

    process.stdin.on("data", (chunk) => chunks.push(chunk));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    process.stdin.on("error", reject);
  });
}

/**
 * Parse dev command arguments
 */
interface DevArgs {
  target?: string;
  port?: number;
  open?: boolean;
  host?: string;
}

function parseDevArgs(args: string[]): DevArgs {
  const result: DevArgs = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--port" || arg === "-p") {
      result.port = parseInt(args[++i], 10);
    } else if (arg.startsWith("--port=")) {
      result.port = parseInt(arg.slice("--port=".length), 10);
    } else if (arg === "--open" || arg === "-o") {
      result.open = true;
    } else if (arg === "--host") {
      result.host = args[++i] || "0.0.0.0";
    } else if (arg.startsWith("--host=")) {
      result.host = arg.slice("--host=".length);
    } else if (!arg.startsWith("-")) {
      // Positional argument is the target
      result.target = arg;
    }
  }

  return result;
}

/**
 * Determine target type: file, directory, or glob pattern
 */
async function resolveTargetType(target: string): Promise<"file" | "directory" | "glob"> {
  const { existsSync, statSync } = await import("node:fs");
  const { resolve } = await import("node:path");

  // Check for glob patterns
  if (target.includes("*") || target.includes("?") || target.includes("[")) {
    return "glob";
  }

  const resolvedPath = resolve(process.cwd(), target);

  if (!existsSync(resolvedPath)) {
    // If doesn't exist, might be a glob or invalid path
    // Check if parent exists and this looks like a glob
    return "glob";
  }

  const stat = statSync(resolvedPath);
  return stat.isDirectory() ? "directory" : "file";
}

async function runDev(args: string[]): Promise<void> {
  const devArgs = parseDevArgs(args);

  // Parse port from env if not provided
  const portEnv = process.env.ORGP_PORT || process.env.PORT;
  const port = devArgs.port ?? (portEnv ? parseInt(portEnv, 10) : undefined);

  // If a target is specified, handle it
  if (devArgs.target) {
    const targetType = await resolveTargetType(devArgs.target);

    if (targetType === "file") {
      // Single file mode - use serveSingleFile
      await serveSingleFile({
        file: devArgs.target,
        port: port ?? 3000,
        open: devArgs.open,
        host: devArgs.host,
      });
      return;
    }

    if (targetType === "directory") {
      // Directory mode - use the directory as contentDir
      const { createServer } = await import("vite");
      const { orgPress } = await import("../node/vite-plugin-org-press.ts");
      const { resolve } = await import("node:path");

      const config = await loadConfig();
      config.contentDir = resolve(process.cwd(), devArgs.target);

      const server = await createServer({
        plugins: await orgPress(config),
        ...config.vite,
        server: {
          ...config.vite?.server,
          port: port ?? config.vite?.server?.port,
          open: devArgs.open ?? config.vite?.server?.open,
          host: devArgs.host ?? config.vite?.server?.host,
        },
      });

      await server.listen();
      server.printUrls();
      return;
    }

    // Glob mode - expand glob and serve
    console.error("Error: Glob patterns not yet supported for dev mode");
    console.error("Use a specific file or directory instead.");
    process.exit(1);
  }

  // No target - use full project mode with config
  const { createServer } = await import("vite");
  const { orgPress } = await import("../node/vite-plugin-org-press.ts");
  const config = await loadConfig();

  const server = await createServer({
    plugins: await orgPress(config),
    ...config.vite,
    server: {
      ...config.vite?.server,
      port: port ?? config.vite?.server?.port,
      open: devArgs.open ?? config.vite?.server?.open,
      host: devArgs.host ?? config.vite?.server?.host,
    },
  });

  await server.listen();
  server.printUrls();
}

/**
 * Parse build command arguments
 */
interface BuildArgs {
  target?: string;
  outDir?: string;
}

function parseBuildMainArgs(args: string[]): BuildArgs {
  const result: BuildArgs = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--out-dir" || arg === "-o") {
      result.outDir = args[++i];
    } else if (arg.startsWith("--out-dir=")) {
      result.outDir = arg.slice("--out-dir=".length);
    } else if (!arg.startsWith("-")) {
      // Positional argument is the target
      result.target = arg;
    }
  }

  return result;
}

async function runBuild(args: string[] = []): Promise<void> {
  const buildArgs = parseBuildMainArgs(args);

  // If a target is specified, handle it
  if (buildArgs.target) {
    const targetType = await resolveTargetType(buildArgs.target);

    if (targetType === "file") {
      // Single file build
      const options = parseBuildArgs([
        ...(buildArgs.outDir ? ["--out-dir", buildArgs.outDir] : []),
      ]);
      const result = await buildSingleFile(buildArgs.target, options);
      console.log(`\nBuild complete: ${result.outDir}`);
      return;
    }

    if (targetType === "directory") {
      // Directory build - use the directory as contentDir
      const { build } = await import("../node/build/build.ts");
      const { resolve } = await import("node:path");

      const config = await loadConfig();
      config.contentDir = resolve(process.cwd(), buildArgs.target);
      if (buildArgs.outDir) {
        config.outDir = buildArgs.outDir;
      }

      await build({ config });
      return;
    }

    // Glob mode
    console.error("Error: Glob patterns not yet supported for build mode");
    console.error("Use a specific file or directory instead.");
    process.exit(1);
  }

  // No target - use full project mode with config
  const { build } = await import("../node/build/build.ts");
  const config = await loadConfig();

  if (buildArgs.outDir) {
    config.outDir = buildArgs.outDir;
  }

  await build({ config });
}

async function loadConfig() {
  const { findConfigFile, loadConfig: loadConfigFile, resolveConfig } = await import("../config/loader.ts");

  // Try to find and load config
  const configPath = await findConfigFile();

  if (configPath) {
    return loadConfigFile(configPath);
  }

  // No config file, use defaults
  return resolveConfig({});
}

async function runOrgFile(args: ParsedArgs): Promise<void> {
  // Validate file argument
  if (!args.file) {
    console.error("Error: No org file specified");
    console.error("Run 'orgp help' for usage");
    process.exit(1);
  }

  // Read stdin if requested
  let stdinInput: string | undefined;
  if (args.stdin) {
    stdinInput = await readStdin();
  }

  // Build options
  const options: ExecuteOptions = {
    file: args.file,
    blockName: args.block,
    all: args.all,
    json: args.json,
    quiet: args.quiet,
    input: stdinInput,
  };

  try {
    const result = await executeOrgFile(options);

    // Output result
    if (args.json) {
      console.log(JSON.stringify(result, null, 2));
    } else if (result.outputs.length > 0) {
      for (const output of result.outputs) {
        if (output.value !== undefined && output.value !== null) {
          console.log(String(output.value));
        }
      }
    }

    // Exit with error code if any block failed
    if (result.errors.length > 0) {
      if (!args.quiet) {
        for (const err of result.errors) {
          console.error(`Error in block ${err.blockName || err.blockIndex}: ${err.message}`);
        }
      }
      process.exit(1);
    }
  } catch (error) {
    if (!args.quiet) {
      console.error("Error:", error instanceof Error ? error.message : String(error));
    }
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);

  // Check for hashbang invocation (first arg is an org file)
  if (isHashbangInvocation(rawArgs)) {
    await handleHashbangInvocation(rawArgs);
    return;
  }

  // Standard CLI invocation
  const args = parseArgs(rawArgs);

  // Handle help command
  if (args.command === "help") {
    showHelp();
    process.exit(0);
  }

  // Handle dev command
  if (args.command === "dev") {
    // Pass args after "dev" command
    const devArgIndex = rawArgs.indexOf("dev");
    await runDev(rawArgs.slice(devArgIndex + 1));
    return;
  }

  // Handle build command
  if (args.command === "build") {
    // Check for build subcommand
    if (args.buildSubcommand === "types") {
      // Dynamically import to avoid loading typescript at startup
      const { buildTypes, parseBuildTypesArgs } = await import("../cli/commands/build-types.ts");
      const typesOptions = parseBuildTypesArgs(args.buildTypesArgs || []);
      await buildTypes(typesOptions);
      return;
    }

    // Check for --block flag (build specific blocks from org file)
    const buildArgIndex = rawArgs.indexOf("build");
    const buildArgs = rawArgs.slice(buildArgIndex + 1);
    const blockOptions = parseBuildBlockArgs(buildArgs);
    if (blockOptions) {
      await buildBlock(blockOptions);
      return;
    }

    // Default: build static site
    await runBuild(buildArgs);
    return;
  }

  // Check for plugin CLI commands before treating as file
  // Plugin commands are non-flag args that aren't .org files
  const rawCommand = rawArgs[0];
  if (rawCommand && !rawCommand.startsWith("-") && !rawCommand.endsWith(".org")) {
    const exitCode = await tryPluginCommand(rawCommand, rawArgs.slice(1));
    if (exitCode !== null) {
      process.exit(exitCode);
    }
  }

  // Handle run command or file argument
  if (args.command === "run" || args.file) {
    await runOrgFile(args);
    return;
  }

  // No command specified
  showHelp();
  process.exit(1);
}

/**
 * Try to execute a plugin CLI command
 *
 * @param command - Command name to try
 * @param args - Arguments to pass to the command
 * @returns Exit code if command was handled, null otherwise
 */
async function tryPluginCommand(command: string, args: string[]): Promise<number | null> {
  const { resolve } = await import("node:path");
  const config = await loadConfig();

  // Get project root from cwd
  const projectRoot = process.cwd();
  const contentDir = resolve(projectRoot, config.contentDir || "content");

  // Load plugins and look for CLI commands
  const { loadPlugins } = await import("../plugins/loader.ts");
  const { plugins } = await loadPlugins(config);

  // Also include CLI-specific plugins (fmt, lint, type-check) that aren't loaded by default
  const { allBuiltinPlugins } = await import("../plugins/builtin/index.ts");
  const allPlugins = [...plugins, ...allBuiltinPlugins.filter(p => p.cli)];

  // Find a plugin with a matching CLI command
  for (const plugin of allPlugins) {
    if (plugin.cli && plugin.cli.command === command) {
      const context: CliContext = {
        config,
        projectRoot,
        contentDir,
      };

      return plugin.cli.execute(args, context);
    }
  }

  return null;
}

/**
 * Handle hashbang invocation (org file as first argument)
 */
async function handleHashbangInvocation(args: string[]): Promise<void> {
  const invocation = parseHashbangArgs(args);

  switch (invocation.subcommand) {
    case "run":
      // Run specific named block
      if (!invocation.blockName) {
        console.error("Error: 'run' subcommand requires a block name");
        process.exit(1);
      }
      const runResult = await runSingleBlock({
        file: invocation.file,
        block: invocation.blockName,
        args: invocation.args,
      });
      if (runResult.exitCode !== 0) {
        if (runResult.stderr) {
          console.error(runResult.stderr);
        }
      }
      process.exit(runResult.exitCode);
      break;

    case "serve":
      // Serve single file
      const portArg = invocation.args.find((a, i, arr) =>
        a === "--port" && arr[i + 1]
      );
      const portIndex = invocation.args.indexOf("--port");
      const port = portIndex !== -1 ? parseInt(invocation.args[portIndex + 1], 10) : 3000;

      await serveSingleFile({
        file: invocation.file,
        port: isNaN(port) ? 3000 : port,
        open: invocation.args.includes("--open"),
      });
      break;

    case "build":
      // Build single file
      try {
        const buildOptions = parseBuildArgs(invocation.args);
        const buildResult = await buildSingleFile(invocation.file, buildOptions);
        console.log(`\nBuild complete: ${buildResult.outDir}`);
        process.exit(0);
      } catch (error) {
        console.error("Build error:", error instanceof Error ? error.message : error);
        process.exit(1);
      }
      break;

    case "deploy":
      // Deploy single file
      try {
        const deployOptions = parseDeployArgs(invocation.args);
        const deployResult = await deploySingleFile(invocation.file, deployOptions);
        if (deployResult.success) {
          console.log(`\nDeploy complete: ${deployResult.packageName}@${deployResult.version}`);
          if (deployResult.url) {
            console.log(`Package URL: ${deployResult.url}`);
          }
          process.exit(0);
        } else {
          console.error(`Deploy failed: ${deployResult.error}`);
          process.exit(1);
        }
      } catch (error) {
        console.error("Deploy error:", error instanceof Error ? error.message : error);
        process.exit(1);
      }
      break;

    case "help":
      // Show help for the org file
      await showFileHelp(invocation.file);
      break;

    case "default":
      // Run the default block
      const defaultResult = await runDefaultBlock(invocation.file, invocation.args);
      if (defaultResult.exitCode !== 0) {
        if (defaultResult.stderr) {
          console.error(defaultResult.stderr);
        }
      }
      process.exit(defaultResult.exitCode);
      break;

    default:
      // Try plugin commands for unknown subcommands (e.g., "test" from block-test)
      try {
        const pluginExitCode = await tryPluginCommand(
          invocation.subcommand,
          [invocation.file, ...invocation.args]
        );
        if (pluginExitCode !== null) {
          process.exit(pluginExitCode);
        } else {
          console.error(`Unknown subcommand: ${invocation.subcommand}`);
          console.error(`Run '${invocation.file} --help' for available commands.`);
          process.exit(1);
        }
      } catch (error) {
        console.error(`Error running ${invocation.subcommand}:`, error instanceof Error ? error.message : error);
        process.exit(1);
      }
  }
}

/**
 * Show help for a specific org file (list available blocks)
 */
async function showFileHelp(file: string): Promise<void> {
  const { readFileSync, existsSync } = await import("node:fs");
  const { resolve, isAbsolute } = await import("node:path");
  const { parse } = await import("uniorg-parse/lib/parser.js");
  const { parseBlockParameters } = await import("../plugins/utils.ts");

  const filePath = isAbsolute(file) ? file : resolve(process.cwd(), file);

  if (!existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const source = readFileSync(filePath, "utf-8");
  const cleanSource = source.startsWith("#!")
    ? source.replace(/^#!.*\n/, "")
    : source;

  // Extract title from org file
  const titleMatch = cleanSource.match(/^#\+TITLE:\s*(.+)$/im);
  const title = titleMatch ? titleMatch[1] : file;

  console.log(`
${title}
${"=".repeat(title.length)}

Usage: ${file} [subcommand] [args]

Subcommands:
  run <block>     Run a specific named block
  serve           Start dev server for this file
  build           Build this file to static HTML or middleware
  deploy          Deploy this file to npm registry
  --help          Show this help

Without a subcommand, runs the block marked :default

Available executable blocks:`);

  // Parse and list blocks
  const ast = parse(cleanSource);
  const EXECUTABLE_LANGUAGES = ["javascript", "js", "typescript", "ts", "jsx", "tsx"];
  let blockIndex = 0;
  let foundBlocks = false;

  function walk(node: any): void {
    if (!node) return;

    if (node.type === "src-block") {
      const language = (node.language?.toLowerCase() || "") as string;
      const params = parseBlockParameters(node.parameters || null);
      const name = node.affiliated?.NAME as string | undefined;

      if (EXECUTABLE_LANGUAGES.includes(language)) {
        const isExec = params.exec !== undefined || params.executable !== undefined;
        const isDefault = params.default !== undefined;

        if (isExec || params.runtime === "server" || params.use === "server") {
          foundBlocks = true;
          const defaultMarker = isDefault ? " (default)" : "";
          const nameDisplay = name || `[index ${blockIndex}]`;
          console.log(`  ${nameDisplay}${defaultMarker} - ${language}`);
        }
      }
      blockIndex++;
    }

    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        walk(child);
      }
    }
  }

  walk(ast);

  if (!foundBlocks) {
    console.log("  (no executable blocks found)");
    console.log("");
    console.log("Mark blocks as executable with :exec or :executable parameter.");
  }

  console.log("");
}

main();
