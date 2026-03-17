import * as playbookEngine from '@zachariahredfield/playbook-engine';
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

type MemorySubcommand = 'events' | 'query' | 'candidates' | 'knowledge' | 'show' | 'promote' | 'retire';

const printMemoryHelp = (): void => {
  console.log(`Usage: playbook memory <subcommand> [options]

Inspect and review repository memory artifacts.

Subcommands:
  events                           List episodic memory events
  query                            Query normalized repository memory events
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
  --event-type <type>          Query filter for normalized event type
  --subsystem <name>           Query filter for normalized event subsystem
  --run-id <id>                Query filter for normalized run id
  --subject <value>            Query filter for normalized subject
  --related-artifact <path>    Query filter for normalized related artifact path
  --view <name>                Query summary view (recent-routes|lane-transitions|worker-assignments|artifact-improvements)
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

const parseSubcommand = (args: string[]): MemorySubcommand | null => {
  const subcommand = args.find((arg) => !arg.startsWith('-'));
  if (!subcommand) {
    return null;
  }

  if (['events', 'query', 'candidates', 'knowledge', 'show', 'promote', 'retire'].includes(subcommand)) {
    return subcommand as MemorySubcommand;
  }

  return null;
};

const emitMemoryResult = (
  cwd: string,
  options: MemoryOptions,
  command: string,
  payload: Record<string, unknown>,
  textSummary: string
): void => {
  if (options.format === 'json') {
    emitJsonOutput({ cwd, command, payload });
    return;
  }

  if (!options.quiet) {
    console.log(textSummary);
  }
};

const emitMemoryError = (options: MemoryOptions, subcommand: string, error: unknown): void => {
  const message = error instanceof Error ? error.message : String(error);
  if (options.format === 'json') {
    console.log(JSON.stringify({ schemaVersion: '1.0', command: `memory-${subcommand}`, error: message }, null, 2));
  } else {
    console.error(message);
  }
};

export const runMemory = async (cwd: string, args: string[], options: MemoryOptions): Promise<number> => {
  const requestedSubcommand = args.find((arg) => !arg.startsWith('-'));
  const subcommand = parseSubcommand(args);

  if (!requestedSubcommand || args.includes('--help') || args.includes('-h')) {
    printMemoryHelp();
    return requestedSubcommand ? ExitCode.Success : ExitCode.Failure;
  }

  if (!subcommand) {
    emitMemoryError(options, requestedSubcommand, 'playbook memory: unsupported subcommand. Use events, query, candidates, knowledge, show, promote, or retire.');
    return ExitCode.Failure;
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

      emitMemoryResult(cwd, options, 'memory events', payload, `Found ${payload.events.length} memory events.`);
      return ExitCode.Success;
    }

    if (subcommand === 'query') {
      const view = readOptionValue(args, '--view');
      const runId = readOptionValue(args, '--run-id') ?? undefined;
      const relatedArtifact = readOptionValue(args, '--related-artifact') ?? undefined;
      const limit = parseIntegerOption(readOptionValue(args, '--limit'), '--limit');

      const payload = {
        schemaVersion: '1.0',
        command: 'memory-query',
        filters: {
          ...(readOptionValue(args, '--event-type') ? { event_type: readOptionValue(args, '--event-type') } : {}),
          ...(readOptionValue(args, '--subsystem') ? { subsystem: readOptionValue(args, '--subsystem') } : {}),
          ...(readOptionValue(args, '--run-id') ? { run_id: readOptionValue(args, '--run-id') } : {}),
          ...(readOptionValue(args, '--subject') ? { subject: readOptionValue(args, '--subject') } : {}),
          ...(relatedArtifact ? { related_artifact: relatedArtifact } : {}),
          order: parseOrderOption(readOptionValue(args, '--order')),
          ...(typeof limit === 'number' ? { limit } : {})
        },
        view: view ?? 'events',
        events: (() => {
          if (!view || view === 'events') {
            return (playbookEngine as any).queryRepositoryEvents(cwd, {
              event_type: readOptionValue(args, '--event-type') as
                | 'route_decision'
                | 'lane_transition'
                | 'worker_assignment'
                | 'execution_outcome'
                | 'improvement_signal'
                | 'lane_outcome'
                | 'improvement_candidate'
                | undefined,
              subsystem: readOptionValue(args, '--subsystem') as 'repository_memory' | 'knowledge_lifecycle' | undefined,
              run_id: runId,
              subject: readOptionValue(args, '--subject') ?? undefined,
              related_artifact: relatedArtifact,
              order: parseOrderOption(readOptionValue(args, '--order')),
              limit
            });
          }

          if (view === 'recent-routes') {
            return (playbookEngine as any).listRecentRouteDecisions(cwd, limit ?? 10);
          }

          if (view === 'lane-transitions') {
            if (!runId) throw new Error('playbook memory query: --run-id is required for view lane-transitions');
            return (playbookEngine as any).listLaneTransitionsForRun(cwd, runId);
          }

          if (view === 'worker-assignments') {
            if (!runId) throw new Error('playbook memory query: --run-id is required for view worker-assignments');
            return (playbookEngine as any).listWorkerAssignmentsForRun(cwd, runId);
          }

          if (view === 'artifact-improvements') {
            if (!relatedArtifact) {
              throw new Error('playbook memory query: --related-artifact is required for view artifact-improvements');
            }
            return (playbookEngine as any).listImprovementSignalsForArtifact(cwd, relatedArtifact);
          }

          throw new Error(
            'playbook memory query: invalid --view value. Use events, recent-routes, lane-transitions, worker-assignments, or artifact-improvements.'
          );
        })()
      };

      emitMemoryResult(cwd, options, 'memory query', payload, `Found ${payload.events.length} repository memory events (${payload.view}).`);
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

      emitMemoryResult(cwd, options, 'memory candidates', payload, `Found ${payload.candidates.length} memory candidates.`);
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

      emitMemoryResult(cwd, options, 'memory knowledge', payload, `Found ${payload.knowledge.length} promoted memory records.`);
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
        } else {
          emitMemoryResult(cwd, options, 'memory show', payload, `Candidate ${id}: ${candidate.title}`);
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

      emitMemoryResult(cwd, options, 'memory show', payload, `Knowledge ${id}: ${knowledge.title}`);
      return ExitCode.Success;
    }

    if (subcommand === 'promote') {
      const candidateId = resolveSubcommandArgument(args) ?? readOptionValue(args, '--from-candidate');
      if (!candidateId) {
        throw new Error('playbook memory promote: missing required <candidate-id> argument');
      }

      loadCandidateKnowledgeById(cwd, candidateId);
      const payload = promoteMemoryCandidate(cwd, candidateId);

      emitMemoryResult(cwd, options, 'memory promote', payload, `Promoted candidate ${candidateId} into ${payload.artifactPath}.`);
      return ExitCode.Success;
    }

    if (subcommand === 'retire') {
      const knowledgeId = resolveSubcommandArgument(args);
      if (!knowledgeId) {
        throw new Error('playbook memory retire: missing required <knowledge-id> argument');
      }

      const reason = readOptionValue(args, '--reason') ?? 'Retired during human memory review.';
      const payload = retirePromotedKnowledge(cwd, knowledgeId, { reason });

      emitMemoryResult(cwd, options, 'memory retire', payload, `Retired knowledge ${knowledgeId}.`);
      return ExitCode.Success;
    }
    throw new Error('playbook memory: unsupported subcommand. Use events, query, candidates, knowledge, show, promote, or retire.');

  } catch (error) {
    emitMemoryError(options, subcommand, error);
    return ExitCode.Failure;
  }
};
