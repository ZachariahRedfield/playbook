import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { MemoryEvent, MemoryEventInput, MemoryIndex } from './types.js';
import { MEMORY_SCHEMA_VERSION } from './types.js';

const MEMORY_DIR = ['.playbook', 'memory'];
const EVENTS_DIR = [...MEMORY_DIR, 'events'];

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
      if (normalizedValue !== undefined) {
        normalized[key] = normalizedValue;
      }
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

const emptyIndex = (): MemoryIndex => ({
  schemaVersion: MEMORY_SCHEMA_VERSION,
  generatedAt: new Date(0).toISOString(),
  byModule: {},
  byRule: {},
  byFingerprint: {}
});

const readIndex = (repoRoot: string): MemoryIndex => {
  const indexPath = path.join(repoRoot, ...MEMORY_DIR, 'index.json');
  if (!fs.existsSync(indexPath)) {
    return emptyIndex();
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(indexPath, 'utf8')) as MemoryIndex;
    if (parsed && parsed.schemaVersion === MEMORY_SCHEMA_VERSION && parsed.byModule && parsed.byRule && parsed.byFingerprint) {
      return parsed;
    }
    return emptyIndex();
  } catch {
    return emptyIndex();
  }
};

const toEventFingerprint = (input: MemoryEventInput): string =>
  stableHash({
    kind: input.kind,
    sources: [...input.sources].sort((left, right) => `${left.type}:${left.reference}`.localeCompare(`${right.type}:${right.reference}`)),
    subjectModules: uniqueSorted(input.subjectModules),
    ruleIds: uniqueSorted(input.ruleIds),
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

const buildEvent = (repoRoot: string, input: MemoryEventInput): MemoryEvent => {
  const createdAt = new Date().toISOString();
  const eventFingerprint = toEventFingerprint(input);

  return {
    schemaVersion: MEMORY_SCHEMA_VERSION,
    kind: input.kind,
    eventInstanceId: `${input.kind}-${randomUUID()}`,
    eventFingerprint,
    createdAt,
    repoRevision: input.repoRevision ?? resolveRepoRevision(repoRoot),
    sources: [...input.sources].sort((left, right) => `${left.type}:${left.reference}`.localeCompare(`${right.type}:${right.reference}`)),
    subjectModules: uniqueSorted(input.subjectModules),
    ruleIds: uniqueSorted(input.ruleIds),
    riskSummary: {
      level: input.riskSummary.level,
      ...(typeof input.riskSummary.score === 'number' ? { score: input.riskSummary.score } : {}),
      signals: uniqueSorted(input.riskSummary.signals)
    },
    outcome: {
      status: input.outcome.status,
      summary: input.outcome.summary,
      ...(input.outcome.metrics ? { metrics: canonicalize(input.outcome.metrics) as Record<string, number> } : {})
    },
    salienceInputs: canonicalize(input.salienceInputs) as MemoryEvent['salienceInputs']
  };
};

const updateMemoryIndex = (repoRoot: string, event: MemoryEvent): void => {
  const current = readIndex(repoRoot);
  const eventRef = path.posix.join('events', `${event.eventInstanceId}.json`);

  for (const moduleName of event.subjectModules) {
    current.byModule[moduleName] = uniqueSorted([...(current.byModule[moduleName] ?? []), eventRef]);
  }

  for (const ruleId of event.ruleIds) {
    current.byRule[ruleId] = uniqueSorted([...(current.byRule[ruleId] ?? []), eventRef]);
  }

  current.byFingerprint[event.eventFingerprint] = uniqueSorted([...(current.byFingerprint[event.eventFingerprint] ?? []), eventRef]);
  current.generatedAt = event.createdAt;

  const byModule = Object.fromEntries(Object.entries(current.byModule).sort(([left], [right]) => left.localeCompare(right)));
  const byRule = Object.fromEntries(Object.entries(current.byRule).sort(([left], [right]) => left.localeCompare(right)));
  const byFingerprint = Object.fromEntries(Object.entries(current.byFingerprint).sort(([left], [right]) => left.localeCompare(right)));

  writeDeterministicJson(path.join(repoRoot, ...MEMORY_DIR, 'index.json'), {
    schemaVersion: MEMORY_SCHEMA_VERSION,
    generatedAt: current.generatedAt,
    byModule,
    byRule,
    byFingerprint
  });
};

export const captureMemoryEvent = (repoRoot: string, input: MemoryEventInput): MemoryEvent => {
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

export const computeMemoryEventFingerprint = toEventFingerprint;

export type { MemoryEvent, MemoryEventInput, MemoryIndex } from './types.js';

export {
  recordRouteDecision,
  recordLaneTransition,
  recordWorkerAssignment,
  recordLaneOutcome,
  recordImprovementCandidate,
  safeRecordRepositoryEvent,
  REPOSITORY_EVENTS_SCHEMA_VERSION
} from './events.js';

export type {
  RepositoryEvent,
  RepositoryEventIndex,
  RepositoryEventType,
  RouteDecisionEvent,
  LaneTransitionEvent,
  WorkerAssignmentEvent,
  LaneOutcomeEvent,
  ImprovementCandidateEvent
} from './events.js';
