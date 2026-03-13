import fs from 'node:fs';
import path from 'node:path';
import { readPromotedPatterns } from '../compaction/promotionQueue.js';
import { expandMemoryProvenance, lookupPromotedMemoryKnowledge, lookupMemoryCandidateKnowledge } from '../memory/inspection.js';
import type { MemoryReplayCandidateProvenance } from '../schema/memoryReplay.js';
import { readSession, SESSION_ARTIFACT_RELATIVE_PATH } from '../session/sessionStore.js';

type KnowledgeHitSource = 'promoted-pattern' | 'knowledge-candidate';

type MemorySourceKind = 'promoted-patterns' | 'knowledge-candidates' | 'session' | 'runtime-runs';

export type RuntimeMemorySource = {
  kind: MemorySourceKind;
  artifact: string;
  available: boolean;
  records: number;
};

export type RuntimeKnowledgeHit = {
  id: string;
  source: KnowledgeHitSource;
  summary: string;
  confidence?: number;
};

export type RuntimeRecentRelevantEvent = {
  kind: 'session-step' | 'pinned-artifact' | 'constraint' | 'unresolved-question' | 'runtime-task';
  summary: string;
  occurredAt?: string;
};

export type RuntimeTaskMemoryProvenance = {
  runId: string;
  taskId: string;
  stepId: string;
  status: 'passed' | 'failed' | 'skipped';
  memoryEventId: string;
  memoryFingerprint: string;
  memorySourcePath: string;
  knowledgeIds: string[];
};

export type RuntimeTaskMemoryProvenanceExpanded = RuntimeTaskMemoryProvenance & {
  eventKind: string | null;
  eventSummary: string | null;
  eventCreatedAt: string | null;
};

export type RuntimeMemoryEnvelope = {
  memorySummary: string;
  memorySources: RuntimeMemorySource[];
  knowledgeHits: RuntimeKnowledgeHit[];
  recentRelevantEvents: RuntimeRecentRelevantEvent[];
  runtimeTaskProvenance: RuntimeTaskMemoryProvenanceExpanded[];
  dryRunEvidence: RuntimeDryRunEvidenceSummary[];
};

export type RuntimeDryRunEvidenceSummary = {
  runId: string;
  stepId: string;
  taskId: string;
  status: 'passed' | 'failed' | 'skipped';
  sourcePlanTaskId: string | null;
  runtimeTaskId: string | null;
  policyDecision: string | null;
  evidenceRefs: string[];
  knowledgeIds: string[];
  provenanceSummary: string;
};

type RuntimeMemoryOptions = {
  target?: string;
  question?: string;
  limit?: number;
};

type KnowledgeCandidatesArtifact = {
  candidates?: Array<{
    candidateId?: string;
    theme?: string;
    evidence?: Array<{ path?: string }>;
  }>;
};

const KNOWLEDGE_CANDIDATES_RELATIVE_PATH = '.playbook/knowledge/candidates.json' as const;
const EXECUTION_RUNS_DIR_RELATIVE_PATH = '.playbook/runs' as const;

type RuntimeStepRecord = {
  runId: string;
  stepId: string;
  status: 'passed' | 'failed' | 'skipped';
  createdAt: string;
  taskId: string;
  evidenceRefs: string[];
};

type RuntimeExecutionRun = {
  id?: string;
  created_at?: string;
  steps?: Array<{
    id?: string;
    status?: string;
    evidence?: Array<{ ref?: string }>;
    inputs?: Record<string, unknown>;
    outputs?: Record<string, unknown>;
  }>;
};

type RuntimeMemoryEventRecord = {
  eventInstanceId: string;
  eventFingerprint: string;
  eventType?: string;
  summary?: string;
  evidence?: Array<{ artifactPath?: string }>;
};

const normalizeTokens = (value: string): string[] =>
  value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3);

const uniqueSorted = (values: string[]): string[] => [...new Set(values)].sort((left, right) => left.localeCompare(right));

const scoreRelevance = (tokens: string[], content: string): number => {
  if (tokens.length === 0) {
    return 0;
  }

  const normalized = content.toLowerCase();
  return tokens.reduce((score, token) => (normalized.includes(token) ? score + 1 : score), 0);
};

const readKnowledgeCandidates = (projectRoot: string): KnowledgeCandidatesArtifact | null => {
  const artifactPath = path.join(projectRoot, KNOWLEDGE_CANDIDATES_RELATIVE_PATH);
  if (!fs.existsSync(artifactPath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(artifactPath, 'utf8')) as KnowledgeCandidatesArtifact;
};

const summarizeMemory = (input: { sources: RuntimeMemorySource[]; knowledgeHits: RuntimeKnowledgeHit[]; events: RuntimeRecentRelevantEvent[] }): string => {
  const available = input.sources.filter((source) => source.available).map((source) => source.kind);
  const sourceSummary = available.length > 0 ? available.join(', ') : 'none';
  return `Memory-aware retrieval consulted sources: ${sourceSummary}. knowledgeHits=${input.knowledgeHits.length}; recentRelevantEvents=${input.events.length}.`;
};

const readExecutionRuns = (projectRoot: string): RuntimeExecutionRun[] => {
  const runsPath = path.join(projectRoot, EXECUTION_RUNS_DIR_RELATIVE_PATH);
  if (!fs.existsSync(runsPath)) {
    return [];
  }

  return fs
    .readdirSync(runsPath)
    .filter((entry) => entry.endsWith('.json'))
    .sort((left, right) => left.localeCompare(right))
    .map((entry) => {
      const raw = fs.readFileSync(path.join(runsPath, entry), 'utf8');
      return JSON.parse(raw) as RuntimeExecutionRun;
    })
    .filter((run) => Boolean(run?.id));
};

const readRuntimeMemoryEvents = (projectRoot: string): RuntimeMemoryEventRecord[] => {
  const eventsPath = path.join(projectRoot, '.playbook', 'memory', 'events');
  if (!fs.existsSync(eventsPath)) {
    return [];
  }

  return fs
    .readdirSync(eventsPath)
    .filter((entry) => entry.endsWith('.json'))
    .sort((left, right) => left.localeCompare(right))
    .map((entry) => {
      const raw = fs.readFileSync(path.join(eventsPath, entry), 'utf8');
      return JSON.parse(raw) as RuntimeMemoryEventRecord;
    })
    .filter((event) => typeof event.eventInstanceId === 'string' && typeof event.eventFingerprint === 'string');
};

const asRecord = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' ? (value as Record<string, unknown>) : {});

const asTaskId = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const asString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => asString(entry))
    .filter((entry): entry is string => entry !== null)
    .sort((left, right) => left.localeCompare(right));
};

const asPolicyDecision = (value: unknown): string | null => {
  if (typeof value === 'string') {
    return asString(value);
  }

  const record = asRecord(value);
  return asString(record.policyState) ?? asString(record.classification) ?? asString(record.code);
};


const extractInfluencedKnowledgeIds = (value: unknown): string[] => {
  const advisoryRecord = asRecord(value);
  const outcomeLearning = asRecord(advisoryRecord.outcomeLearning);
  return asStringArray(outcomeLearning.influencedByKnowledgeIds);
};

const collectRuntimeStepRecords = (runs: RuntimeExecutionRun[]): RuntimeStepRecord[] =>
  runs.flatMap((run) => {
    const runId = run.id;
    if (!runId) {
      return [];
    }

    return (run.steps ?? [])
      .filter((step): step is NonNullable<RuntimeExecutionRun['steps']>[number] => Boolean(step && step.id))
      .filter((step) => step.status === 'passed' || step.status === 'failed' || step.status === 'skipped')
      .map((step) => {
        const inputs = asRecord(step.inputs);
        const outputs = asRecord(step.outputs);
        const taskId = asTaskId(outputs.taskId) ?? asTaskId(inputs.taskId);
        if (!taskId) {
          return null;
        }

        const evidenceRefs = (step.evidence ?? [])
          .map((evidence) => (typeof evidence.ref === 'string' ? evidence.ref.trim() : ''))
          .filter((ref) => ref.length > 0);

        return {
          runId,
          stepId: step.id ?? 'unknown-step',
          status: step.status,
          taskId,
          evidenceRefs,
          createdAt: run.created_at ?? ''
        };
      })
      .filter((entry): entry is RuntimeStepRecord => entry !== null);
  });

const buildRuntimeDryRunEvidence = (runs: RuntimeExecutionRun[]): RuntimeDryRunEvidenceSummary[] => {
  const dedupe = new Map<string, RuntimeDryRunEvidenceSummary>();

  for (const run of runs) {
    if (!run.id) {
      continue;
    }

    for (const step of run.steps ?? []) {
      if (!step?.id || (step.status !== 'passed' && step.status !== 'failed' && step.status !== 'skipped')) {
        continue;
      }

      const inputs = asRecord(step.inputs);
      const outputs = asRecord(step.outputs);
      const dryRun = inputs.dryRun === true || outputs.dryRun === true;
      if (!dryRun) {
        continue;
      }

      const taskId = asTaskId(outputs.taskId) ?? asTaskId(inputs.taskId);
      if (!taskId) {
        continue;
      }

      const sourcePlanTaskId = asString(outputs.planTaskId) ?? asString(inputs.planTaskId) ?? asString(inputs.sourcePlanTaskId) ?? null;
      const runtimeTaskId = asString(outputs.runtimeTaskId) ?? asString(inputs.runtimeTaskId) ?? null;
      const policyDecision = asPolicyDecision(outputs.policyDecision) ?? asPolicyDecision(inputs.policyDecision) ?? null;
      const evidenceRefs = (step.evidence ?? [])
        .map((evidence) => asString(evidence.ref))
        .filter((entry): entry is string => entry !== null)
        .sort((left, right) => left.localeCompare(right));
      const outputTask = asRecord(outputs.task);
      const inputTask = asRecord(inputs.task);
      const knowledgeIds = uniqueSorted([
        ...asStringArray(outputs.knowledgeIds),
        ...asStringArray(inputs.knowledgeIds),
        ...extractInfluencedKnowledgeIds(outputs.taskAdvisory),
        ...extractInfluencedKnowledgeIds(outputs.advisory),
        ...extractInfluencedKnowledgeIds(outputTask.advisory),
        ...extractInfluencedKnowledgeIds(inputs.taskAdvisory),
        ...extractInfluencedKnowledgeIds(inputs.advisory),
        ...extractInfluencedKnowledgeIds(inputTask.advisory)
      ]);

      const provenanceSummary = [
        `dry-run run=${run.id}`,
        `step=${step.id}`,
        `task=${taskId}`,
        sourcePlanTaskId ? `planTask=${sourcePlanTaskId}` : 'planTask=unknown',
        runtimeTaskId ? `runtimeTask=${runtimeTaskId}` : 'runtimeTask=unknown',
        policyDecision ? `policy=${policyDecision}` : 'policy=unknown'
      ].join('; ');

      const record: RuntimeDryRunEvidenceSummary = {
        runId: run.id,
        stepId: step.id,
        taskId,
        status: step.status,
        sourcePlanTaskId,
        runtimeTaskId,
        policyDecision,
        evidenceRefs,
        knowledgeIds,
        provenanceSummary
      };

      const key = `${record.runId}|${record.stepId}|${record.taskId}|${record.sourcePlanTaskId ?? ''}|${record.runtimeTaskId ?? ''}|${record.policyDecision ?? ''}`;
      dedupe.set(key, record);
    }
  }

  return [...dedupe.values()].sort((left, right) =>
    left.runId.localeCompare(right.runId) || left.stepId.localeCompare(right.stepId) || left.taskId.localeCompare(right.taskId)
  );
};

const buildKnowledgeReferencesByFingerprint = (projectRoot: string): Map<string, string[]> => {
  const references = new Map<string, Set<string>>();
  const collect = (fingerprint: string, id: string): void => {
    const key = fingerprint.trim();
    if (key.length === 0) {
      return;
    }

    if (!references.has(key)) {
      references.set(key, new Set<string>());
    }
    references.get(key)?.add(id);
  };

  for (const entry of lookupPromotedMemoryKnowledge(projectRoot, { includeSuperseded: true })) {
    collect(entry.fingerprint, entry.knowledgeId);
  }

  for (const entry of lookupMemoryCandidateKnowledge(projectRoot, { includeStale: true })) {
    collect(entry.fingerprint, entry.candidateId);
  }

  return new Map(
    [...references.entries()].map(([fingerprint, ids]) => [fingerprint, [...ids].sort((left, right) => left.localeCompare(right))])
  );
};

const buildRuntimeTaskMemoryProvenance = (projectRoot: string): RuntimeTaskMemoryProvenance[] => {
  const runs = readExecutionRuns(projectRoot);
  const steps = collectRuntimeStepRecords(runs);
  const events = readRuntimeMemoryEvents(projectRoot);
  const eventsByEvidence = new Map<string, RuntimeMemoryEventRecord[]>();
  const knowledgeReferencesByFingerprint = buildKnowledgeReferencesByFingerprint(projectRoot);

  for (const event of events) {
    for (const artifactPath of (event.evidence ?? []).map((evidence) => evidence.artifactPath).filter((entry): entry is string => typeof entry === 'string')) {
      const normalized = artifactPath.trim();
      if (normalized.length === 0) {
        continue;
      }

      const existing = eventsByEvidence.get(normalized) ?? [];
      existing.push(event);
      eventsByEvidence.set(normalized, existing);
    }
  }

  const dedupe = new Map<string, RuntimeTaskMemoryProvenance>();
  for (const step of steps) {
    const linkedEvents = step.evidenceRefs.flatMap((ref) => eventsByEvidence.get(ref) ?? []);
    for (const event of linkedEvents) {
      const provenance: RuntimeTaskMemoryProvenance = {
        runId: step.runId,
        taskId: step.taskId,
        stepId: step.stepId,
        status: step.status,
        memoryEventId: event.eventInstanceId,
        memoryFingerprint: event.eventFingerprint,
        memorySourcePath: `.playbook/memory/events/${event.eventInstanceId}.json`,
        knowledgeIds: knowledgeReferencesByFingerprint.get(event.eventFingerprint) ?? []
      };
      const key = `${provenance.runId}|${provenance.taskId}|${provenance.memoryEventId}`;
      dedupe.set(key, provenance);
    }
  }

  return [...dedupe.values()].sort((left, right) =>
    left.runId.localeCompare(right.runId) || left.taskId.localeCompare(right.taskId) || left.memoryEventId.localeCompare(right.memoryEventId)
  );
};

export const expandRuntimeTaskMemoryProvenance = (
  projectRoot: string,
  provenance: RuntimeTaskMemoryProvenance[]
): RuntimeTaskMemoryProvenanceExpanded[] => {
  const baseProvenance: MemoryReplayCandidateProvenance[] = provenance.map((entry) => ({
    eventId: entry.memoryEventId,
    sourcePath: entry.memorySourcePath,
    fingerprint: entry.memoryFingerprint,
    runId: entry.runId
  }));

  const expanded = expandMemoryProvenance(projectRoot, baseProvenance);

  return provenance.map((entry, index) => ({
    ...entry,
    eventKind: expanded[index]?.event?.kind ?? null,
    eventSummary: expanded[index]?.event?.outcome?.summary ?? null,
    eventCreatedAt: expanded[index]?.event?.createdAt ?? null
  }));
};

export const readRuntimeMemoryEnvelope = (projectRoot: string, options?: RuntimeMemoryOptions): RuntimeMemoryEnvelope => {
  const maxEntries = options?.limit ?? 3;
  const relevanceTokens = normalizeTokens(`${options?.target ?? ''} ${options?.question ?? ''}`.trim());

  const promotedPatterns = readPromotedPatterns(projectRoot);
  const promotedHits = promotedPatterns.promotedPatterns
    .map((pattern) => {
      const content = [pattern.id, pattern.canonicalPatternName, pattern.whyItExists, pattern.reusableEngineeringMeaning, ...pattern.examples].join(' ');
      return {
        id: pattern.id,
        source: 'promoted-pattern' as const,
        summary: pattern.whyItExists,
        confidence: pattern.confidence,
        relevance: scoreRelevance(relevanceTokens, content)
      };
    })
    .filter((entry) => relevanceTokens.length === 0 || entry.relevance > 0)
    .sort((left, right) => right.relevance - left.relevance || (right.confidence ?? 0) - (left.confidence ?? 0) || left.id.localeCompare(right.id))
    .slice(0, maxEntries)
    .map(({ relevance: _relevance, ...hit }) => hit);

  const candidates = readKnowledgeCandidates(projectRoot);
  const candidateHits = (candidates?.candidates ?? [])
    .map((candidate) => {
      const theme = candidate.theme ?? 'unknown-theme';
      const evidence = (candidate.evidence ?? []).map((entry) => entry.path).filter((value): value is string => typeof value === 'string');
      const content = [candidate.candidateId ?? '', theme, ...evidence].join(' ');
      return {
        id: candidate.candidateId ?? `candidate:${theme}`,
        source: 'knowledge-candidate' as const,
        summary: `Theme: ${theme}; evidence: ${evidence.length > 0 ? evidence.join(', ') : 'none'}`,
        relevance: scoreRelevance(relevanceTokens, content)
      };
    })
    .filter((entry) => relevanceTokens.length === 0 || entry.relevance > 0)
    .sort((left, right) => right.relevance - left.relevance || left.id.localeCompare(right.id))
    .slice(0, maxEntries)
    .map(({ relevance: _relevance, ...hit }) => hit);

  const session = readSession(projectRoot);
  const runs = readExecutionRuns(projectRoot);
  const runtimeTaskProvenance = expandRuntimeTaskMemoryProvenance(projectRoot, buildRuntimeTaskMemoryProvenance(projectRoot));
  const dryRunEvidence = buildRuntimeDryRunEvidence(runs);
  const recentRelevantEvents: RuntimeRecentRelevantEvent[] = [];
  if (session) {
    recentRelevantEvents.push({
      kind: 'session-step',
      summary: `Session step: ${session.currentStep}; active goal: ${session.activeGoal}`,
      occurredAt: session.lastUpdatedTime
    });

    for (const artifact of session.pinnedArtifacts.slice(0, maxEntries)) {
      recentRelevantEvents.push({
        kind: 'pinned-artifact',
        summary: `Pinned ${artifact.kind}: ${artifact.artifact}`,
        occurredAt: artifact.pinnedAt
      });
    }

    for (const constraint of session.constraints.slice(0, maxEntries)) {
      recentRelevantEvents.push({
        kind: 'constraint',
        summary: constraint,
        occurredAt: session.lastUpdatedTime
      });
    }

    for (const unresolved of session.unresolvedQuestions.slice(0, maxEntries)) {
      recentRelevantEvents.push({
        kind: 'unresolved-question',
        summary: unresolved,
        occurredAt: session.lastUpdatedTime
      });
    }
  }

  for (const entry of runtimeTaskProvenance.slice(0, maxEntries)) {
    recentRelevantEvents.push({
      kind: 'runtime-task',
      summary: `Run ${entry.runId} task ${entry.taskId} (${entry.status}) linked to memory event ${entry.memoryEventId}`,
      occurredAt: entry.eventCreatedAt ?? undefined
    });
  }

  for (const entry of dryRunEvidence.slice(0, maxEntries)) {
    recentRelevantEvents.push({
      kind: 'runtime-task',
      summary: `Dry-run provenance ${entry.runId}/${entry.stepId} task ${entry.taskId} policy ${entry.policyDecision ?? 'unknown'}`
    });
  }

  const knowledgeHits = [...promotedHits, ...candidateHits].slice(0, maxEntries * 2);
  const memorySources: RuntimeMemorySource[] = [
    {
      kind: 'promoted-patterns',
      artifact: '.playbook/patterns-promoted.json',
      available: promotedPatterns.promotedPatterns.length > 0,
      records: promotedPatterns.promotedPatterns.length
    },
    {
      kind: 'knowledge-candidates',
      artifact: KNOWLEDGE_CANDIDATES_RELATIVE_PATH,
      available: Boolean(candidates),
      records: candidates?.candidates?.length ?? 0
    },
    {
      kind: 'session',
      artifact: SESSION_ARTIFACT_RELATIVE_PATH,
      available: session !== null,
      records: session ? 1 + session.pinnedArtifacts.length + session.constraints.length + session.unresolvedQuestions.length : 0
    },
    {
      kind: 'runtime-runs',
      artifact: EXECUTION_RUNS_DIR_RELATIVE_PATH,
      available: runtimeTaskProvenance.length > 0,
      records: runtimeTaskProvenance.length
    }
  ];

  return {
    memorySummary: summarizeMemory({ sources: memorySources, knowledgeHits, events: recentRelevantEvents }),
    memorySources,
    knowledgeHits,
    recentRelevantEvents: recentRelevantEvents.slice(0, maxEntries * 2),
    runtimeTaskProvenance,
    dryRunEvidence
  };
};
