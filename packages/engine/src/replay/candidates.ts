import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type {
  MemoryCandidateKind,
  MemoryReplayCandidate,
  MemoryReplayIndex,
  MemoryReplayResult,
  MemoryReplaySalienceFactors,
  SessionReplayEvidenceArtifact
} from '../schema/memoryReplay.js';
import { buildSessionReplayEvidence, normalizeMemoryEvent } from '../memory/index.js';
import type { MemoryEvent, MemoryIndex, SessionReplayEvidence } from '../memory/types.js';
import { decideAdmission, readCurrentMemoryPressureBand, toAdmissionKey } from '../memory/admission.js';

const MEMORY_INDEX_RELATIVE_PATH = '.playbook/memory/index.json' as const;
export const REPLAY_CANDIDATES_RELATIVE_PATH = '.playbook/memory/replay-candidates.json' as const;
export const MEMORY_CANDIDATES_RELATIVE_PATH = '.playbook/memory/candidates.json' as const;

type ReplayEvent = {
  eventId: string;
  sourcePath: string;
  eventFingerprint: string;
  createdAt: string;
  subjectModules: string[];
  ruleIds: string[];
  severity: 'low' | 'medium' | 'high' | 'unknown';
  recurrence: number;
  blastRadius: number;
  crossModuleSpread: number;
  ownershipDocsGap: number;
  novelSuccessfulRemediationSignal: number;
};

type ReplayCluster = { key: string; events: ReplayEvent[] };

export type ReplayCandidatesArtifact = MemoryReplayResult & {
  kind: 'playbook-replay-candidates';
  candidateOnly: true;
  authority: {
    mutation: 'read-only';
    promotion: 'review-required';
  };
  replayEvidence: SessionReplayEvidenceArtifact;
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const readJson = <T>(filePath: string): T => JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
const uniqueSorted = (values: string[]): string[] => [...new Set(values.filter((value) => value.length > 0))].sort((a, b) => a.localeCompare(b));
const safeDate = (value: unknown): string => {
  if (typeof value !== 'string') return new Date(0).toISOString();
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? new Date(0).toISOString() : new Date(timestamp).toISOString();
};

const ensureMemoryIndex = (projectRoot: string): MemoryReplayIndex => {
  const fullPath = path.join(projectRoot, MEMORY_INDEX_RELATIVE_PATH);
  if (!fs.existsSync(fullPath)) throw new Error(`playbook memory replay: missing memory index at ${MEMORY_INDEX_RELATIVE_PATH}`);
  const parsed = readJson<MemoryIndex>(fullPath);
  if (!Array.isArray(parsed.events)) throw new Error(`playbook memory replay: invalid memory index format at ${MEMORY_INDEX_RELATIVE_PATH}`);
  return {
    schemaVersion: parsed.schemaVersion,
    events: parsed.events.map((entry) => ({ eventId: entry.eventId, relativePath: entry.relativePath }))
  };
};

const levelWeight: Record<ReplayEvent['severity'], number> = { low: 1, medium: 3, high: 6, unknown: 2 };
const pickSeverity = (event: MemoryEvent): ReplayEvent['severity'] => event.riskSummary.level;
const hasTruthySignal = (inputs: MemoryEvent['salienceInputs'], keys: string[]): boolean => keys.some((key) => inputs[key] === true || inputs[key] === 'true');
const getModules = (event: MemoryEvent): string[] => uniqueSorted(event.scope.modules);
const getRuleIds = (event: MemoryEvent): string[] => uniqueSorted(event.scope.ruleIds);

const toReplayEvent = (sourcePath: string, event: MemoryEvent): ReplayEvent => {
  const modules = getModules(event);
  const blastRadius = clamp(Number(event.salienceInputs.blastRadius ?? event.salienceInputs.failureCount ?? modules.length ?? 1), 1, 10);
  const crossModuleSpread = clamp(Number(event.salienceInputs.crossModuleSpread ?? event.salienceInputs.moduleSpread ?? modules.length ?? 1), 1, 10);
  const recurrence = clamp(Number(event.salienceInputs.recurrence ?? event.salienceInputs.recurrenceCount ?? 1), 1, 10);
  const unresolvedOwnership = hasTruthySignal(event.salienceInputs, ['ownershipGap', 'unresolvedOwnership']);
  const unresolvedDocs = hasTruthySignal(event.salienceInputs, ['docsGap', 'docsCoverageGap']);
  const remediationSignal = hasTruthySignal(event.salienceInputs, ['novelSuccessfulRemediation', 'successfulRemediation']) ? 1 : event.outcome.status === 'success' ? 1 : 0;

  return {
    eventId: event.eventInstanceId,
    sourcePath,
    eventFingerprint: event.eventFingerprint,
    createdAt: safeDate(event.createdAt),
    subjectModules: modules,
    ruleIds: getRuleIds(event),
    severity: pickSeverity(event),
    recurrence,
    blastRadius,
    crossModuleSpread,
    ownershipDocsGap: Number(unresolvedOwnership) + Number(unresolvedDocs),
    novelSuccessfulRemediationSignal: remediationSignal
  };
};

const readReplayEvents = (projectRoot: string, index: MemoryReplayIndex): ReplayEvent[] =>
  [...index.events]
    .sort((a, b) => `${a.eventId}:${a.relativePath}`.localeCompare(`${b.eventId}:${b.relativePath}`))
    .map((entry) => {
      const fullEventPath = path.join(projectRoot, entry.relativePath);
      if (!fs.existsSync(fullEventPath)) throw new Error(`playbook memory replay: missing event file ${entry.relativePath}`);
      return toReplayEvent(entry.relativePath, normalizeMemoryEvent(readJson<Record<string, unknown>>(fullEventPath)));
    });

const clusterEvents = (events: ReplayEvent[]): ReplayCluster[] => {
  const buckets = new Map<string, ReplayEvent[]>();
  for (const event of events) {
    buckets.set(event.eventFingerprint, [...(buckets.get(event.eventFingerprint) ?? []), event]);
  }
  return [...buckets.entries()]
    .map(([key, bucket]) => ({ key, events: [...bucket].sort((a, b) => `${a.eventId}:${a.sourcePath}`.localeCompare(`${b.eventId}:${b.sourcePath}`)) }))
    .sort((a, b) => a.key.localeCompare(b.key));
};

const scoreCluster = (cluster: ReplayCluster): MemoryReplaySalienceFactors => ({
  severity: Math.max(...cluster.events.map((event) => levelWeight[event.severity])),
  recurrenceCount: clamp(cluster.events.reduce((sum, event) => sum + event.recurrence, 0), 1, 10),
  blastRadius: clamp(Math.max(...cluster.events.map((event) => event.blastRadius)), 1, 10),
  crossModuleSpread: clamp(new Set(cluster.events.flatMap((event) => event.subjectModules)).size, 1, 10),
  ownershipDocsGap: clamp(cluster.events.reduce((sum, event) => sum + event.ownershipDocsGap, 0), 0, 10),
  novelSuccessfulRemediationSignal: cluster.events.some((event) => event.novelSuccessfulRemediationSignal > 0) ? 1 : 0
});

const computeSalienceScore = (factors: MemoryReplaySalienceFactors): number => Number((
  factors.severity * 1.4 +
  factors.recurrenceCount * 1.2 +
  factors.blastRadius * 1.1 +
  factors.crossModuleSpread * 1.0 +
  factors.ownershipDocsGap * 0.8 +
  factors.novelSuccessfulRemediationSignal * 1.3
).toFixed(3));

const chooseCandidateKind = (factors: MemoryReplaySalienceFactors): MemoryCandidateKind => {
  if (factors.ownershipDocsGap > 0) return 'open_question';
  if (factors.novelSuccessfulRemediationSignal > 0) return 'pattern';
  if (factors.severity >= 6 || factors.blastRadius >= 7) return 'failure_mode';
  if (factors.recurrenceCount >= 4 && factors.crossModuleSpread <= 2) return 'invariant';
  return 'decision';
};

const dominantValue = <T extends string>(values: T[], fallback: T): T => {
  if (values.length === 0) return fallback;
  const counts = new Map<T, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => (b[1] - a[1]) || String(a[0]).localeCompare(String(b[0])))[0]?.[0] ?? fallback;
};

const readPriorCandidates = (projectRoot: string): MemoryReplayCandidate[] => {
  const outPath = path.join(projectRoot, MEMORY_CANDIDATES_RELATIVE_PATH);
  if (!fs.existsSync(outPath)) return [];
  const prior = readJson<Partial<MemoryReplayResult>>(outPath);
  return Array.isArray(prior.candidates) ? prior.candidates : [];
};

const buildSupersession = (cluster: ReplayCluster, candidateId: string, priorCandidates: MemoryReplayCandidate[]): MemoryReplayCandidate['supersession'] => {
  const lineage = priorCandidates.filter((candidate) => candidate.fingerprint === cluster.key).map((candidate) => candidate.candidateId);
  const supersedesCandidateIds = uniqueSorted(lineage).filter((priorId) => priorId !== candidateId);
  return { evolutionOrdinal: supersedesCandidateIds.length + 1, priorCandidateIds: supersedesCandidateIds, supersedesCandidateIds };
};

const toCandidate = (cluster: ReplayCluster, priorCandidates: MemoryReplayCandidate[]): MemoryReplayCandidate => {
  const salienceFactors = scoreCluster(cluster);
  const candidateId = createHash('sha256').update(cluster.key).digest('hex').slice(0, 16);
  const module = dominantValue(cluster.events.flatMap((event) => event.subjectModules), 'unknown-module');
  const ruleId = dominantValue(cluster.events.flatMap((event) => event.ruleIds), 'unknown-rule');
  const lastSeenAt = cluster.events.reduce((latest, event) => (Date.parse(event.createdAt) > Date.parse(latest) ? event.createdAt : latest), new Date(0).toISOString());
  const kind = chooseCandidateKind(salienceFactors);
  return {
    candidateId,
    kind,
    title: `${kind.replace('_', ' ')}: ${ruleId}`,
    summary: `${cluster.events.length} replayed memory events for fingerprint ${cluster.key}.`,
    clusterKey: cluster.key,
    salienceScore: computeSalienceScore(salienceFactors),
    salienceFactors,
    fingerprint: cluster.key,
    module,
    ruleId,
    failureShape: cluster.key,
    eventCount: cluster.events.length,
    provenance: cluster.events.map((event) => ({ eventId: event.eventId, sourcePath: event.sourcePath, fingerprint: event.eventFingerprint, runId: null })),
    lastSeenAt,
    supersession: buildSupersession(cluster, candidateId, priorCandidates)
  };
};

const sortCandidates = (candidates: MemoryReplayCandidate[]): MemoryReplayCandidate[] => [...candidates].sort((left, right) => (right.salienceScore - left.salienceScore) || left.clusterKey.localeCompare(right.clusterKey));

const writeArtifact = (projectRoot: string, relativePath: string, payload: unknown): void => {
  const outPath = path.join(projectRoot, relativePath);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
};

export const buildReplayCandidatesArtifact = (projectRoot: string): ReplayCandidatesArtifact => {
  const index = ensureMemoryIndex(projectRoot);
  const events = readReplayEvents(projectRoot, index);
  const clusters = clusterEvents(events);
  const priorCandidates = readPriorCandidates(projectRoot);
  const candidates = sortCandidates(clusters.map((cluster) => toCandidate(cluster, priorCandidates)));
  const replayEvidence: SessionReplayEvidence = buildSessionReplayEvidence(events.map((event) => ({
    eventId: event.eventId,
    sourcePath: event.sourcePath,
    fingerprint: event.eventFingerprint,
    runId: null,
    scope: { modules: event.subjectModules, ruleIds: event.ruleIds }
  })));

  return {
    schemaVersion: '1.0',
    kind: 'playbook-replay-candidates',
    command: 'memory-replay',
    sourceIndex: MEMORY_INDEX_RELATIVE_PATH,
    generatedAt: new Date(0).toISOString(),
    candidateOnly: true,
    authority: {
      mutation: 'read-only',
      promotion: 'review-required'
    },
    totalEvents: events.length,
    clustersEvaluated: clusters.length,
    candidates,
    replayEvidence: replayEvidence as SessionReplayEvidenceArtifact
  };
};

export const replayMemoryToCandidates = (projectRoot: string): ReplayCandidatesArtifact => {
  const artifact = buildReplayCandidatesArtifact(projectRoot);
  decideAdmission({
    band: readCurrentMemoryPressureBand(projectRoot),
    isCanonical: false,
    isReviewCritical: true,
    isHighSignal: true,
    isLowSignal: false,
    duplicateCount: 0,
    admissionKey: toAdmissionKey({ channel: 'replay-candidates', kind: artifact.kind, payload: { totalEvents: artifact.totalEvents, candidates: artifact.candidates.length } })
  });
  writeArtifact(projectRoot, REPLAY_CANDIDATES_RELATIVE_PATH, artifact);
  writeArtifact(projectRoot, MEMORY_CANDIDATES_RELATIVE_PATH, artifact);
  return artifact;
};
