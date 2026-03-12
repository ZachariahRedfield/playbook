import { replayMemoryToCandidates } from '@zachariahredfield/playbook-engine';
import { emitJsonOutput } from '../lib/jsonArtifact.js';
import { ExitCode } from '../lib/cliContract.js';

type MemoryOptions = {
  format: 'text' | 'json';
  quiet: boolean;
};

const printMemoryHelp = (): void => {
  console.log(`Usage: playbook memory replay [options]

Replay repository memory events and emit deterministic candidate knowledge artifacts.

Options:
  --json             Print machine-readable JSON output
  --help             Show help`);
};

export const runMemory = async (cwd: string, args: string[], options: MemoryOptions): Promise<number> => {
  const subcommand = args.find((arg) => !arg.startsWith('-'));

  if (!subcommand || args.includes('--help') || args.includes('-h')) {
    printMemoryHelp();
    return subcommand ? ExitCode.Success : ExitCode.Failure;
  }

  if (subcommand !== 'replay') {
    const message = 'playbook memory: unsupported subcommand. Use "playbook memory replay".';
    if (options.format === 'json') {
      console.log(JSON.stringify({ schemaVersion: '1.0', command: 'memory-replay', error: message }, null, 2));
    } else {
      console.error(message);
    }
    return ExitCode.Failure;
  }

  try {
    const payload = replayMemoryToCandidates(cwd);

    if (options.format === 'json') {
      emitJsonOutput({ cwd, command: 'memory replay', payload });
      return ExitCode.Success;
    }

    if (!options.quiet) {
      console.log(`Replayed ${payload.totalEvents} memory events into ${payload.candidates.length} candidates.`);
      console.log('Wrote artifact: .playbook/memory/candidates.json');
    }

    return ExitCode.Success;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (options.format === 'json') {
      console.log(JSON.stringify({ schemaVersion: '1.0', command: 'memory-replay', error: message }, null, 2));
    } else {
      console.error(message);
    }
    return ExitCode.Failure;
  }
};
