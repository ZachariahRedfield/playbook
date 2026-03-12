import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type {
  MemoryCandidateKind,
  MemoryReplayCandidate,
  MemoryReplayEventReference,
  MemoryReplayIndex,
  MemoryReplayResult,
  MemoryReplaySalienceFactors
} from '../schema/memoryReplay.js';

const MEMORY_INDEX_RELATIVE_PATH = '.playbook/memory/index.json' as const;
export const MEMORY_CANDIDATES_RELATIVE_PATH = '.playbook/memory/candidates.json' as const;

type ReplayEvent = {
  eventId: string;
  sourcePath: string;
  runId: string | null;
  fingerprint: string;
  module: string;
  ruleId: string;
  failureShape: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  recurrenceCount: number;
  riskScore: number;
  modules: string[];
  ownershipGap: boolean;
  docsGap: boolean;
  successfulRemediation: boolean;
  remediationShape: string | null;
  createdAt: string;
};

type ReplayCluster = {
  key: string;
  events: ReplayEvent[];
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const normalizeInt = (value: unknown, fallback: number): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  return fallback;
};

const normalizeNumber = (value: unknown, fallback: number): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return fallback;
};

const normalizeSeverity = (value: unknown): ReplayEvent['severity'] => {
  if (value === 'info' || value === 'warning' || value === 'error' || value === 'critical') {
    return value;
  }
  return 'warning';
};

const stableString = (value: unknown, fallback: string): string => {
  if (typeof value !== 'string') {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
};

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry.length > 0)
    .sort((a, b) => a.localeCompare(b));
};

const severityWeight: Record<ReplayEvent['severity'], number> = {
  info: 0,
  warning: 2,
  error: 4,
  critical: 6
};

const ensureMemoryIndex = (projectRoot: string): MemoryReplayIndex => {
  const fullPath = path.join(projectRoot, MEMORY_INDEX_RELATIVE_PATH);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`playbook memory replay: missing memory index at ${MEMORY_INDEX_RELATIVE_PATH}`);
  }

  const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8')) as Partial<MemoryReplayIndex> & {
    entries?: MemoryReplayEventReference[];
  };

  const events = parsed.events ?? parsed.entries;
  if (!Array.isArray(events)) {
    throw new Error(`playbook memory replay: invalid memory index format at ${MEMORY_INDEX_RELATIVE_PATH}`);
  }

  return {
    schemaVersion: parsed.schemaVersion,
    events
  };
};

const parseReplayEvent = (eventId: string, sourcePath: string, raw: Record<string, unknown>): ReplayEvent => {
  const eventRuleId = stableString(raw.ruleId ?? (raw.rule as Record<string, unknown> | undefined)?.id, 'unknown-rule');
  const eventModule = stableString(raw.module ?? (raw.scope as Record<string, unknown> | undefined)?.module, 'unknown-module');
  const eventFailureShape = stableString(raw.failureShape ?? (raw.failure as Record<string, unknown> | undefined)?.shape, 'unknown-shape');
  const runId = typeof raw.runId === 'string' ? raw.runId : typeof raw.cycleId === 'string' ? raw.cycleId : null;
  const modules = toStringArray(raw.modules ?? (raw.scope as Record<string, unknown> | undefined)?.modules);
  const remediation = raw.remediation as Record<string, unknown> | undefined;

  const fingerprint = stableString(
    raw.fingerprint,
    createHash('sha256').update(JSON.stringify({ eventRuleId, eventModule, eventFailureShape })).digest('hex').slice(0, 16)
  );

  const successfulRemediation =
    raw.successfulRemediation === true || remediation?.success === true || remediation?.status === 'success';

  return {
    eventId,
    sourcePath,
    runId,
    fingerprint,
    module: eventModule,
    ruleId: eventRuleId,
    failureShape: eventFailureShape,
    severity: normalizeSeverity(raw.severity),
    recurrenceCount: Math.max(1, normalizeInt(raw.recurrenceCount ?? (raw.recurrence as Record<string, unknown> | undefined)?.count, 1)),
    riskScore: clamp(normalizeNumber(raw.riskScore, 0), 0, 10),
    modules,
    ownershipGap: raw.ownershipGap === true || (raw.gaps as Record<string, unknown> | undefined)?.ownership === true,
    docsGap: raw.docsGap === true || (raw.gaps as Record<string, unknown> | undefined)?.docs === true,
    successfulRemediation,
    remediationShape: typeof remediation?.shape === 'string' ? remediation.shape : null,
    createdAt: typeof raw.createdAt === 'string' && !Number.isNaN(Date.parse(raw.createdAt)) ? new Date(Date.parse(raw.createdAt)).toISOString() : new Date(0).toISOString()
  };
};

const readReplayEvents = (projectRoot: string, index: MemoryReplayIndex): ReplayEvent[] =>
  [...index.events]
    .sort((a, b) => `${a.eventId}:${a.relativePath}`.localeCompare(`${b.eventId}:${b.relativePath}`))
    .map((entry) => {
      const fullEventPath = path.join(projectRoot, entry.relativePath);
      if (!fs.existsSync(fullEventPath)) {
        throw new Error(`playbook memory replay: missing event file ${entry.relativePath}`);
      }
      const raw = JSON.parse(fs.readFileSync(fullEventPath, 'utf8')) as Record<string, unknown>;
      return parseReplayEvent(entry.eventId, entry.relativePath, raw);
    });

const buildClusterKey = (event: ReplayEvent): string =>
  [event.fingerprint, event.module, event.ruleId, event.failureShape].join('|');

const scoreCluster = (cluster: ReplayCluster, remediationShapeSeen: Map<string, number>): MemoryReplaySalienceFactors => {
  const severity = Math.max(...cluster.events.map((event) => severityWeight[event.severity]));
  const recurrenceCount = clamp(cluster.events.reduce((acc, event) => acc + event.recurrenceCount, 0), 1, 10);

  const crossModuleBreadth = clamp(
    new Set(cluster.events.flatMap((event) => [event.module, ...event.modules])).size,
    1,
    10
  );

  const riskScore = clamp(Math.max(...cluster.events.map((event) => event.riskScore)), 0, 10);
  const persistenceAcrossRuns = clamp(new Set(cluster.events.map((event) => event.runId).filter((value): value is string => value !== null)).size, 1, 10);

  const ownershipDocsGap = cluster.events.some((event) => event.ownershipGap || event.docsGap)
    ? cluster.events.reduce((score, event) => score + Number(event.ownershipGap) + Number(event.docsGap), 0)
    : 0;

  const novelSuccessfulRemediationShape = cluster.events.some((event) => {
    if (!event.successfulRemediation || !event.remediationShape) {
      return false;
    }
    return (remediationShapeSeen.get(event.remediationShape) ?? 0) === 1;
  })
    ? 1
    : 0;

  return {
    severity,
    recurrenceCount,
    crossModuleBreadth,
    riskScore,
    persistenceAcrossRuns,
    ownershipDocsGap,
    novelSuccessfulRemediationShape
  };
};

const computeSalienceScore = (factors: MemoryReplaySalienceFactors): number => {
  const rawScore =
    factors.severity * 1.2 +
    factors.recurrenceCount * 1.1 +
    factors.crossModuleBreadth * 0.8 +
    factors.riskScore * 1.4 +
    factors.persistenceAcrossRuns * 0.9 +
    factors.ownershipDocsGap * 0.7 +
    factors.novelSuccessfulRemediationShape * 1.3;

  return Number(rawScore.toFixed(3));
};

const chooseCandidateKind = (cluster: ReplayCluster, factors: MemoryReplaySalienceFactors): MemoryCandidateKind => {
  if (factors.ownershipDocsGap > 0) {
    return 'open_question';
  }
  if (factors.novelSuccessfulRemediationShape > 0) {
    return 'pattern';
  }
  if (factors.severity >= 4 || factors.riskScore >= 7) {
    return 'failure_mode';
  }
  if (factors.persistenceAcrossRuns >= 3 && cluster.events.every((event) => event.successfulRemediation)) {
    return 'invariant';
  }
  return 'decision';
};

const clusterEvents = (events: ReplayEvent[]): ReplayCluster[] => {
  const buckets = new Map<string, ReplayEvent[]>();

  for (const event of events) {
    const key = buildClusterKey(event);
    const existing = buckets.get(key) ?? [];
    existing.push(event);
    buckets.set(key, existing);
  }

  return [...buckets.entries()]
    .map(([key, bucket]) => ({ key, events: bucket }))
    .sort((a, b) => a.key.localeCompare(b.key));
};

const remediationShapeStats = (events: ReplayEvent[]): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const event of events) {
    if (!event.successfulRemediation || !event.remediationShape) {
      continue;
    }
    counts.set(event.remediationShape, (counts.get(event.remediationShape) ?? 0) + 1);
  }
  return counts;
};

const toCandidate = (cluster: ReplayCluster, factors: MemoryReplaySalienceFactors): MemoryReplayCandidate => {
  const [fingerprint, module, ruleId, failureShape] = cluster.key.split('|');
  const kind = chooseCandidateKind(cluster, factors);
  const salienceScore = computeSalienceScore(factors);

  const sortedEvents = [...cluster.events].sort((a, b) => `${a.eventId}:${a.sourcePath}`.localeCompare(`${b.eventId}:${b.sourcePath}`));
  const lastSeenAt = sortedEvents.reduce((latest, event) => (Date.parse(event.createdAt) > Date.parse(latest) ? event.createdAt : latest), new Date(0).toISOString());

  return {
    candidateId: createHash('sha256').update(cluster.key).digest('hex').slice(0, 16),
    kind,
    title: `${kind.replace('_', ' ')}: ${ruleId}`,
    summary: `${cluster.events.length} related memory events clustered by fingerprint/module/rule/failure shape.`,
    clusterKey: cluster.key,
    salienceScore,
    salienceFactors: factors,
    fingerprint,
    module,
    ruleId,
    failureShape,
    eventCount: cluster.events.length,
    provenance: sortedEvents
      .map((event) => ({
        eventId: event.eventId,
        sourcePath: event.sourcePath,
        fingerprint: event.fingerprint,
        runId: event.runId
      })),
    lastSeenAt
  };
};

const sortCandidates = (candidates: MemoryReplayCandidate[]): MemoryReplayCandidate[] =>
  [...candidates].sort((a, b) => {
    if (b.salienceScore !== a.salienceScore) {
      return b.salienceScore - a.salienceScore;
    }
    return a.clusterKey.localeCompare(b.clusterKey);
  });

export const replayMemoryToCandidates = (projectRoot: string): MemoryReplayResult => {
  const index = ensureMemoryIndex(projectRoot);
  const events = readReplayEvents(projectRoot, index);
  const clusters = clusterEvents(events);
  const remediationShapeSeen = remediationShapeStats(events);

  const candidates = sortCandidates(
    clusters.map((cluster) => {
      const factors = scoreCluster(cluster, remediationShapeSeen);
      return toCandidate(cluster, factors);
    })
  );

  const artifact: MemoryReplayResult = {
    schemaVersion: '1.0',
    command: 'memory-replay',
    sourceIndex: MEMORY_INDEX_RELATIVE_PATH,
    generatedAt: new Date(0).toISOString(),
    totalEvents: events.length,
    clustersEvaluated: clusters.length,
    candidates
  };

  const outPath = path.join(projectRoot, MEMORY_CANDIDATES_RELATIVE_PATH);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');

  return artifact;
};
