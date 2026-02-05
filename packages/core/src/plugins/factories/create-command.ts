/**
 * CreateCommand - Factory for CLI commands
 *
 * Add custom commands to the `orgp` CLI. Commands can perform any task
 * like formatting, linting, code generation, etc.
 *
 * @example
 * ```typescript
 * // Simple command
 * const fmtCommand = CreateCommand('fmt', {
 *   description: 'Format code blocks with Prettier',
 *   execute: async (args, ctx) => {
 *     const results = await formatBlocks(ctx.config);
 *     console.log(`Formatted ${results.count} blocks`);
 *     return results.errors > 0 ? 1 : 0;
 *   },
 * });
 *
 * // Command with arguments
 * const lintCommand = CreateCommand('lint', {
 *   description: 'Lint org files',
 *   args: [
 *     { name: 'fix', type: 'boolean', description: 'Auto-fix issues' },
 *     { name: 'pattern', type: 'string', description: 'Glob pattern', default: '**\/*.org' },
 *   ],
 *   execute: async (args, ctx) => {
 *     const fix = args.fix as boolean;
 *     const pattern = args.pattern as string;
 *     const issues = await lintFiles(ctx.contentDir, pattern, { fix });
 *     return issues.length > 0 ? 1 : 0;
 *   },
 * });
 *
 * // Command with positional arguments
 * const newCommand = CreateCommand('new', {
 *   description: 'Create a new org file',
 *   execute: async (args, ctx) => {
 *     const [filename] = args._;
 *     await createFile(filename, ctx);
 *     return 0;
 *   },
 * });
 * ```
 */

import type {
  OrgPressPlugin,
  CommandOptions,
  CommandContext,
  ArgDefinition,
  ParsedArgs,
} from "../types.ts";

/**
 * Create a CLI command plugin
 *
 * @param name - Command name (used as `orgp <name>`)
 * @param options - Command configuration with description and execute function
 * @returns OrgPressPlugin
 */
export function CreateCommand(
  name: string,
  options: CommandOptions
): OrgPressPlugin {
  const { description, args, execute } = options;

  return {
    name: `command:${name}`,
    _type: "command",
    _config: {
      commandName: name,
      description,
      args,
      execute,
    },

    // Setup function to register with PluginContext
    setup(ctx) {
      ctx.addCommand(name, options);
    },
  };
}

/**
 * Helper to parse command line arguments based on definitions
 *
 * @param argv - Raw command line arguments
 * @param definitions - Argument definitions
 * @returns Parsed arguments object
 */
export function parseArgs(
  argv: string[],
  definitions: ArgDefinition[] = []
): ParsedArgs {
  const result: ParsedArgs = { _: [] };

  // Set defaults
  for (const def of definitions) {
    if (def.default !== undefined) {
      result[def.name] = def.default;
    }
  }

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];

    if (arg.startsWith("--")) {
      // Long flag: --name or --name=value
      const [key, value] = arg.slice(2).split("=");
      const def = definitions.find((d) => d.name === key);

      if (def) {
        if (def.type === "boolean") {
          // Boolean flags: --flag=true, --flag=false, or just --flag (defaults to true)
          result[key] = value !== "false";
        } else if (value !== undefined) {
          // Value provided after = sign: --name=value
          result[key] = def.type === "number" ? Number(value) : value;
        } else if (i + 1 < argv.length && !argv[i + 1].startsWith("-")) {
          // Value provided as next argument: --name value
          i++;
          result[key] = def.type === "number" ? Number(argv[i]) : argv[i];
        }
        // If no value provided for string/number, leave it undefined (will use default if set)
      } else {
        // Unknown flag, store as-is
        result[key] = value ?? true;
      }
    } else if (arg.startsWith("-") && arg.length === 2) {
      // Short flag: -n
      const alias = arg[1];
      const def = definitions.find((d) => d.alias === alias);

      if (def) {
        if (def.type === "boolean") {
          result[def.name] = true;
        } else if (i + 1 < argv.length && !argv[i + 1].startsWith("-")) {
          i++;
          result[def.name] = def.type === "number" ? Number(argv[i]) : argv[i];
        }
      }
    } else {
      // Positional argument
      result._.push(arg);
    }

    i++;
  }

  return result;
}

/**
 * Generate help text for a command
 *
 * @param name - Command name
 * @param options - Command options
 * @returns Help text string
 */
export function generateHelp(name: string, options: CommandOptions): string {
  const lines = [
    `Usage: orgp ${name} [options]`,
    "",
    options.description,
  ];

  if (options.args && options.args.length > 0) {
    lines.push("", "Options:");

    for (const arg of options.args) {
      const alias = arg.alias ? `-${arg.alias}, ` : "    ";
      const defaultStr = arg.default !== undefined ? ` (default: ${arg.default})` : "";
      const required = arg.required ? " (required)" : "";
      lines.push(`  ${alias}--${arg.name}  ${arg.description || ""}${defaultStr}${required}`);
    }
  }

  return lines.join("\n");
}

export default CreateCommand;
