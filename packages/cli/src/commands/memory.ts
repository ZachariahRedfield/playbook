import * as playbookEngine from '@zachariahredfield/playbook-engine';
import fs from 'node:fs';
import path from 'node:path';
import {
  expandMemoryProvenance,
  loadCandidateKnowledgeById,
  lookupMemoryCandidateKnowledge,
  lookupMemoryEventTimeline,
  lookupPromotedMemoryKnowledge,
  promoteMemoryCandidate,
  retirePromotedKnowledge,
  resolvePatternKnowledgeStore
} from '@zachariahredfield/playbook-engine';
import { emitJsonOutput } from '../lib/jsonArtifact.js';
import { ExitCode } from '../lib/cliContract.js';

type MemoryOptions = {
  format: 'text' | 'json';
  quiet: boolean;
};

type MemorySubcommand = 'events' | 'query' | 'candidates' | 'knowledge' | 'outcome-feedback' | 'policy-improvement' | 'compaction' | 'pressure' | 'replay-promotion' | 'show' | 'promote' | 'retire';
type MemoryPressureBand = 'normal' | 'warm' | 'pressure' | 'critical';
type MemoryPressureActionFilter = 'dedupe' | 'compact' | 'summarize' | 'evict';
type MemoryClassFilter = 'canonical' | 'compactable' | 'disposable';
type MemoryCandidateSourceFilter = 'replay' | 'interop-followup';
type ReplayPromotionStateFilter = 'candidate' | 'promotion-ready' | 'promoted' | 'stale' | 'superseded';
type ReplayPromotionBucketFilter = 'replay' | 'consolidation' | 'compaction' | 'promotion';

const printMemoryHelp = (): void => {
  console.log(`Usage: playbook memory <subcommand> [options]

Inspect and review repository memory artifacts.

Subcommands:
  events                           List episodic memory events
  query                            Query normalized repository memory events
  candidates                       List replayed memory candidates
  knowledge                        List promoted memory knowledge
  outcome-feedback                 Inspect read-only runtime outcome feedback
  policy-improvement               Inspect candidate-only policy improvement suggestions
  compaction                       Review deterministic compaction decisions
  pressure                         Inspect read-only memory pressure status + plan
  replay-promotion                Inspect replay/consolidation/compaction/promotion lifecycle contract
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
  --source <name>              Filter candidates by source (replay|interop-followup)
  --include-superseded         Include superseded knowledge in memory knowledge
  --reason <text>              Retirement reason override for memory retire
  --decision <name>            Filter compaction review by decision bucket
  --band <name>                Filter memory pressure by band (normal|warm|pressure|critical)
  --action <name>              Filter memory pressure plan actions (dedupe|compact|summarize|evict)
  --class <name>               Filter pressure followups by retention class (canonical|compactable|disposable)
  --state <name>               Filter replay-promotion lifecycle state (candidate|promotion-ready|promoted|stale|superseded)
  --bucket <name>              Filter replay-promotion inventory bucket (replay|consolidation|compaction|promotion)
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

const resolvePressureNestedSubcommand = (args: string[]): string | null => {
  const pressureIndex = args.findIndex((arg) => arg === 'pressure');
  if (pressureIndex < 0) {
    return null;
  }
  const nested = args[pressureIndex + 1];
  if (!nested || nested.startsWith('-')) {
    return null;
  }
  return nested;
};

const parseSubcommand = (args: string[]): MemorySubcommand | null => {
  const subcommand = args.find((arg) => !arg.startsWith('-'));
  if (!subcommand) {
    return null;
  }

  if (['events', 'query', 'candidates', 'knowledge', 'outcome-feedback', 'policy-improvement', 'compaction', 'pressure', 'replay-promotion', 'show', 'promote', 'retire'].includes(subcommand)) {
    return subcommand as MemorySubcommand;
  }

  return null;
};

const parseMemoryPressureBandOption = (raw: string | null): MemoryPressureBand | undefined => {
  if (raw === null) return undefined;
  if (raw === 'normal' || raw === 'warm' || raw === 'pressure' || raw === 'critical') {
    return raw;
  }
  throw new Error(`playbook memory pressure: invalid --band value "${raw}"; expected normal, warm, pressure, or critical`);
};

const parseMemoryPressureActionOption = (raw: string | null): MemoryPressureActionFilter | undefined => {
  if (raw === null) return undefined;
  if (raw === 'dedupe' || raw === 'compact' || raw === 'summarize' || raw === 'evict') {
    return raw;
  }
  throw new Error(`playbook memory pressure: invalid --action value "${raw}"; expected dedupe, compact, summarize, or evict`);
};

const parseMemoryClassOption = (raw: string | null): MemoryClassFilter | undefined => {
  if (raw === null) return undefined;
  if (raw === 'canonical' || raw === 'compactable' || raw === 'disposable') {
    return raw;
  }
  throw new Error(`playbook memory pressure followups: invalid --class value "${raw}"; expected canonical, compactable, or disposable`);
};

const parseMemoryCandidateSourceOption = (raw: string | null): MemoryCandidateSourceFilter | undefined => {
  if (raw === null) return undefined;
  if (raw === 'replay' || raw === 'interop-followup') {
    return raw;
  }
  throw new Error(`playbook memory candidates: invalid --source value "${raw}"; expected replay or interop-followup`);
};

const parseReplayPromotionStateOption = (raw: string | null): ReplayPromotionStateFilter | undefined => {
  if (raw === null) return undefined;
  if (raw === 'candidate' || raw === 'promotion-ready' || raw === 'promoted' || raw === 'stale' || raw === 'superseded') return raw;
  throw new Error(
    `playbook memory replay-promotion: invalid --state value "${raw}"; expected candidate, promotion-ready, promoted, stale, or superseded`
  );
};

const parseReplayPromotionBucketOption = (raw: string | null): ReplayPromotionBucketFilter | undefined => {
  if (raw === null) return undefined;
  if (raw === 'replay' || raw === 'consolidation' || raw === 'compaction' || raw === 'promotion') return raw;
  throw new Error(`playbook memory replay-promotion: invalid --bucket value "${raw}"; expected replay, consolidation, compaction, or promotion`);
};

type InteropDerivedCandidateMetadata = {
  candidateId: string;
  source: {
    requestId: string;
    receiptId: string;
  };
  confidence?: {
    score?: number;
    rationale?: string;
  };
  sourceHash?: string;
  sourceContractFingerprint?: string;
  interopFollowupId?: string;
  eligibilityReason?: string;
};

const readInteropDerivedCandidateMetadata = (cwd: string): Map<string, InteropDerivedCandidateMetadata> => {
  const artifactPath = path.join(cwd, '.playbook/memory/candidates.json');
  if (!fs.existsSync(artifactPath)) {
    return new Map();
  }

  const parsed = JSON.parse(fs.readFileSync(artifactPath, 'utf8')) as { interopDerivedCandidates?: InteropDerivedCandidateMetadata[] };
  const derived = Array.isArray(parsed.interopDerivedCandidates) ? parsed.interopDerivedCandidates : [];
  return new Map(derived.map((entry) => [entry.candidateId, entry] as const));
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
    emitMemoryError(
      options,
      requestedSubcommand,
      'playbook memory: unsupported subcommand. Use events, query, candidates, knowledge, outcome-feedback, policy-improvement, compaction, pressure, replay-promotion, show, promote, or retire.'
    );
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
      const sourceFilter = parseMemoryCandidateSourceOption(readOptionValue(args, '--source'));
      const interopMetadataById = readInteropDerivedCandidateMetadata(cwd);
      const candidates = lookupMemoryCandidateKnowledge(cwd, {
        kind: (readOptionValue(args, '--kind') as 'decision' | 'pattern' | 'failure_mode' | 'invariant' | 'open_question' | null) ?? undefined,
        includeStale: args.includes('--include-stale')
      })
        .map((candidate) => {
          const interop = interopMetadataById.get(candidate.candidateId);
          return {
            ...candidate,
            source_metadata: interop
              ? {
                  source: 'interop-followup' as const,
                  derived_from_interop_followup: true,
                  interop_followup: {
                    followup_id: interop.interopFollowupId ?? null,
                    request_id: interop.source.requestId,
                    receipt_id: interop.source.receiptId,
                    eligibility_reason: interop.eligibilityReason ?? null,
                    confidence_score: interop.confidence?.score ?? null,
                    source_hash: interop.sourceHash ?? null,
                    source_contract_fingerprint: interop.sourceContractFingerprint ?? null
                  }
                }
              : {
                  source: 'replay' as const,
                  derived_from_interop_followup: false
                }
          };
        })
        .filter((candidate) => (sourceFilter ? candidate.source_metadata.source === sourceFilter : true));

      const payload = {
        schemaVersion: '1.0',
        command: 'memory-candidates',
        ...(sourceFilter ? { filters: { source: sourceFilter } } : {}),
        candidates
      };

      emitMemoryResult(cwd, options, 'memory candidates', payload, `Found ${payload.candidates.length} memory candidates.`);
      return ExitCode.Success;
    }

    if (subcommand === 'knowledge') {
      const patternStore = resolvePatternKnowledgeStore('repo_local_memory', { projectRoot: cwd });
      const payload = {
        schemaVersion: '1.0',
        command: 'memory-knowledge',
        knowledge: lookupPromotedMemoryKnowledge(cwd, {
          kind: (readOptionValue(args, '--kind') as 'decision' | 'pattern' | 'failure_mode' | 'invariant' | null) ?? undefined,
          includeSuperseded: args.includes('--include-superseded')
        }),
        scope_metadata: {
          pattern_scope: {
            scope: patternStore.scope,
            artifact_path: patternStore.canonicalRelativePath,
            compat_artifact_paths: patternStore.compatibilityRelativePaths
          }
        }
      };

      emitMemoryResult(cwd, options, 'memory knowledge', payload, `Found ${payload.knowledge.length} promoted memory records.`);
      return ExitCode.Success;
    }

    if (subcommand === 'outcome-feedback') {
      const artifactPath = path.join(cwd, '.playbook/outcome-feedback.json');
      if (!fs.existsSync(artifactPath)) {
        throw new Error('playbook memory outcome-feedback: missing required artifact .playbook/outcome-feedback.json');
      }

      const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8')) as {
        outcomeCounts?: Record<string, number>;
        outcomes?: Array<{
          outcomeId?: string;
          outcomeClass?: string;
          sourceType?: string;
          sourceRef?: string;
          observedAt?: string;
          provenanceRefs?: string[];
          candidateSignals?: {
            confidenceUpdate?: { direction?: string; magnitude?: number; rationale?: string };
            triggerQualityNotes?: string[];
            staleKnowledgeFlags?: string[];
            trendUpdates?: string[];
          };
        }>;
        signals?: {
          confidence?: string[];
          triggerQuality?: string[];
          staleKnowledge?: string[];
          trends?: string[];
        };
        governance?: {
          candidateOnly?: boolean;
          autoPromotion?: boolean;
          autoMutation?: boolean;
          reviewRequired?: boolean;
        };
      };

      const outcomes = Array.isArray(artifact.outcomes) ? artifact.outcomes : [];
      const trendUpdates = [...new Set(outcomes.flatMap((entry) => entry.candidateSignals?.trendUpdates ?? []))].sort((a, b) => a.localeCompare(b));
      const provenanceRefs = [...new Set(outcomes.flatMap((entry) => entry.provenanceRefs ?? []))].sort((a, b) => a.localeCompare(b));
      const confidenceSignals = outcomes
        .map((entry) => ({
          outcome_id: entry.outcomeId ?? null,
          outcome_class: entry.outcomeClass ?? null,
          confidence_direction: entry.candidateSignals?.confidenceUpdate?.direction ?? null,
          confidence_magnitude: entry.candidateSignals?.confidenceUpdate?.magnitude ?? null,
          confidence_rationale: entry.candidateSignals?.confidenceUpdate?.rationale ?? null
        }))
        .filter((entry) => entry.confidence_direction !== null);
      const triggerSignals = [...new Set(outcomes.flatMap((entry) => entry.candidateSignals?.triggerQualityNotes ?? []))].sort((a, b) => a.localeCompare(b));
      const staleKnowledgeSignals = [...new Set(outcomes.flatMap((entry) => entry.candidateSignals?.staleKnowledgeFlags ?? []))].sort((a, b) => a.localeCompare(b));

      const nextReviewAction = staleKnowledgeSignals.length > 0
        ? 'review stale-knowledge flags before candidate promotion decisions'
        : confidenceSignals.some((entry) => entry.confidence_direction === 'down')
          ? 'review confidence-down outcomes for bounded repair candidates'
          : triggerSignals.length > 0
            ? 'review trigger quality notes and tighten pre-check guidance'
            : 'continue routine human review of candidate-only outcome feedback';

      const payload = {
        schemaVersion: '1.0',
        command: 'memory-outcome-feedback',
        artifactPath: '.playbook/outcome-feedback.json',
        outcome_counts: artifact.outcomeCounts ?? {},
        outcomes: outcomes.map((entry) => ({
          outcome_id: entry.outcomeId ?? null,
          outcome_class: entry.outcomeClass ?? null,
          source_type: entry.sourceType ?? null,
          source_ref: entry.sourceRef ?? null,
          observed_at: entry.observedAt ?? null,
          provenance_refs: entry.provenanceRefs ?? [],
          confidence: entry.candidateSignals?.confidenceUpdate ?? null,
          trigger_quality_notes: entry.candidateSignals?.triggerQualityNotes ?? [],
          stale_knowledge_flags: entry.candidateSignals?.staleKnowledgeFlags ?? [],
          trend_updates: entry.candidateSignals?.trendUpdates ?? []
        })),
        signals: {
          confidence: confidenceSignals,
          trigger_quality: triggerSignals,
          stale_knowledge: staleKnowledgeSignals,
          trends: trendUpdates
        },
        provenance_refs: provenanceRefs,
        next_review_action: nextReviewAction,
        governance: {
          candidate_only: artifact.governance?.candidateOnly ?? true,
          auto_promotion: artifact.governance?.autoPromotion ?? false,
          auto_mutation: artifact.governance?.autoMutation ?? false,
          review_required: artifact.governance?.reviewRequired ?? true
        },
        full_outcome_feedback_artifact: artifact
      };

      emitMemoryResult(
        cwd,
        options,
        'memory outcome-feedback',
        payload,
        `Outcome feedback outcomes=${outcomes.length} trend_updates=${trendUpdates.length} next_review_action=${nextReviewAction}`
      );
      return ExitCode.Success;
    }

    if (subcommand === 'policy-improvement') {
      const artifactPath = path.join(cwd, '.playbook/policy-improvement.json');
      if (!fs.existsSync(artifactPath)) {
        throw new Error('playbook memory policy-improvement: missing required artifact .playbook/policy-improvement.json');
      }

      const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8')) as {
        candidateRankingAdjustments?: Array<{ candidateId?: string; adjustmentDirection?: string; adjustmentMagnitude?: number; rationale?: string; provenanceRefs?: string[] }>;
        prioritizationImprovementSuggestions?: Array<{ suggestionId?: string; priority?: string; summary?: string; provenanceRefs?: string[] }>;
        repeatedBlockerInfluence?: Array<{ blockerKey?: string; blockerType?: string; occurrences?: number; influenceScore?: number; provenanceRefs?: string[] }>;
        confidenceTrendNotes?: Array<{ noteId?: string; trend?: string; confidenceDelta?: number; summary?: string; provenanceRefs?: string[] }>;
        reviewRequiredFlags?: Record<string, unknown>;
        authority?: { mutation?: string; promotion?: string; ruleMutation?: string };
        provenanceRefs?: string[];
      };

      const ranking = [...(artifact.candidateRankingAdjustments ?? [])].sort((a, b) =>
        String(a.candidateId ?? '').localeCompare(String(b.candidateId ?? ''))
      );
      const priorities = [...(artifact.prioritizationImprovementSuggestions ?? [])].sort((a, b) =>
        String(a.suggestionId ?? '').localeCompare(String(b.suggestionId ?? ''))
      );
      const blockers = [...(artifact.repeatedBlockerInfluence ?? [])].sort((a, b) =>
        (Number(b.occurrences ?? 0) - Number(a.occurrences ?? 0)) ||
        String(a.blockerKey ?? '').localeCompare(String(b.blockerKey ?? ''))
      );
      const trends = [...(artifact.confidenceTrendNotes ?? [])].sort((a, b) =>
        String(a.noteId ?? '').localeCompare(String(b.noteId ?? ''))
      );
      const provenanceRefs = [...new Set([...(artifact.provenanceRefs ?? []), ...ranking.flatMap((row) => row.provenanceRefs ?? []), ...priorities.flatMap((row) => row.provenanceRefs ?? []), ...blockers.flatMap((row) => row.provenanceRefs ?? []), ...trends.flatMap((row) => row.provenanceRefs ?? [])])].sort((a, b) => a.localeCompare(b));

      const payload = {
        schemaVersion: '1.0',
        command: 'memory-policy-improvement',
        artifactPath: '.playbook/policy-improvement.json',
        candidate_ranking_adjustments: ranking.map((entry) => ({
          candidate_id: entry.candidateId ?? null,
          adjustment_direction: entry.adjustmentDirection ?? null,
          adjustment_magnitude: entry.adjustmentMagnitude ?? null,
          rationale: entry.rationale ?? null,
          provenance_refs: entry.provenanceRefs ?? []
        })),
        prioritization_suggestions: priorities.map((entry) => ({
          suggestion_id: entry.suggestionId ?? null,
          priority: entry.priority ?? null,
          summary: entry.summary ?? null,
          provenance_refs: entry.provenanceRefs ?? []
        })),
        repeated_blocker_influence: blockers.map((entry) => ({
          blocker_key: entry.blockerKey ?? null,
          blocker_type: entry.blockerType ?? null,
          occurrences: entry.occurrences ?? 0,
          influence_score: entry.influenceScore ?? 0,
          provenance_refs: entry.provenanceRefs ?? []
        })),
        confidence_trend_notes: trends.map((entry) => ({
          note_id: entry.noteId ?? null,
          trend: entry.trend ?? null,
          confidence_delta: entry.confidenceDelta ?? 0,
          summary: entry.summary ?? null,
          provenance_refs: entry.provenanceRefs ?? []
        })),
        review_required_flags: artifact.reviewRequiredFlags ?? {},
        authority: {
          mutation: artifact.authority?.mutation ?? 'read-only',
          promotion: artifact.authority?.promotion ?? 'review-required',
          rule_mutation: artifact.authority?.ruleMutation ?? 'forbidden'
        },
        provenance_refs: provenanceRefs,
        full_policy_improvement_artifact: artifact
      };

      emitMemoryResult(
        cwd,
        options,
        'memory policy-improvement',
        payload,
        `Policy improvement ranking=${ranking.length} prioritization=${priorities.length} blockers=${blockers.length} trends=${trends.length}`
      );
      return ExitCode.Success;
    }


    if (subcommand === 'compaction') {
      const artifact = (playbookEngine as any).reviewMemoryCompaction(cwd);
      const payload = {
        schemaVersion: '1.0',
        command: 'memory-compaction-review',
        artifactPath: '.playbook/memory/compaction-review.json',
        summary: artifact.summary,
        entries: (playbookEngine as any).lookupMemoryCompactionReview(cwd, {
          decision: (readOptionValue(args, '--decision') as 'discard' | 'attach' | 'merge' | 'new_candidate' | null) ?? undefined,
          kind: (readOptionValue(args, '--kind') as 'decision' | 'pattern' | 'failure_mode' | 'invariant' | 'open_question' | null) ?? undefined
        })
      };

      emitMemoryResult(cwd, options, 'memory compaction', payload, `Found ${payload.entries.length} compaction review entries.`);
      return ExitCode.Success;
    }

    if (subcommand === 'pressure') {
      const pressureSubcommand = resolvePressureNestedSubcommand(args);
      if (pressureSubcommand && pressureSubcommand !== 'followups') {
        throw new Error('playbook memory pressure: unsupported nested subcommand. Use followups or omit nested subcommand.');
      }

      if (pressureSubcommand === 'followups') {
        const bandFilter = (() => {
          const raw = readOptionValue(args, '--band');
          if (raw === null) return undefined;
          if (raw === 'warm' || raw === 'pressure' || raw === 'critical') return raw;
          throw new Error('playbook memory pressure followups: invalid --band value; expected warm, pressure, or critical');
        })();
        const actionFilter = parseMemoryPressureActionOption(readOptionValue(args, '--action'));
        const classFilter = parseMemoryClassOption(readOptionValue(args, '--class'));
        const followupsPath = path.join(cwd, '.playbook/memory-pressure-followups.json');
        if (!fs.existsSync(followupsPath)) {
          throw new Error('playbook memory pressure followups: missing required artifact .playbook/memory-pressure-followups.json');
        }

        const followupsArtifact = JSON.parse(fs.readFileSync(followupsPath, 'utf8')) as {
          currentBand?: MemoryPressureBand;
          rowsByBand?: Partial<Record<'warm' | 'pressure' | 'critical', Array<{
            followupId?: string;
            action?: 'dedupe' | 'compact' | 'summarize' | 'evict-disposable';
            priority?: string;
            targets?: string[];
            excludedCanonicalTargets?: string[];
            reason?: string;
          }>>>;
          retentionClasses?: { canonical?: string[]; compactable?: string[]; disposable?: string[] };
        };

        const bands: Array<'warm' | 'pressure' | 'critical'> = bandFilter ? [bandFilter] : ['warm', 'pressure', 'critical'];
        const rows = bands.flatMap((band) =>
          (followupsArtifact.rowsByBand?.[band] ?? []).map((row) => ({ band, ...row }))
        );
        const normalizedRows = rows.map((row) => ({
          ...row,
          action: row.action === 'evict-disposable' ? 'evict' : row.action
        }));
        const actionFilteredRows = actionFilter
          ? normalizedRows.filter((row) => row.action === actionFilter)
          : normalizedRows;

        const retentionClassLookup = {
          canonical: new Set(followupsArtifact.retentionClasses?.canonical ?? []),
          compactable: new Set(followupsArtifact.retentionClasses?.compactable ?? []),
          disposable: new Set(followupsArtifact.retentionClasses?.disposable ?? [])
        };
        const classAnnotatedRows = actionFilteredRows.map((row) => {
          const paths = [...(row.targets ?? []), ...(row.excludedCanonicalTargets ?? [])];
          const matchedClasses = (['canonical', 'compactable', 'disposable'] as const).filter((className) =>
            paths.some((target) => retentionClassLookup[className].has(target))
          );
          return {
            ...row,
            matchedClasses
          };
        });
        const filteredRows = classFilter
          ? classAnnotatedRows.filter((row) => row.matchedClasses.includes(classFilter))
          : classAnnotatedRows;

        const actionCounts = filteredRows.reduce<Record<string, number>>((acc, row) => {
          const key = String(row.action ?? 'unknown');
          acc[key] = (acc[key] ?? 0) + 1;
          return acc;
        }, {});
        const topRecommendedActions = Object.entries(actionCounts)
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
          .slice(0, 3)
          .map(([action, count]) => ({ action, count }));
        const affectedTargets = [...new Set(filteredRows.flatMap((row) => row.targets ?? []))].sort((a, b) => a.localeCompare(b));
        const nextAction = filteredRows[0]
          ? {
              followupId: filteredRows[0].followupId ?? null,
              action: filteredRows[0].action ?? null,
              band: filteredRows[0].band,
              priority: filteredRows[0].priority ?? null,
              reason: filteredRows[0].reason ?? null,
              targets: filteredRows[0].targets ?? []
            }
          : null;

        const payload = {
          schemaVersion: '1.0',
          command: 'memory-pressure-followups',
          artifactPath: '.playbook/memory-pressure-followups.json',
          filters: {
            ...(bandFilter ? { band: bandFilter } : {}),
            ...(actionFilter ? { action: actionFilter } : {}),
            ...(classFilter ? { class: classFilter } : {})
          },
          current_band: followupsArtifact.currentBand ?? 'normal',
          affected_targets: affectedTargets,
          top_recommended_actions: topRecommendedActions,
          next_action: nextAction,
          followups: filteredRows,
          full_followups_artifact: followupsArtifact
        };

        emitMemoryResult(
          cwd,
          options,
          'memory pressure followups',
          payload,
          [
            `Current band: ${payload.current_band}`,
            `Affected targets: ${payload.affected_targets.length}`,
            `Top recommended actions: ${payload.top_recommended_actions.map((entry) => `${entry.action}(${entry.count})`).join(', ') || 'none'}`,
            `Next action: ${payload.next_action ? `${payload.next_action.action} (${payload.next_action.band})` : 'none'}`
          ].join('\n')
        );
        return ExitCode.Success;
      }

      const bandFilter = parseMemoryPressureBandOption(readOptionValue(args, '--band'));
      const actionFilter = parseMemoryPressureActionOption(readOptionValue(args, '--action'));
      const statusPath = path.join(cwd, '.playbook/memory-pressure.json');
      const planPath = path.join(cwd, '.playbook/memory-pressure-plan.json');
      if (!fs.existsSync(statusPath)) {
        throw new Error('playbook memory pressure: missing required artifact .playbook/memory-pressure.json');
      }
      if (!fs.existsSync(planPath)) {
        throw new Error('playbook memory pressure: missing required artifact .playbook/memory-pressure-plan.json');
      }

      const statusArtifact = JSON.parse(fs.readFileSync(statusPath, 'utf8')) as {
        score?: { normalized?: number };
        band?: MemoryPressureBand;
        policy?: { watermarks?: { warm?: number; pressure?: number; critical?: number }; hysteresis?: number };
        usage?: { usedBytes?: number; fileCount?: number; eventCount?: number };
        classes?: { canonical?: unknown[]; compactable?: unknown[]; disposable?: unknown[] };
      };
      const planArtifact = JSON.parse(fs.readFileSync(planPath, 'utf8')) as {
        recommendedByBand?: Partial<Record<Exclude<MemoryPressureBand, 'normal'>, Array<{ action?: MemoryPressureActionFilter; reason?: string; targets?: string[]; requiresSummary?: boolean }>>>;
      };

      const band = statusArtifact.band ?? 'normal';
      const selectedBand = bandFilter ?? band;
      const recommendedFromPlan =
        selectedBand === 'normal'
          ? []
          : planArtifact.recommendedByBand?.[selectedBand as Exclude<MemoryPressureBand, 'normal'>] ?? [];
      const filteredRecommendedActions = actionFilter
        ? recommendedFromPlan.filter((entry) => entry.action === actionFilter)
        : recommendedFromPlan;

      const payload = {
        schemaVersion: '1.0',
        command: 'memory-pressure',
        artifacts: {
          status: '.playbook/memory-pressure.json',
          plan: '.playbook/memory-pressure-plan.json'
        },
        filters: {
          ...(bandFilter ? { band: bandFilter } : {}),
          ...(actionFilter ? { action: actionFilter } : {})
        },
        score: statusArtifact.score?.normalized ?? 0,
        band,
        hysteresis_thresholds: {
          warm: statusArtifact.policy?.watermarks?.warm ?? 0,
          pressure: statusArtifact.policy?.watermarks?.pressure ?? 0,
          critical: statusArtifact.policy?.watermarks?.critical ?? 0,
          hysteresis: statusArtifact.policy?.hysteresis ?? 0
        },
        usage_totals: {
          usedBytes: statusArtifact.usage?.usedBytes ?? 0,
          fileCount: statusArtifact.usage?.fileCount ?? 0,
          eventCount: statusArtifact.usage?.eventCount ?? 0
        },
        retention_classes_summary: {
          canonical: Array.isArray(statusArtifact.classes?.canonical) ? statusArtifact.classes.canonical.length : 0,
          compactable: Array.isArray(statusArtifact.classes?.compactable) ? statusArtifact.classes.compactable.length : 0,
          disposable: Array.isArray(statusArtifact.classes?.disposable) ? statusArtifact.classes.disposable.length : 0
        },
        ordered_recommended_actions: filteredRecommendedActions,
        full_status_artifact: statusArtifact,
        full_plan_artifact: planArtifact
      };

      emitMemoryResult(
        cwd,
        options,
        'memory pressure',
        payload,
        `Memory pressure ${payload.band}@${payload.score.toFixed(2)} actions=${payload.ordered_recommended_actions.length}`
      );
      return ExitCode.Success;
    }

    if (subcommand === 'replay-promotion') {
      const artifactPath = path.join(cwd, '.playbook/replay-promotion-system.json');
      if (!fs.existsSync(artifactPath)) {
        throw new Error('playbook memory replay-promotion: missing required artifact .playbook/replay-promotion-system.json');
      }

      const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8')) as {
        replay_candidate_inventory?: { count?: number };
        consolidation_candidate_inventory?: { count?: number };
        compaction_review_buckets?: { total?: number };
        salience_review_required_status?: { reviewRequired?: { replay?: number; consolidation?: number; compaction?: number } };
        promotion_boundaries?: { candidateOnly?: { replay?: number; consolidation?: number; compaction?: number }; promotionReady?: { consolidationEligible?: number; compactionNewCandidate?: number } };
        lifecycle_state_summaries?: { byState?: Record<string, number> };
      } & Record<string, unknown>;
      const stateFilter = parseReplayPromotionStateOption(readOptionValue(args, '--state'));
      const bucketFilter = parseReplayPromotionBucketOption(readOptionValue(args, '--bucket'));

      const lifecycleByState = artifact.lifecycle_state_summaries?.byState ?? {};
      const promotionReadyCount = (artifact.promotion_boundaries?.promotionReady?.consolidationEligible ?? 0) + (artifact.promotion_boundaries?.promotionReady?.compactionNewCandidate ?? 0);
      const stateInventory = {
        candidate: lifecycleByState.candidate ?? 0,
        'promotion-ready': promotionReadyCount,
        promoted: lifecycleByState.promoted ?? 0,
        stale: lifecycleByState.stale ?? 0,
        superseded: lifecycleByState.superseded ?? 0
      };
      const bucketInventory = {
        replay: artifact.replay_candidate_inventory?.count ?? 0,
        consolidation: artifact.consolidation_candidate_inventory?.count ?? 0,
        compaction: artifact.compaction_review_buckets?.total ?? 0,
        promotion: stateInventory.promoted
      };
      const reviewRequired = {
        replay: artifact.salience_review_required_status?.reviewRequired?.replay ?? 0,
        consolidation: artifact.salience_review_required_status?.reviewRequired?.consolidation ?? 0,
        compaction: artifact.salience_review_required_status?.reviewRequired?.compaction ?? 0
      };
      const topReviewRequiredBoundaries = Object.entries(reviewRequired)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 3)
        .map(([boundary, count]) => ({ boundary, count }));
      const status = promotionReadyCount > 0 ? 'review-required' : 'stable';
      const nextAction = topReviewRequiredBoundaries[0] && topReviewRequiredBoundaries[0].count > 0
        ? `review ${topReviewRequiredBoundaries[0].boundary} boundary`
        : 'no review-required boundaries';

      const payload = {
        schemaVersion: '1.0',
        command: 'memory-replay-promotion',
        artifactPath: '.playbook/replay-promotion-system.json',
        filters: {
          ...(stateFilter ? { state: stateFilter } : {}),
          ...(bucketFilter ? { bucket: bucketFilter } : {})
        },
        status,
        replay_promote_summary_counts: {
          replay_candidates: bucketInventory.replay,
          promotion_ready: stateInventory['promotion-ready'],
          promoted: stateInventory.promoted
        },
        top_review_required_boundaries: topReviewRequiredBoundaries,
        next_action: nextAction,
        state_inventory: stateFilter ? { [stateFilter]: stateInventory[stateFilter] } : stateInventory,
        bucket_inventory: bucketFilter ? { [bucketFilter]: bucketInventory[bucketFilter] } : bucketInventory,
        replay_candidate_inventory: artifact.replay_candidate_inventory ?? {},
        consolidation_candidate_inventory: artifact.consolidation_candidate_inventory ?? {},
        compaction_review_buckets: artifact.compaction_review_buckets ?? {},
        salience_review_required_status: artifact.salience_review_required_status ?? {},
        promotion_boundaries: artifact.promotion_boundaries ?? {},
        lifecycle_state_summaries: artifact.lifecycle_state_summaries ?? {},
        provenance_refs_end_to_end: artifact.provenance_refs_end_to_end ?? {},
        replay_promotion_system: artifact
      };

      emitMemoryResult(
        cwd,
        options,
        'memory replay-promotion',
        payload,
        [
          `Status: ${payload.status}`,
          `Replay/promote summary: replay=${payload.replay_promote_summary_counts.replay_candidates} promotion-ready=${payload.replay_promote_summary_counts.promotion_ready} promoted=${payload.replay_promote_summary_counts.promoted}`,
          `Top review-required boundaries: ${payload.top_review_required_boundaries.map((entry) => `${entry.boundary}(${entry.count})`).join(', ') || 'none'}`,
          `Next action: ${payload.next_action}`
        ].join('\n')
      );
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
    throw new Error('playbook memory: unsupported subcommand. Use events, query, candidates, knowledge, outcome-feedback, policy-improvement, compaction, pressure, replay-promotion, show, promote, or retire.');

  } catch (error) {
    emitMemoryError(options, subcommand, error);
    return ExitCode.Failure;
  }
};
