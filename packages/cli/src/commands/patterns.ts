import { promotePatternCandidate } from '@zachariahredfield/playbook-engine';
import { emitJsonOutput } from '../lib/jsonArtifact.js';
import { ExitCode } from '../lib/cliContract.js';

type PatternsOptions = {
  format: 'text' | 'json';
  quiet: boolean;
  outFile?: string;
};

const readOptionValue = (args: string[], flag: string): string | undefined => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};

export const runPatterns = async (cwd: string, commandArgs: string[], options: PatternsOptions): Promise<number> => {
  const subcommand = commandArgs[0];
  if (subcommand !== 'promote') {
    const message = 'playbook patterns: unsupported subcommand. Use "playbook patterns promote --id <pattern-id> --decision approve|reject".';
    if (options.format === 'json') {
      emitJsonOutput({ cwd, command: 'patterns', payload: { schemaVersion: '1.0', command: 'patterns', error: message }, outFile: options.outFile });
    } else {
      console.error(message);
    }
    return ExitCode.Failure;
  }

  const id = readOptionValue(commandArgs, '--id');
  const decisionRaw = readOptionValue(commandArgs, '--decision');
  if (!id || !decisionRaw || !['approve', 'reject'].includes(decisionRaw)) {
    const message = 'playbook patterns promote: requires --id <pattern-id> and --decision approve|reject.';
    if (options.format === 'json') {
      emitJsonOutput({ cwd, command: 'patterns', payload: { schemaVersion: '1.0', command: 'patterns', error: message }, outFile: options.outFile });
    } else {
      console.error(message);
    }
    return ExitCode.Failure;
  }

  try {
    const reviewRecord = promotePatternCandidate(cwd, { id, decision: decisionRaw as 'approve' | 'reject' });
    const payload = { schemaVersion: '1.0', command: 'patterns', action: 'promote', reviewRecord };

    if (options.format === 'json') {
      emitJsonOutput({ cwd, command: 'patterns', payload, outFile: options.outFile });
      return ExitCode.Success;
    }

    if (!options.quiet) {
      console.log(`Pattern ${id} ${decisionRaw}d.`);
    }
    return ExitCode.Success;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (options.format === 'json') {
      emitJsonOutput({ cwd, command: 'patterns', payload: { schemaVersion: '1.0', command: 'patterns', error: message }, outFile: options.outFile });
    } else {
      console.error(message);
    }
    return ExitCode.Failure;
  }
};
