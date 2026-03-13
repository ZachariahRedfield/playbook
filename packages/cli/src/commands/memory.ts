import {
  expandMemoryProvenance,
  loadCandidateKnowledgeById,
  lookupMemoryCandidateKnowledge,
  lookupMemoryEventTimeline,
  lookupPromotedMemoryKnowledge,
  promoteMemoryCandidate,
  retirePromotedKnowledge
} from '@zachariahredfield/playbook-engine';
import { emitJsonOutput } from '../lib/jsonArtifact.js';
import { ExitCode } from '../lib/cliContract.js';

type MemoryOptions = {
  format: 'text' | 'json';
  quiet: boolean;
};

const printMemoryHelp = (): void => {
  console.log(`Usage: playbook memory <subcommand> [options]

Inspect and review repository memory artifacts.

Subcommands:
  events                           List episodic memory events
  candidates                       List replayed memory candidates
  knowledge                        List promoted memory knowledge
  show <id>                        Show a candidate or knowledge record by id
  promote <candidate-id>           Promote one candidate into knowledge
  retire <knowledge-id>            Retire one promoted knowledge record

Options:
  --kind <kind>                Filter candidates/knowledge by kind
  --module <module>            Filter events by module
  --rule <rule-id>             Filter events by rule id
  --fingerprint <value>        Filter events by event fingerprint
  --limit <n>                  Limit returned events
  --order <asc|desc>           Event ordering (default desc)
  --include-stale              Include stale candidates in memory candidates
  --include-superseded         Include superseded knowledge in memory knowledge
  --reason <text>              Retirement reason override for memory retire
  --json                       Print machine-readable JSON output
  --help                       Show help`);
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

const parseIntegerOption = (raw: string | null, optionName: string): number | undefined => {
  if (raw === null) {
    return undefined;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`playbook memory: invalid ${optionName} value \"${raw}\"; expected a non-negative integer`);
  }

  return parsed;
};

const parseOrderOption = (raw: string | null): 'asc' | 'desc' => {
  if (raw === null || raw === 'desc') {
    return 'desc';
  }
  if (raw === 'asc') {
    return 'asc';
  }
  throw new Error(`playbook memory: invalid --order value \"${raw}\"; expected asc or desc`);
};

const resolveSubcommandArgument = (args: string[]): string | null => {
  const positional = args.filter((arg) => !arg.startsWith('-'));
  if (positional.length < 2) {
    return null;
  }
  return positional[1] ?? null;
};

export const runMemory = async (cwd: string, args: string[], options: MemoryOptions): Promise<number> => {
  const subcommand = args.find((arg) => !arg.startsWith('-'));

  if (!subcommand || args.includes('--help') || args.includes('-h')) {
    printMemoryHelp();
    return subcommand ? ExitCode.Success : ExitCode.Failure;
  }

  try {
    if (subcommand === 'events') {
      const payload = {
        schemaVersion: '1.0',
        command: 'memory-events',
        events: lookupMemoryEventTimeline(cwd, {
          module: readOptionValue(args, '--module') ?? undefined,
          ruleId: readOptionValue(args, '--rule') ?? undefined,
          fingerprint: readOptionValue(args, '--fingerprint') ?? undefined,
          order: parseOrderOption(readOptionValue(args, '--order')),
          limit: parseIntegerOption(readOptionValue(args, '--limit'), '--limit')
        })
      };

      if (options.format === 'json') {
        emitJsonOutput({ cwd, command: 'memory events', payload });
      } else if (!options.quiet) {
        console.log(`Found ${payload.events.length} memory events.`);
      }
      return ExitCode.Success;
    }

    if (subcommand === 'candidates') {
      const payload = {
        schemaVersion: '1.0',
        command: 'memory-candidates',
        candidates: lookupMemoryCandidateKnowledge(cwd, {
          kind: (readOptionValue(args, '--kind') as 'decision' | 'pattern' | 'failure_mode' | 'invariant' | 'open_question' | null) ?? undefined,
          includeStale: args.includes('--include-stale')
        })
      };

      if (options.format === 'json') {
        emitJsonOutput({ cwd, command: 'memory candidates', payload });
      } else if (!options.quiet) {
        console.log(`Found ${payload.candidates.length} memory candidates.`);
      }
      return ExitCode.Success;
    }

    if (subcommand === 'knowledge') {
      const payload = {
        schemaVersion: '1.0',
        command: 'memory-knowledge',
        knowledge: lookupPromotedMemoryKnowledge(cwd, {
          kind: (readOptionValue(args, '--kind') as 'decision' | 'pattern' | 'failure_mode' | 'invariant' | null) ?? undefined,
          includeSuperseded: args.includes('--include-superseded')
        })
      };

      if (options.format === 'json') {
        emitJsonOutput({ cwd, command: 'memory knowledge', payload });
      } else if (!options.quiet) {
        console.log(`Found ${payload.knowledge.length} promoted memory records.`);
      }
      return ExitCode.Success;
    }

    if (subcommand === 'show') {
      const id = resolveSubcommandArgument(args);
      if (!id) {
        throw new Error('playbook memory show: missing required <id> argument');
      }

      const candidate = lookupMemoryCandidateKnowledge(cwd, { includeStale: true }).find((entry) => entry.candidateId === id);
      if (candidate) {
        const payload = {
          schemaVersion: '1.0',
          command: 'memory-show',
          id,
          type: 'candidate',
          record: {
            ...candidate,
            provenance: expandMemoryProvenance(cwd, candidate.provenance)
          }
        };

        if (options.format === 'json') {
          emitJsonOutput({ cwd, command: 'memory show', payload });
        } else if (!options.quiet) {
          console.log(`Candidate ${id}: ${candidate.title}`);
        }
        return ExitCode.Success;
      }

      const knowledge = lookupPromotedMemoryKnowledge(cwd, { includeSuperseded: true }).find((entry) => entry.knowledgeId === id);
      if (!knowledge) {
        throw new Error(`playbook memory show: record not found: ${id}`);
      }

      const payload = {
        schemaVersion: '1.0',
        command: 'memory-show',
        id,
        type: 'knowledge',
        record: knowledge
      };

      if (options.format === 'json') {
        emitJsonOutput({ cwd, command: 'memory show', payload });
      } else if (!options.quiet) {
        console.log(`Knowledge ${id}: ${knowledge.title}`);
      }
      return ExitCode.Success;
    }

    if (subcommand === 'promote') {
      const candidateId = resolveSubcommandArgument(args) ?? readOptionValue(args, '--from-candidate');
      if (!candidateId) {
        throw new Error('playbook memory promote: missing required <candidate-id> argument');
      }

      loadCandidateKnowledgeById(cwd, candidateId);
      const payload = promoteMemoryCandidate(cwd, candidateId);

      if (options.format === 'json') {
        emitJsonOutput({ cwd, command: 'memory promote', payload });
      } else if (!options.quiet) {
        console.log(`Promoted candidate ${candidateId} into ${payload.artifactPath}.`);
      }
      return ExitCode.Success;
    }

    if (subcommand === 'retire') {
      const knowledgeId = resolveSubcommandArgument(args);
      if (!knowledgeId) {
        throw new Error('playbook memory retire: missing required <knowledge-id> argument');
      }

      const reason = readOptionValue(args, '--reason') ?? 'Retired during human memory review.';
      const payload = retirePromotedKnowledge(cwd, knowledgeId, { reason });

      if (options.format === 'json') {
        emitJsonOutput({ cwd, command: 'memory retire', payload });
      } else if (!options.quiet) {
        console.log(`Retired knowledge ${knowledgeId}.`);
      }
      return ExitCode.Success;
    }

    throw new Error('playbook memory: unsupported subcommand. Use events, candidates, knowledge, show, promote, or retire.');
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
