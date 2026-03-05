#!/usr/bin/env node
import { ExitCode } from './lib/cliContract.js';

const args = process.argv.slice(2);

const parseFlag = (allArgs: string[], flag: string): boolean => allArgs.includes(flag);
const parseOptionValue = (allArgs: string[], name: string): string | undefined => {
  const index = allArgs.indexOf(name);
  return index >= 0 && allArgs[index + 1] ? String(allArgs[index + 1]) : undefined;
};

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

const showHelp = () => {
  console.log(`Usage: playbook <command> [options]

Lightweight project governance CLI

Commands:
  init                        Initialize playbook docs/config
  analyze                     Analyze project stack
  verify                      Verify governance rules
  doctor                      Check local setup
  status                      Show overall Playbook repository health
  diagram [options]           Generate deterministic architecture Mermaid diagrams
  session <subcommand>        Import, merge, and cleanup session snapshots

Global options:
  --ci                        CI mode (deterministic, quiet unless errors)
  --format <text|json>        Output format (default text)
  --json                      Alias for --format=json
  --quiet                     Suppress success output in text mode
  --help                      Show help
  --version                   Show version`);
};

if (args.length === 0 || parseFlag(args, '--help') || parseFlag(args, '-h')) {
  showHelp();
  process.exit(ExitCode.Success);
}

if (parseFlag(args, '--version') || parseFlag(args, '-V')) {
  console.log('0.1.1');
  process.exit(ExitCode.Success);
}

const run = async () => {
  switch (command) {
    case 'init': {
      const { runInit } = await import('./commands/init.js');
      process.exit(runInit(process.cwd(), { format, quiet, ci }));
      return;
    }
    case 'analyze': {
      const { runAnalyze } = await import('./commands/analyze.js');
      process.exit(await runAnalyze(process.cwd(), { ci, format, quiet }));
      return;
    }
    case 'verify': {
      const { runVerify } = await import('./commands/verify.js');
      process.exit(await runVerify(process.cwd(), { ci, format, quiet }));
      return;
    }
    case 'doctor': {
      const { runDoctor } = await import('./commands/doctor.js');
      process.exit(await runDoctor(process.cwd(), { format, quiet }));
      return;
    }
    case 'status': {
      const { runStatus } = await import('./commands/status.js');
      process.exit(await runStatus(process.cwd(), { ci, format, quiet }));
      return;
    }
    case 'session': {
      const { runSession } = await import('./commands/session.js');
      process.exit(await runSession(process.cwd(), commandArgs, { format, quiet }));
      return;
    }
    case 'diagram': {
      const { runDiagram } = await import('./commands/diagram.js');
      process.exit(
        await runDiagram(process.cwd(), {
          repo: parseOptionValue(commandArgs, '--repo') ?? '.',
          out: parseOptionValue(commandArgs, '--out') ?? 'docs/ARCHITECTURE_DIAGRAMS.md',
          deps: parseFlag(commandArgs, '--deps'),
          structure: parseFlag(commandArgs, '--structure'),
          format,
          quiet
        })
      );
      return;
    }
    default:
      showHelp();
      process.exit(ExitCode.Failure);
  }
};

void run();
