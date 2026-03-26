import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { MemoryEvent, MemoryEventInput, MemoryIndex, MemoryIndexEntry, MemoryScope, SessionReplayEvidence, SessionReplayEvidenceInput } from './types.js';
import { MEMORY_SCHEMA_VERSION, SESSION_REPLAY_EVIDENCE_KIND, TEMPORAL_MEMORY_INDEX_KIND } from './types.js';
import { decideAdmission, isLowSignalMemoryInput, readCurrentMemoryPressureBand, toAdmissionKey, writeAdmissionRollup } from './admission.js';

const MEMORY_DIR = ['.playbook', 'memory'] as const;
const EVENTS_DIR = [...MEMORY_DIR, 'events'] as const;
const INDEX_RELATIVE_PATH = '.playbook/memory/index.json' as const;

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalize(entry));
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort((left, right) => left.localeCompare(right));
    const normalized: Record<string, unknown> = {};
    for (const key of keys) {
      const normalizedValue = canonicalize(record[key]);
      if (normalizedValue !== undefined) normalized[key] = normalizedValue;
    }
    return normalized;
  }
  if (typeof value === 'undefined' || typeof value === 'function' || typeof value === 'symbol') {
    return undefined;
  }
  return value;
};

const deterministicStringify = (value: unknown): string => `${JSON.stringify(canonicalize(value), null, 2)}\n`;
const uniqueSorted = (values: string[]): string[] => [...new Set(values.filter((value) => value.trim().length > 0))].sort((a, b) => a.localeCompare(b));
const stableHash = (value: unknown, size = 32): string => createHash('sha256').update(JSON.stringify(canonicalize(value)), 'utf8').digest('hex').slice(0, size);

const resolveRepoRevision = (repoRoot: string): string => {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return 'unknown';
  }
};

const writeDeterministicJson = (filePath: string, payload: unknown): void => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, deterministicStringify(payload), 'utf8');
};

const toStringArray = (value: unknown): string[] => Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];

export const normalizeScope = (scope: MemoryEventInput['scope'] | MemoryScope | null | undefined, fallback?: Pick<MemoryEventInput, 'subjectModules' | 'ruleIds'> | Record<string, unknown>): MemoryScope => ({
  modules: uniqueSorted(Array.isArray(scope?.modules) ? scope.modules : toStringArray(fallback?.subjectModules)),
  ruleIds: uniqueSorted(Array.isArray(scope?.ruleIds) ? scope.ruleIds : toStringArray(fallback?.ruleIds))
});

const normalizeSources = (value: unknown): MemoryEvent['sources'] =>
  Array.isArray(value)
    ? value
        .filter((entry): entry is { type: string; reference: string } => Boolean(entry) && typeof entry === 'object' && typeof (entry as { type?: unknown }).type === 'string' && typeof (entry as { reference?: unknown }).reference === 'string')
        .sort((left, right) => `${left.type}:${left.reference}`.localeCompare(`${right.type}:${right.reference}`))
    : [];

export const normalizeMemoryEvent = (value: MemoryEvent | (Partial<MemoryEvent> & Record<string, unknown>)): MemoryEvent => {
  const candidate = (value ?? {}) as Record<string, unknown>;
  const eventInstanceId =
    (typeof candidate.eventInstanceId === 'string' && candidate.eventInstanceId.trim().length > 0
      ? candidate.eventInstanceId.trim()
      : typeof candidate.eventId === 'string' && candidate.eventId.trim().length > 0
        ? candidate.eventId.trim()
        : `memory-event-${randomUUID()}`);
  const scope = normalizeScope(candidate.scope as MemoryScope | Partial<MemoryScope> | null | undefined, candidate);
  const riskSummaryRecord = candidate.riskSummary && typeof candidate.riskSummary === 'object' ? candidate.riskSummary as Record<string, unknown> : {};
  const outcomeRecord = candidate.outcome && typeof candidate.outcome === 'object' ? candidate.outcome as Record<string, unknown> : {};
  const metrics = outcomeRecord.metrics && typeof outcomeRecord.metrics === 'object' ? canonicalize(outcomeRecord.metrics) as Record<string, number> : undefined;

  return {
    schemaVersion: MEMORY_SCHEMA_VERSION,
    kind: (typeof candidate.kind === 'string' ? candidate.kind : 'failure_ingest') as MemoryEvent['kind'],
    eventId: eventInstanceId,
    eventInstanceId,
    eventFingerprint: typeof candidate.eventFingerprint === 'string' ? candidate.eventFingerprint : '',
    createdAt: typeof candidate.createdAt === 'string' ? candidate.createdAt : new Date(0).toISOString(),
    repoRevision: typeof candidate.repoRevision === 'string' ? candidate.repoRevision : 'unknown',
    scope,
    subjectModules: scope.modules,
    ruleIds: scope.ruleIds,
    sources: normalizeSources(candidate.sources),
    riskSummary: {
      level: (typeof riskSummaryRecord.level === 'string' ? riskSummaryRecord.level : 'unknown') as MemoryEvent['riskSummary']['level'],
      ...(typeof riskSummaryRecord.score === 'number' ? { score: riskSummaryRecord.score } : {}),
      signals: uniqueSorted(toStringArray(riskSummaryRecord.signals))
    },
    outcome: {
      status: (typeof outcomeRecord.status === 'string' ? outcomeRecord.status : 'skipped') as MemoryEvent['outcome']['status'],
      summary: typeof outcomeRecord.summary === 'string' ? outcomeRecord.summary : (typeof candidate.summary === 'string' ? candidate.summary : 'legacy memory event'),
      ...(metrics ? { metrics } : {})
    },
    salienceInputs: candidate.salienceInputs && typeof candidate.salienceInputs === 'object' ? canonicalize(candidate.salienceInputs) as MemoryEvent['salienceInputs'] : {}
  };
};

const emptyIndex = (): MemoryIndex => ({
  schemaVersion: MEMORY_SCHEMA_VERSION,
  kind: TEMPORAL_MEMORY_INDEX_KIND,
  generatedAt: new Date(0).toISOString(),
  events: [],
  byModule: {},
  byRule: {},
  byFingerprint: {}
});

const readIndex = (repoRoot: string): MemoryIndex => {
  const indexPath = path.join(repoRoot, INDEX_RELATIVE_PATH);
  if (!fs.existsSync(indexPath)) return emptyIndex();
  try {
    const parsed = JSON.parse(fs.readFileSync(indexPath, 'utf8')) as Partial<MemoryIndex>;
    return {
      ...emptyIndex(),
      ...(parsed.kind === TEMPORAL_MEMORY_INDEX_KIND ? parsed : {}),
      events: Array.isArray(parsed.events) ? parsed.events : [],
      byModule: parsed.byModule ?? {},
      byRule: parsed.byRule ?? {},
      byFingerprint: parsed.byFingerprint ?? {}
    };
  } catch {
    return emptyIndex();
  }
};

const toEventFingerprint = (input: MemoryEventInput): string =>
  stableHash({
    kind: input.kind,
    sources: normalizeSources(input.sources),
    scope: normalizeScope(input.scope, input),
    riskSummary: {
      level: input.riskSummary.level,
      score: input.riskSummary.score ?? null,
      signals: uniqueSorted(input.riskSummary.signals)
    },
    outcome: {
      status: input.outcome.status,
      summary: input.outcome.summary,
      metrics: input.outcome.metrics ? canonicalize(input.outcome.metrics) : undefined
    },
    salienceInputs: canonicalize(input.salienceInputs)
  });

const buildEvent = (repoRoot: string, input: MemoryEventInput): MemoryEvent =>
  normalizeMemoryEvent({
    ...input,
    schemaVersion: MEMORY_SCHEMA_VERSION,
    eventInstanceId: `${input.kind}-${randomUUID()}`,
    eventFingerprint: toEventFingerprint(input),
    createdAt: new Date().toISOString(),
    repoRevision: input.repoRevision ?? resolveRepoRevision(repoRoot),
    scope: normalizeScope(input.scope, input),
    subjectModules: normalizeScope(input.scope, input).modules,
    ruleIds: normalizeScope(input.scope, input).ruleIds,
    sources: normalizeSources(input.sources)
  });

const toIndexEntry = (event: MemoryEvent): MemoryIndexEntry => ({
  eventId: event.eventInstanceId,
  relativePath: `.playbook/memory/events/${event.eventInstanceId}.json`,
  scope: event.scope,
  fingerprint: event.eventFingerprint,
  createdAt: event.createdAt,
  memoryKind: event.kind
});

const rebuildLookups = (entries: MemoryIndexEntry[]) => {
  const byModule: Record<string, string[]> = {};
  const byRule: Record<string, string[]> = {};
  const byFingerprint: Record<string, string[]> = {};

  for (const entry of entries) {
    for (const moduleName of entry.scope.modules) {
      byModule[moduleName] = uniqueSorted([...(byModule[moduleName] ?? []), entry.relativePath]);
    }
    for (const ruleId of entry.scope.ruleIds) {
      byRule[ruleId] = uniqueSorted([...(byRule[ruleId] ?? []), entry.relativePath]);
    }
    byFingerprint[entry.fingerprint] = uniqueSorted([...(byFingerprint[entry.fingerprint] ?? []), entry.relativePath]);
  }

  return {
    byModule: Object.fromEntries(Object.entries(byModule).sort(([left], [right]) => left.localeCompare(right))),
    byRule: Object.fromEntries(Object.entries(byRule).sort(([left], [right]) => left.localeCompare(right))),
    byFingerprint: Object.fromEntries(Object.entries(byFingerprint).sort(([left], [right]) => left.localeCompare(right)))
  };
};

const writeMemoryIndex = (repoRoot: string, index: MemoryIndex): void => {
  const events = [...index.events].sort((left, right) => `${left.relativePath}:${left.eventId}`.localeCompare(`${right.relativePath}:${right.eventId}`));
  const lookups = rebuildLookups(events);
  writeDeterministicJson(path.join(repoRoot, INDEX_RELATIVE_PATH), {
    schemaVersion: MEMORY_SCHEMA_VERSION,
    kind: TEMPORAL_MEMORY_INDEX_KIND,
    generatedAt: index.generatedAt,
    events,
    ...lookups
  });
};

const updateMemoryIndex = (repoRoot: string, event: MemoryEvent): void => {
  const current = readIndex(repoRoot);
  const eventEntry = toIndexEntry(event);
  const withoutExisting = current.events.filter((entry) => entry.relativePath !== eventEntry.relativePath);
  writeMemoryIndex(repoRoot, { ...current, generatedAt: event.createdAt, events: [...withoutExisting, eventEntry] });
};

export const captureMemoryEvent = (repoRoot: string, input: MemoryEventInput): MemoryEvent => {
  const current = readIndex(repoRoot);
  const band = readCurrentMemoryPressureBand(repoRoot);
  const admissionKey = toAdmissionKey({
    channel: 'temporal-memory-event',
    kind: input.kind,
    subject: (Array.isArray(input.scope?.ruleIds) ? input.scope?.ruleIds.join(',') : '') || (Array.isArray(input.scope?.modules) ? input.scope?.modules.join(',') : ''),
    payload: {
      scope: normalizeScope(input.scope, input),
      riskSummary: input.riskSummary,
      outcome: input.outcome,
      salienceInputs: input.salienceInputs
    }
  });
  const duplicateCount = current.events.filter((entry) => entry.fingerprint === toEventFingerprint(input)).length;
  const lowSignal = isLowSignalMemoryInput({
    riskLevel: input.riskSummary.level,
    outcomeStatus: input.outcome.status,
    signalCount: Object.keys(input.salienceInputs ?? {}).length,
    hasModules: normalizeScope(input.scope, input).modules.length > 0,
    hasRuleIds: normalizeScope(input.scope, input).ruleIds.length > 0
  });
  const highSignal = !lowSignal || input.riskSummary.level === 'high' || input.outcome.status === 'failure';
  const decision = decideAdmission({
    band,
    isCanonical: false,
    isReviewCritical: false,
    isHighSignal: highSignal,
    isLowSignal: lowSignal,
    duplicateCount,
    admissionKey
  });
  if (decision.action === 'dedupe' || decision.action === 'skip') {
    return normalizeMemoryEvent({
      ...buildEvent(repoRoot, input),
      kind: 'failure_ingest',
      outcome: { status: 'skipped', summary: `memory admission ${decision.action}: ${decision.reason}` }
    });
  }
  if (decision.action === 'rollup') {
    writeAdmissionRollup({
      repoRoot,
      channel: 'temporal-memory',
      rollupKey: decision.rollupKey,
      occurredAt: new Date().toISOString(),
      sample: {
        kind: input.kind,
        scope: normalizeScope(input.scope, input),
        riskSummary: input.riskSummary,
        outcome: input.outcome
      }
    });
    return normalizeMemoryEvent({
      ...buildEvent(repoRoot, input),
      kind: 'failure_ingest',
      outcome: { status: 'skipped', summary: `memory admission rollup: ${decision.reason}` }
    });
  }
  const event = buildEvent(repoRoot, input);
  writeDeterministicJson(path.join(repoRoot, ...EVENTS_DIR, `${event.eventInstanceId}.json`), event);
  updateMemoryIndex(repoRoot, event);
  return event;
};

export const captureMemoryEventSafe = (repoRoot: string, input: MemoryEventInput): void => {
  try {
    captureMemoryEvent(repoRoot, input);
  } catch {
    // Memory capture is best effort and must not block primary command execution.
  }
};

export const buildSessionReplayEvidence = (entries: SessionReplayEvidenceInput[]): SessionReplayEvidence => ({
  schemaVersion: MEMORY_SCHEMA_VERSION,
  kind: SESSION_REPLAY_EVIDENCE_KIND,
  generatedAt: new Date(0).toISOString(),
  memoryIndex: { path: INDEX_RELATIVE_PATH, eventCount: entries.length },
  replayInputs: [...entries].sort((left, right) => `${left.sourcePath}:${left.eventId}`.localeCompare(`${right.sourcePath}:${right.eventId}`)),
  authority: { mutation: 'read-only', promotion: 'review-required' }
});

export const computeMemoryEventFingerprint = toEventFingerprint;

export {
  MEMORY_PRESSURE_PLAN_RELATIVE_PATH,
  MEMORY_PRESSURE_FOLLOWUPS_RELATIVE_PATH,
  MEMORY_PRESSURE_STATUS_RELATIVE_PATH,
  MEMORY_PRESSURE_STATUS_LEGACY_RELATIVE_PATH,
  computeMemoryPressureScore,
  resolveMemoryPressureBand,
  classifyMemoryArtifact,
  recommendedActionsForBand,
  buildMemoryPressureStatusArtifact,
  writeMemoryPressureStatusArtifact,
  buildMemoryPressurePlanArtifact,
  writeMemoryPressurePlanArtifact,
  buildMemoryPressureFollowupsArtifact,
  writeMemoryPressureFollowupsArtifact,
  evaluateMemoryPressurePolicy
} from './pressurePolicy.js';
export type {
  MemoryPressureAction,
  MemoryPressureBand,
  MemoryClass,
  MemoryPressureStatusArtifact,
  MemoryPressurePlanBand,
  MemoryPressurePlanStepAction,
  MemoryPressurePlanStep,
  MemoryPressurePlanArtifact,
  MemoryPressureFollowupAction,
  MemoryPressureFollowupPriority,
  MemoryPressureFollowupRow,
  MemoryPressureFollowupsArtifact
} from './pressurePolicy.js';

export type { MemoryEvent, MemoryEventInput, MemoryIndex, MemoryIndexEntry, MemoryScope, SessionReplayEvidence, SessionReplayEvidenceInput } from './types.js';

export {
  recordRouteDecision,
  recordLaneTransition,
  recordWorkerAssignment,
  recordLaneOutcome,
  recordExecutionOutcome,
  recordImprovementCandidate,
  recordImprovementSignal,
  recordCommandExecution,
  recordCommandQuality,
  queryRepositoryEvents,
  listRecentRouteDecisions,
  listLaneTransitionsForRun,
  listWorkerAssignmentsForRun,
  listImprovementSignalsForArtifact,
  readRepositoryEvents,
  safeRecordRepositoryEvent,
  REPOSITORY_EVENTS_SCHEMA_VERSION
} from './events.js';

export type {
  RepositoryEvent,
  RepositoryEventIndex,
  RepositoryEventType,
  RepositoryEventBase,
  RepositoryEventRelatedArtifact,
  RouteDecisionEvent,
  LaneTransitionEvent,
  WorkerAssignmentEvent,
  ExecutionOutcomeEvent,
  ImprovementSignalEvent,
  CommandExecutionEvent,
  CommandQualityEvent,
  RepositoryEventLookupOptions,
  RepositoryEventQueryOptions
} from './events.js';
