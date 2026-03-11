#!/usr/bin/env node
import { ExitCode } from './lib/cliContract.js';
import { hasRegisteredCommand, listRegisteredCommands, runRegisteredCommand } from './commands/index.js';
import { resolveTargetRepoRoot, stripGlobalRepoOption } from './lib/repoRoot.js';
import { beginRuntimeCycle, endRuntimeCycle } from './lib/runtimeObservability.js';

const rawArgs = process.argv.slice(2);

const parseFlag = (allArgs: string[], flag: string): boolean => allArgs.includes(flag);
const parseOptionValue = (allArgs: string[], name: string): string | undefined => {
  const index = allArgs.indexOf(name);
  return index >= 0 && allArgs[index + 1] ? String(allArgs[index + 1]) : undefined;
};

const { args, repo } = stripGlobalRepoOption(rawArgs);

const formatFromArgs = (allArgs: string[]): 'text' | 'json' => {
  if (parseFlag(allArgs, '--json')) {
    return 'json';
  }
  const format = parseOptionValue(allArgs, '--format');
  return format === 'json' ? 'json' : 'text';
};

const commandArg = args.find((arg) => !arg.startsWith('-'));
const commandIndex = commandArg ? args.indexOf(commandArg) : -1;
const command = commandArg ?? '';
const commandArgs = commandIndex >= 0 ? args.slice(commandIndex + 1) : [];
const pilotRepoFromCommandArgs = command === 'pilot' ? parseOptionValue(commandArgs, '--repo') : undefined;

const ci = parseFlag(args, '--ci');
const format = formatFromArgs(args);
const quiet = parseFlag(args, '--quiet') || ci;
const explain = parseFlag(args, '--explain');

const resolveRuntimeRepoRoot = (fallbackRoot: string): string => {
  if (command !== 'pilot') {
    return fallbackRoot;
  }

  const pilotRepoArg = parseOptionValue(commandArgs, '--repo');
  if (!pilotRepoArg) {
    return fallbackRoot;
  }

  try {
    return resolveTargetRepoRoot(process.cwd(), pilotRepoArg);
  } catch {
    return fallbackRoot;
  }
};

const showHelp = () => {
  const commandRows = listRegisteredCommands().map((entry) => `  ${entry.name.padEnd(27)} ${entry.description}`);

  console.log(`Usage: playbook [global-options] <command> [options]

Lightweight project governance CLI

Commands:
${commandRows.join('\n')}

Global options:
  --repo <path>               Target repository root for command execution
  --ci                        CI mode (deterministic, quiet unless errors)
  --format <text|json>        Output format (default text)
  --json                      Alias for --format=json
  --out <path>                Write JSON output artifact when used with --json (supported commands)
  --quiet                     Suppress success output in text mode
  --explain                   Show why findings matter and how to fix them (text mode)
  --policy                    Enable policy enforcement mode for verify
  --help                      Show help
  --version                   Show version`);
};

const globalHelpRequested = parseFlag(args, '--help') || parseFlag(args, '-h');

if (args.length === 0 || (globalHelpRequested && !commandArg)) {
  showHelp();
  process.exit(ExitCode.Success);
}

if (parseFlag(args, '--version') || parseFlag(args, '-V')) {
  console.log('0.1.1');
  process.exit(ExitCode.Success);
}

const run = async () => {
  if (!hasRegisteredCommand(command)) {
    showHelp();
    process.exit(ExitCode.Failure);
  }

  let targetCwd = '';
  try {
    targetCwd = resolveTargetRepoRoot(process.cwd(), repo ?? pilotRepoFromCommandArgs);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(ExitCode.Failure);
  }

  const playbookVersion = '0.1.1';
  const childCommands =
    command === 'pilot' ? ['context', 'index', 'query modules', 'verify', 'plan'] : [];
  const runtimeRepoRoot = resolveRuntimeRepoRoot(targetCwd);

  const cycle = beginRuntimeCycle({
    repoRoot: runtimeRepoRoot,
    triggerCommand: command,
    childCommands,
    playbookVersion
  });

  const startedAt = Date.now();

  try {
    const commandResult = await runRegisteredCommand(command, {
      cwd: targetCwd,
      args,
      commandArgs,
      ci,
      explain,
      format,
      quiet
    });
    cycle.childCommands = commandResult.childCommands;

    endRuntimeCycle(cycle, {
      exitCode: commandResult.exitCode,
      durationMs: Date.now() - startedAt
    });
    process.exit(commandResult.exitCode);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    endRuntimeCycle(cycle, {
      exitCode: ExitCode.Failure,
      durationMs: Date.now() - startedAt,
      error: message
    });
    throw error;
  }
};

void run();
