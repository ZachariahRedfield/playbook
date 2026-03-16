import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const MEMORY_ROOT = ['.playbook', 'memory'] as const;
const EVENTS_DIR = [...MEMORY_ROOT, 'events'] as const;
const INDEX_PATH = [...MEMORY_ROOT, 'index.json'] as const;

export const REPOSITORY_EVENTS_SCHEMA_VERSION = '1.0' as const;

export type RepositoryEventType = 'route_decision' | 'lane_transition' | 'worker_assignment' | 'execution_outcome' | 'improvement_signal';

export type RepositoryEventSubsystem = 'repository_memory' | 'knowledge_lifecycle';

export type RepositoryEventSubject = {
  kind: string;
  id: string;
  scope?: string;
};

export type RepositoryEventBase = {
  schemaVersion: typeof REPOSITORY_EVENTS_SCHEMA_VERSION;
  event_type: RepositoryEventType;
  event_id: string;
  timestamp: string;
  subsystem: RepositoryEventSubsystem;
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
    from_state: string;
    to_state: string;
    reason?: string;
  };
};

export type WorkerAssignmentEvent = RepositoryEventBase & {
  event_type: 'worker_assignment';
  subsystem: 'repository_memory';
  payload: {
    worker_id: string;
    assignment_status: 'assigned' | 'blocked' | 'skipped';
    assigned_prompt?: string;
  };
};

export type ExecutionOutcomeEvent = RepositoryEventBase & {
  event_type: 'execution_outcome';
  subsystem: 'repository_memory';
  payload: {
    outcome: 'success' | 'failure' | 'blocked' | 'partial';
    summary: string;
  };
};

export type ImprovementSignalEvent = RepositoryEventBase & {
  event_type: 'improvement_signal';
  subsystem: 'knowledge_lifecycle';
  payload: {
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

export type RepositoryEventQuery = {
  event_type?: RepositoryEventType;
  subsystem?: RepositoryEventSubsystem;
  run_id?: string;
  subject_id?: string;
  limit?: number;
  order?: 'asc' | 'desc';
};

export type RepositoryEventIndex = {
  schemaVersion: typeof REPOSITORY_EVENTS_SCHEMA_VERSION;
  generatedAt: string;
  total_events: number;
  by_event_type: Record<RepositoryEventType, { count: number; latest_timestamp: string | null }>;
};

const LEGACY_EVENT_TYPE_ALIASES: Partial<Record<string, RepositoryEventType>> = {
  lane_outcome: 'execution_outcome',
  improvement_candidate: 'improvement_signal'
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

const readIndex = (repoRoot: string): RepositoryEventIndex => {
  const parsed = readJsonIfExists<RepositoryEventIndex>(path.join(repoRoot, ...INDEX_PATH));
  if (!parsed || parsed.schemaVersion !== REPOSITORY_EVENTS_SCHEMA_VERSION) {
    return emptyIndex();
  }

  const seeded = emptyIndex();
  for (const [eventType, stats] of Object.entries(parsed.by_event_type ?? {})) {
    const normalizedType = (eventType in seeded.by_event_type
      ? eventType
      : LEGACY_EVENT_TYPE_ALIASES[eventType]) as RepositoryEventType | undefined;
    if (!normalizedType) continue;
    const count = typeof stats.count === 'number' ? Math.max(0, Math.trunc(stats.count)) : 0;
    const latest_timestamp = typeof stats.latest_timestamp === 'string' ? stats.latest_timestamp : null;
    const previous = seeded.by_event_type[normalizedType];
    seeded.by_event_type[normalizedType] = {
      count: previous.count + count,
      latest_timestamp: compareTimestamp(previous.latest_timestamp, latest_timestamp) >= 0 ? previous.latest_timestamp : latest_timestamp
    };
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

const appendEvent = <T extends Omit<RepositoryEventBase, 'schemaVersion' | 'event_id' | 'timestamp'> & { timestamp?: string }>(repoRoot: string, event: T): RepositoryEvent => {
  const timestamp = ensureTimestamp(event.timestamp);
  const { eventId, eventPath } = allocateEventPath(repoRoot, event.event_type, timestamp, event);

  const finalEvent = {
    ...event,
    schemaVersion: REPOSITORY_EVENTS_SCHEMA_VERSION,
    event_id: eventId,
    timestamp
  } as unknown as RepositoryEvent;

  writeDeterministicJson(eventPath, finalEvent);
  updateIndex(repoRoot, finalEvent);
  return finalEvent;
};

const updateIndex = (repoRoot: string, event: RepositoryEvent): void => {
  const index = readIndex(repoRoot);
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

const sortRepositoryEvents = (events: RepositoryEvent[], order: 'asc' | 'desc'): RepositoryEvent[] => {
  const sorted = [...events].sort((left, right) => {
    const tsDelta = compareTimestamp(left.timestamp, right.timestamp);
    if (tsDelta !== 0) return tsDelta;
    return left.event_id.localeCompare(right.event_id);
  });
  return order === 'desc' ? sorted.reverse() : sorted;
};

const readEvent = (filePath: string): RepositoryEvent | null => {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as RepositoryEvent;
    if (!parsed || typeof parsed.event_id !== 'string' || typeof parsed.event_type !== 'string') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const readRepositoryEvents = (repoRoot: string, query: RepositoryEventQuery = {}): RepositoryEvent[] => {
  const eventsDir = path.join(repoRoot, ...EVENTS_DIR);
  if (!fs.existsSync(eventsDir)) {
    return [];
  }

  const all = fs
    .readdirSync(eventsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => readEvent(path.join(eventsDir, entry.name)))
    .filter((entry): entry is RepositoryEvent => entry !== null)
    .filter((event) => (query.event_type ? event.event_type === query.event_type : true))
    .filter((event) => (query.subsystem ? event.subsystem === query.subsystem : true))
    .filter((event) => (query.run_id ? event.run_id === query.run_id : true))
    .filter((event) => (query.subject_id ? event.subject.id === query.subject_id : true));

  const ordered = sortRepositoryEvents(all, query.order ?? 'desc');
  if (typeof query.limit === 'number' && query.limit >= 0) {
    return ordered.slice(0, query.limit);
  }
  return ordered;
};

export const recordRouteDecision = (
  repoRoot: string,
  input: {
    timestamp?: string;
    run_id?: string;
    related_artifacts?: string[];
    task_text: string;
    task_family: string;
    route_id: string;
    confidence: number;
  }
): RouteDecisionEvent =>
  appendEvent(repoRoot, {
    event_type: 'route_decision',
    subsystem: 'repository_memory',
    ...(input.timestamp ? { timestamp: input.timestamp } : {}),
    ...(input.run_id ? { run_id: input.run_id } : {}),
    subject: { kind: 'task', id: input.task_text, scope: input.task_family },
    related_artifacts: [...(input.related_artifacts ?? [])].sort((left, right) => left.localeCompare(right)),
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
    run_id?: string;
    related_artifacts?: string[];
    lane_id: string;
    from_state: string;
    to_state: string;
    reason?: string;
  }
): LaneTransitionEvent =>
  appendEvent(repoRoot, {
    event_type: 'lane_transition',
    subsystem: 'repository_memory',
    ...(input.timestamp ? { timestamp: input.timestamp } : {}),
    ...(input.run_id ? { run_id: input.run_id } : {}),
    subject: { kind: 'lane', id: input.lane_id },
    related_artifacts: [...(input.related_artifacts ?? [])].sort((left, right) => left.localeCompare(right)),
    payload: {
      from_state: input.from_state,
      to_state: input.to_state,
      ...(input.reason ? { reason: input.reason } : {})
    }
  }) as LaneTransitionEvent;

export const recordWorkerAssignment = (
  repoRoot: string,
  input: {
    timestamp?: string;
    run_id?: string;
    related_artifacts?: string[];
    lane_id: string;
    worker_id: string;
    assignment_status: 'assigned' | 'blocked' | 'skipped';
    assigned_prompt?: string;
  }
): WorkerAssignmentEvent =>
  appendEvent(repoRoot, {
    event_type: 'worker_assignment',
    subsystem: 'repository_memory',
    ...(input.timestamp ? { timestamp: input.timestamp } : {}),
    ...(input.run_id ? { run_id: input.run_id } : {}),
    subject: { kind: 'lane', id: input.lane_id },
    related_artifacts: [...(input.related_artifacts ?? [])].sort((left, right) => left.localeCompare(right)),
    payload: {
      worker_id: input.worker_id,
      assignment_status: input.assignment_status,
      ...(input.assigned_prompt ? { assigned_prompt: input.assigned_prompt } : {})
    }
  }) as WorkerAssignmentEvent;

export const recordExecutionOutcome = (
  repoRoot: string,
  input: {
    timestamp?: string;
    run_id?: string;
    related_artifacts?: string[];
    lane_id: string;
    outcome: 'success' | 'failure' | 'blocked' | 'partial';
    summary: string;
  }
): ExecutionOutcomeEvent =>
  appendEvent(repoRoot, {
    event_type: 'execution_outcome',
    subsystem: 'repository_memory',
    ...(input.timestamp ? { timestamp: input.timestamp } : {}),
    ...(input.run_id ? { run_id: input.run_id } : {}),
    subject: { kind: 'lane', id: input.lane_id },
    related_artifacts: [...(input.related_artifacts ?? [])].sort((left, right) => left.localeCompare(right)),
    payload: {
      outcome: input.outcome,
      summary: input.summary
    }
  }) as ExecutionOutcomeEvent;

export const recordImprovementSignal = (
  repoRoot: string,
  input: {
    timestamp?: string;
    run_id?: string;
    related_artifacts?: string[];
    candidate_id: string;
    source: string;
    summary: string;
    confidence?: number;
  }
): ImprovementSignalEvent =>
  appendEvent(repoRoot, {
    event_type: 'improvement_signal',
    subsystem: 'knowledge_lifecycle',
    ...(input.timestamp ? { timestamp: input.timestamp } : {}),
    ...(input.run_id ? { run_id: input.run_id } : {}),
    subject: { kind: 'candidate', id: input.candidate_id },
    related_artifacts: [...(input.related_artifacts ?? [])].sort((left, right) => left.localeCompare(right)),
    payload: {
      source: input.source,
      summary: input.summary,
      ...(typeof input.confidence === 'number' ? { confidence: Number(input.confidence.toFixed(6)) } : {})
    }
  }) as ImprovementSignalEvent;

export const safeRecordRepositoryEvent = (callback: () => void): void => {
  try {
    callback();
  } catch {
    // Event recording must remain best-effort and never block command workflows.
  }
};
