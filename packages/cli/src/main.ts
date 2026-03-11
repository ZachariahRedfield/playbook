#!/usr/bin/env node
import { ExitCode } from './lib/cliContract.js';
import { hasRegisteredCommand, listRegisteredCommands, runRegisteredCommand } from './commands/index.js';
import { resolveTargetRepoRoot, stripGlobalRepoOption } from './lib/repoRoot.js';

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

const ci = parseFlag(args, '--ci');
const format = formatFromArgs(args);
const quiet = parseFlag(args, '--quiet') || ci;
const explain = parseFlag(args, '--explain');

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
    targetCwd = resolveTargetRepoRoot(process.cwd(), repo);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(ExitCode.Failure);
  }

  const exitCode = await runRegisteredCommand(command, {
    cwd: targetCwd,
    args,
    commandArgs,
    ci,
    explain,
    format,
    quiet
  });

  process.exit(exitCode);
};

void run();
