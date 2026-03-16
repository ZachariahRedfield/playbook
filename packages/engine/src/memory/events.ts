import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const MEMORY_ROOT = ['.playbook', 'memory'] as const;
const EVENTS_DIR = [...MEMORY_ROOT, 'events'] as const;
const INDEX_PATH = [...MEMORY_ROOT, 'index.json'] as const;

export const REPOSITORY_EVENTS_SCHEMA_VERSION = '1.1' as const;

export type RepositoryEventType = 'route_decision' | 'lane_transition' | 'worker_assignment' | 'execution_outcome' | 'improvement_signal';
export type RepositoryMemorySubsystem = 'repository_memory' | 'knowledge_lifecycle';

export type RepositoryEventSubject = {
  kind: string;
  id: string;
};

export type RepositoryEventBase = {
  schemaVersion: typeof REPOSITORY_EVENTS_SCHEMA_VERSION;
  event_type: RepositoryEventType;
  event_id: string;
  timestamp: string;
  subsystem: RepositoryMemorySubsystem;
  subject: RepositoryEventSubject;
  related_artifacts: string[];
  payload: Record<string, unknown>;
  run_id?: string;
};

export type RouteDecisionEvent = RepositoryEventBase & {
  event_type: 'route_decision';
  subsystem: 'repository_memory';
  payload: {
    task_text: string;
    task_family: string;
    route_id: string;
    confidence: number;
  };
};

export type LaneTransitionEvent = RepositoryEventBase & {
  event_type: 'lane_transition';
  subsystem: 'repository_memory';
  payload: {
    lane_id: string;
    from_state: string;
    to_state: string;
    reason?: string;
  };
};

export type WorkerAssignmentEvent = RepositoryEventBase & {
  event_type: 'worker_assignment';
  subsystem: 'repository_memory';
  payload: {
    lane_id: string;
    worker_id: string;
    assignment_status: 'assigned' | 'blocked' | 'skipped';
    assigned_prompt?: string;
  };
};

export type ExecutionOutcomeEvent = RepositoryEventBase & {
  event_type: 'execution_outcome';
  payload: {
    lane_id: string;
    outcome: 'success' | 'failure' | 'blocked' | 'partial';
    summary: string;
  };
};

export type ImprovementSignalEvent = RepositoryEventBase & {
  event_type: 'improvement_signal';
  payload: {
    candidate_id: string;
    source: string;
    summary: string;
    confidence?: number;
  };
};

export type RepositoryEvent =
  | RouteDecisionEvent
  | LaneTransitionEvent
  | WorkerAssignmentEvent
  | ExecutionOutcomeEvent
  | ImprovementSignalEvent;

export type RepositoryEventIndex = {
  schemaVersion: typeof REPOSITORY_EVENTS_SCHEMA_VERSION;
  generatedAt: string;
  total_events: number;
  by_event_type: Record<RepositoryEventType, { count: number; latest_timestamp: string | null }>;
};

export type RepositoryEventQueryOptions = {
  eventType?: RepositoryEventType;
  subsystem?: RepositoryMemorySubsystem;
  subjectId?: string;
  runId?: string;
  order?: 'asc' | 'desc';
  limit?: number;
};

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalize(entry));
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const normalized: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort((left, right) => left.localeCompare(right))) {
      const nested = canonicalize(record[key]);
      if (nested !== undefined) normalized[key] = nested;
    }
    return normalized;
  }

  if (typeof value === 'undefined' || typeof value === 'function' || typeof value === 'symbol') {
    return undefined;
  }

  return value;
};

const deterministicStringify = (value: unknown): string => `${JSON.stringify(canonicalize(value), null, 2)}\n`;
const uniqueSorted = (values: string[]): string[] => [...new Set(values.filter((value) => value.trim().length > 0))].sort((left, right) => left.localeCompare(right));

const hash = (value: unknown, size = 12): string =>
  createHash('sha256').update(JSON.stringify(canonicalize(value)), 'utf8').digest('hex').slice(0, size);

const ensureTimestamp = (timestamp: string | undefined): string => {
  if (typeof timestamp === 'string' && timestamp.trim().length > 0) {
    return timestamp;
  }
  return new Date().toISOString();
};

const readJsonIfExists = <T>(filePath: string): T | null => {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
};

const compareTimestamp = (left: string | null, right: string | null): number => {
  const leftTs = left ? Date.parse(left) : Number.NEGATIVE_INFINITY;
  const rightTs = right ? Date.parse(right) : Number.NEGATIVE_INFINITY;
  if (Number.isNaN(leftTs) && Number.isNaN(rightTs)) return 0;
  if (Number.isNaN(leftTs)) return -1;
  if (Number.isNaN(rightTs)) return 1;
  return leftTs - rightTs;
};

const emptyIndex = (): RepositoryEventIndex => ({
  schemaVersion: REPOSITORY_EVENTS_SCHEMA_VERSION,
  generatedAt: new Date(0).toISOString(),
  total_events: 0,
  by_event_type: {
    execution_outcome: { count: 0, latest_timestamp: null },
    improvement_signal: { count: 0, latest_timestamp: null },
    lane_transition: { count: 0, latest_timestamp: null },
    route_decision: { count: 0, latest_timestamp: null },
    worker_assignment: { count: 0, latest_timestamp: null }
  }
});

export const readRepositoryEventIndex = (repoRoot: string): RepositoryEventIndex => {
  const parsed = readJsonIfExists<RepositoryEventIndex>(path.join(repoRoot, ...INDEX_PATH));
  const seeded = emptyIndex();
  if (!parsed || !parsed.by_event_type) {
    return seeded;
  }

  for (const [eventType, stats] of Object.entries(parsed.by_event_type ?? {})) {
    if (!(eventType in seeded.by_event_type)) continue;
    const typedEventType = eventType as RepositoryEventType;
    const count = typeof stats.count === 'number' ? Math.max(0, Math.trunc(stats.count)) : 0;
    const latest_timestamp = typeof stats.latest_timestamp === 'string' ? stats.latest_timestamp : null;
    seeded.by_event_type[typedEventType] = { count, latest_timestamp };
  }

  seeded.total_events = Object.values(seeded.by_event_type).reduce((total, entry) => total + entry.count, 0);
  seeded.generatedAt = typeof parsed.generatedAt === 'string' ? parsed.generatedAt : seeded.generatedAt;
  return seeded;
};

const writeDeterministicJson = (filePath: string, payload: unknown): void => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, deterministicStringify(payload), 'utf8');
};

const allocateEventPath = (repoRoot: string, eventType: RepositoryEventType, timestamp: string, payload: unknown): { eventId: string; eventPath: string } => {
  const iso = timestamp.replace(/[\-:.TZ]/g, '').slice(0, 14);
  const fingerprint = hash(payload);
  const eventsDir = path.join(repoRoot, ...EVENTS_DIR);
  fs.mkdirSync(eventsDir, { recursive: true });

  let suffix = 0;
  while (suffix < 10000) {
    const candidate = suffix === 0 ? `${iso}-${eventType}-${fingerprint}` : `${iso}-${eventType}-${fingerprint}-${suffix}`;
    const eventPath = path.join(eventsDir, `${candidate}.json`);
    if (!fs.existsSync(eventPath)) {
      return { eventId: candidate, eventPath };
    }
    suffix += 1;
  }

  throw new Error('playbook memory events: unable to allocate append-only event id');
};

const appendEvent = (repoRoot: string, event: Omit<RepositoryEventBase, 'schemaVersion' | 'event_id' | 'timestamp'> & { timestamp?: string }): RepositoryEvent => {
  const timestamp = ensureTimestamp(event.timestamp);
  const normalizedArtifacts = uniqueSorted(event.related_artifacts ?? []);
  const normalizedPayload = canonicalize(event.payload ?? {}) as Record<string, unknown>;

  const payloadForId = {
    event_type: event.event_type,
    subsystem: event.subsystem,
    subject: event.subject,
    related_artifacts: normalizedArtifacts,
    payload: normalizedPayload,
    run_id: event.run_id
  };

  const { eventId, eventPath } = allocateEventPath(repoRoot, event.event_type, timestamp, payloadForId);

  const finalEvent = {
    schemaVersion: REPOSITORY_EVENTS_SCHEMA_VERSION,
    event_id: eventId,
    event_type: event.event_type,
    timestamp,
    subsystem: event.subsystem,
    subject: event.subject,
    related_artifacts: normalizedArtifacts,
    payload: normalizedPayload,
    ...(event.run_id ? { run_id: event.run_id } : {})
  } as RepositoryEvent;

  writeDeterministicJson(eventPath, finalEvent);
  updateIndex(repoRoot, finalEvent);
  return finalEvent;
};

const updateIndex = (repoRoot: string, event: RepositoryEvent): void => {
  const index = readRepositoryEventIndex(repoRoot);
  const next = index.by_event_type[event.event_type];
  const latest_timestamp = compareTimestamp(next.latest_timestamp, event.timestamp) >= 0 ? next.latest_timestamp : event.timestamp;

  index.by_event_type[event.event_type] = {
    count: next.count + 1,
    latest_timestamp
  };
  index.total_events = Object.values(index.by_event_type).reduce((total, entry) => total + entry.count, 0);
  index.generatedAt = event.timestamp;

  writeDeterministicJson(path.join(repoRoot, ...INDEX_PATH), index);
};

const listEventPaths = (repoRoot: string): string[] => {
  const eventsDir = path.join(repoRoot, ...EVENTS_DIR);
  if (!fs.existsSync(eventsDir)) return [];
  return fs
    .readdirSync(eventsDir)
    .filter((entry) => entry.endsWith('.json'))
    .sort((left, right) => left.localeCompare(right))
    .map((entry) => path.join(eventsDir, entry));
};

const isRepositoryEvent = (value: unknown): value is RepositoryEvent => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.schemaVersion === REPOSITORY_EVENTS_SCHEMA_VERSION &&
    typeof candidate.event_id === 'string' &&
    typeof candidate.event_type === 'string' &&
    typeof candidate.timestamp === 'string' &&
    typeof candidate.subsystem === 'string' &&
    candidate.subject !== null &&
    typeof candidate.subject === 'object' &&
    Array.isArray(candidate.related_artifacts) &&
    candidate.payload !== null &&
    typeof candidate.payload === 'object'
  );
};

export const readRepositoryEvents = (repoRoot: string, options: RepositoryEventQueryOptions = {}): RepositoryEvent[] => {
  const entries = listEventPaths(repoRoot)
    .map((eventPath) => readJsonIfExists<unknown>(eventPath))
    .filter((entry): entry is RepositoryEvent => isRepositoryEvent(entry));

  const filtered = entries
    .filter((entry) => (options.eventType ? entry.event_type === options.eventType : true))
    .filter((entry) => (options.subsystem ? entry.subsystem === options.subsystem : true))
    .filter((entry) => (options.subjectId ? entry.subject.id === options.subjectId : true))
    .filter((entry) => (options.runId ? entry.run_id === options.runId : true));

  const sorted = filtered.sort((left, right) => {
    const timestampDelta = compareTimestamp(left.timestamp, right.timestamp);
    if (timestampDelta !== 0) return timestampDelta;
    return left.event_id.localeCompare(right.event_id);
  });

  const ordered = options.order === 'desc' ? sorted.reverse() : sorted;
  if (typeof options.limit === 'number' && options.limit >= 0) {
    return ordered.slice(0, options.limit);
  }
  return ordered;
};

export const recordRouteDecision = (
  repoRoot: string,
  input: {
    timestamp?: string;
    task_text: string;
    task_family: string;
    route_id: string;
    confidence: number;
    related_artifacts?: string[];
    run_id?: string;
  }
): RouteDecisionEvent =>
  appendEvent(repoRoot, {
    event_type: 'route_decision',
    subsystem: 'repository_memory',
    ...(input.timestamp ? { timestamp: input.timestamp } : {}),
    subject: { kind: 'task', id: input.task_text },
    related_artifacts: input.related_artifacts ?? [],
    ...(input.run_id ? { run_id: input.run_id } : {}),
    payload: {
      task_text: input.task_text,
      task_family: input.task_family,
      route_id: input.route_id,
      confidence: Number(input.confidence.toFixed(6))
    }
  }) as RouteDecisionEvent;

export const recordLaneTransition = (
  repoRoot: string,
  input: {
    timestamp?: string;
    lane_id: string;
    from_state: string;
    to_state: string;
    reason?: string;
    related_artifacts?: string[];
    run_id?: string;
  }
): LaneTransitionEvent =>
  appendEvent(repoRoot, {
    event_type: 'lane_transition',
    subsystem: 'repository_memory',
    ...(input.timestamp ? { timestamp: input.timestamp } : {}),
    subject: { kind: 'lane', id: input.lane_id },
    related_artifacts: input.related_artifacts ?? [],
    ...(input.run_id ? { run_id: input.run_id } : {}),
    payload: {
      lane_id: input.lane_id,
      from_state: input.from_state,
      to_state: input.to_state,
      ...(input.reason ? { reason: input.reason } : {})
    }
  }) as LaneTransitionEvent;

export const recordWorkerAssignment = (
  repoRoot: string,
  input: {
    timestamp?: string;
    lane_id: string;
    worker_id: string;
    assignment_status: 'assigned' | 'blocked' | 'skipped';
    assigned_prompt?: string;
    related_artifacts?: string[];
    run_id?: string;
  }
): WorkerAssignmentEvent =>
  appendEvent(repoRoot, {
    event_type: 'worker_assignment',
    subsystem: 'repository_memory',
    ...(input.timestamp ? { timestamp: input.timestamp } : {}),
    subject: { kind: 'lane', id: input.lane_id },
    related_artifacts: input.related_artifacts ?? [],
    ...(input.run_id ? { run_id: input.run_id } : {}),
    payload: {
      lane_id: input.lane_id,
      worker_id: input.worker_id,
      assignment_status: input.assignment_status,
      ...(input.assigned_prompt ? { assigned_prompt: input.assigned_prompt } : {})
    }
  }) as WorkerAssignmentEvent;

export const recordExecutionOutcome = (
  repoRoot: string,
  input: {
    timestamp?: string;
    lane_id: string;
    outcome: 'success' | 'failure' | 'blocked' | 'partial';
    summary: string;
    related_artifacts?: string[];
    run_id?: string;
  }
): ExecutionOutcomeEvent =>
  appendEvent(repoRoot, {
    event_type: 'execution_outcome',
    subsystem: 'repository_memory',
    ...(input.timestamp ? { timestamp: input.timestamp } : {}),
    subject: { kind: 'lane', id: input.lane_id },
    related_artifacts: input.related_artifacts ?? [],
    ...(input.run_id ? { run_id: input.run_id } : {}),
    payload: {
      lane_id: input.lane_id,
      outcome: input.outcome,
      summary: input.summary
    }
  }) as ExecutionOutcomeEvent;

export const recordImprovementSignal = (
  repoRoot: string,
  input: {
    timestamp?: string;
    candidate_id: string;
    source: string;
    summary: string;
    confidence?: number;
    related_artifacts?: string[];
    run_id?: string;
  }
): ImprovementSignalEvent =>
  appendEvent(repoRoot, {
    event_type: 'improvement_signal',
    subsystem: 'knowledge_lifecycle',
    ...(input.timestamp ? { timestamp: input.timestamp } : {}),
    subject: { kind: 'improvement-candidate', id: input.candidate_id },
    related_artifacts: input.related_artifacts ?? [],
    ...(input.run_id ? { run_id: input.run_id } : {}),
    payload: {
      candidate_id: input.candidate_id,
      source: input.source,
      summary: input.summary,
      ...(typeof input.confidence === 'number' ? { confidence: Number(input.confidence.toFixed(6)) } : {})
    }
  }) as ImprovementSignalEvent;

// Backward-compatible aliases retained while event payloads use normalized schema.
export const recordLaneOutcome = recordExecutionOutcome;
export const recordImprovementCandidate = recordImprovementSignal;
export type LaneOutcomeEvent = ExecutionOutcomeEvent;
export type ImprovementCandidateEvent = ImprovementSignalEvent;

export const safeRecordRepositoryEvent = (callback: () => void): void => {
  try {
    callback();
  } catch {
    // Event recording must remain best-effort and never block command workflows.
  }
};
