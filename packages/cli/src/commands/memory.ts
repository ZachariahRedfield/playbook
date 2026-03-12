import { pruneMemoryKnowledge, promoteMemoryCandidate, replayMemoryToCandidates } from '@zachariahredfield/playbook-engine';
import { emitJsonOutput } from '../lib/jsonArtifact.js';
import { ExitCode } from '../lib/cliContract.js';

type MemoryOptions = {
  format: 'text' | 'json';
  quiet: boolean;
};

const printMemoryHelp = (): void => {
  console.log(`Usage: playbook memory <subcommand> [options]

Manage replay, promotion, and pruning for repository memory artifacts.

Subcommands:
  replay                     Replay episodic events into candidates
  promote --from-candidate   Promote one replay candidate into semantic memory
  prune                      Prune stale/superseded/duplicate memory artifacts

Options:
  --from-candidate <id>  Candidate id to promote (for promote)
  --json                 Print machine-readable JSON output
  --help                 Show help`);
};

const readOptionValue = (args: string[], optionName: string): string | null => {
  const exactIndex = args.findIndex((arg) => arg === optionName);
  if (exactIndex >= 0) {
    return args[exactIndex + 1] ?? null;
  }

  const prefixed = args.find((arg) => arg.startsWith(`${optionName}=`));
  if (!prefixed) {
    return null;
  }
  return prefixed.slice(optionName.length + 1) || null;
};

export const runMemory = async (cwd: string, args: string[], options: MemoryOptions): Promise<number> => {
  const subcommand = args.find((arg) => !arg.startsWith('-'));

  if (!subcommand || args.includes('--help') || args.includes('-h')) {
    printMemoryHelp();
    return subcommand ? ExitCode.Success : ExitCode.Failure;
  }

  try {
    if (subcommand === 'replay') {
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
    }

    if (subcommand === 'promote') {
      const candidateId = readOptionValue(args, '--from-candidate');
      if (!candidateId) {
        throw new Error('playbook memory promote: missing required --from-candidate <id> argument');
      }

      const payload = promoteMemoryCandidate(cwd, candidateId);

      if (options.format === 'json') {
        emitJsonOutput({ cwd, command: 'memory promote', payload });
      } else if (!options.quiet) {
        console.log(`Promoted candidate ${candidateId} into ${payload.artifactPath}.`);
        if (payload.supersededIds.length > 0) {
          console.log(`Superseded prior knowledge ids: ${payload.supersededIds.join(', ')}`);
        }
      }
      return ExitCode.Success;
    }

    if (subcommand === 'prune') {
      const payload = pruneMemoryKnowledge(cwd);
      if (options.format === 'json') {
        emitJsonOutput({ cwd, command: 'memory prune', payload });
      } else if (!options.quiet) {
        console.log(`Pruned memory artifacts. Updated: ${payload.updatedArtifacts.length}.`);
      }
      return ExitCode.Success;
    }

    throw new Error('playbook memory: unsupported subcommand. Use replay, promote, or prune.');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (options.format === 'json') {
      console.log(JSON.stringify({ schemaVersion: '1.0', command: `memory-${subcommand}`, error: message }, null, 2));
    } else {
      console.error(message);
    }
    return ExitCode.Failure;
  }
};
