import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const MEMORY_ROOT = ['.playbook', 'memory'] as const;
const EVENTS_DIR = [...MEMORY_ROOT, 'events'] as const;
const INDEX_PATH = [...MEMORY_ROOT, 'index.json'] as const;

export const REPOSITORY_EVENTS_SCHEMA_VERSION = '1.0' as const;

export type RepositoryEventType =
  | 'route_decision'
  | 'lane_transition'
  | 'worker_assignment'
  | 'execution_outcome'
  | 'improvement_signal'
  | 'lane_outcome'
  | 'improvement_candidate';

export type RepositoryEventPayload = Record<string, unknown>;

export type RepositoryEventRelatedArtifact = {
  path: string;
  kind?: string;
};

export type RepositoryEventBase = {
  schemaVersion: typeof REPOSITORY_EVENTS_SCHEMA_VERSION;
  event_type: RepositoryEventType;
  event_id: string;
  timestamp: string;
  subsystem: 'repository_memory' | 'knowledge_lifecycle';
  subject: string;
  related_artifacts: RepositoryEventRelatedArtifact[];
  payload: RepositoryEventPayload;
  run_id?: string;
};

export type RouteDecisionEvent = RepositoryEventBase & {
  event_type: 'route_decision';
  subsystem: 'repository_memory';
  subject: string;
  payload: {
    task_text: string;
    task_family: string;
    route_id: string;
    confidence: number;
  };
  task_text: string;
  task_family: string;
  route_id: string;
  confidence: number;
};

export type LaneTransitionEvent = RepositoryEventBase & {
  event_type: 'lane_transition';
  subsystem: 'repository_memory';
  subject: string;
  payload: {
    lane_id: string;
    from_state: string;
    to_state: string;
    reason?: string;
  };
  lane_id: string;
  from_state: string;
  to_state: string;
  reason?: string;
};

export type WorkerAssignmentEvent = RepositoryEventBase & {
  event_type: 'worker_assignment';
  subsystem: 'repository_memory';
  subject: string;
  payload: {
    lane_id: string;
    worker_id: string;
    assignment_status: 'assigned' | 'blocked' | 'skipped';
    assigned_prompt?: string;
  };
  lane_id: string;
  worker_id: string;
  assignment_status: 'assigned' | 'blocked' | 'skipped';
  assigned_prompt?: string;
};

export type ExecutionOutcomeEvent = RepositoryEventBase & {
  event_type: 'execution_outcome';
  subsystem: 'repository_memory';
  subject: string;
  payload: {
    lane_id: string;
    outcome: 'success' | 'failure' | 'blocked' | 'partial';
    summary: string;
  };
  lane_id: string;
  outcome: 'success' | 'failure' | 'blocked' | 'partial';
  summary: string;
};

export type ImprovementSignalEvent = RepositoryEventBase & {
  event_type: 'improvement_signal';
  subsystem: 'knowledge_lifecycle';
  subject: string;
  payload: {
    candidate_id: string;
    source: string;
    summary: string;
    confidence: number;
  };
  candidate_id: string;
  source: string;
  summary: string;
  confidence: number;
};


export type LaneOutcomeLegacyEvent = Omit<ExecutionOutcomeEvent, 'event_type'> & {
  event_type: 'lane_outcome';
};

export type ImprovementCandidateLegacyEvent = Omit<ImprovementSignalEvent, 'event_type'> & {
  event_type: 'improvement_candidate';
};

export type RepositoryEvent =
  | RouteDecisionEvent
  | LaneTransitionEvent
  | WorkerAssignmentEvent
  | ExecutionOutcomeEvent
  | ImprovementSignalEvent
  | LaneOutcomeLegacyEvent
  | ImprovementCandidateLegacyEvent;

export type RepositoryEventIndex = {
  schemaVersion: typeof REPOSITORY_EVENTS_SCHEMA_VERSION;
  generatedAt: string;
  total_events: number;
  by_event_type: Record<RepositoryEventType, { count: number; latest_timestamp: string | null }>;
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
    worker_assignment: { count: 0, latest_timestamp: null },
    lane_outcome: { count: 0, latest_timestamp: null },
    improvement_candidate: { count: 0, latest_timestamp: null }
  }
});

const readIndex = (repoRoot: string): RepositoryEventIndex => {
  const parsed = readJsonIfExists<RepositoryEventIndex>(path.join(repoRoot, ...INDEX_PATH));
  if (!parsed || parsed.schemaVersion !== REPOSITORY_EVENTS_SCHEMA_VERSION) {
    return emptyIndex();
  }

  const seeded = emptyIndex();
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

type RepositoryEventInput = Omit<RepositoryEventBase, 'schemaVersion' | 'event_id' | 'timestamp'> & {
  timestamp?: string;
  [key: string]: unknown;
};

const appendEvent = (repoRoot: string, event: RepositoryEventInput): RepositoryEvent => {
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

export const recordRouteDecision = (
  repoRoot: string,
  input: {
    timestamp?: string;
    run_id?: string;
    task_text: string;
    task_family: string;
    route_id: string;
    confidence: number;
    related_artifacts?: RepositoryEventRelatedArtifact[];
  }
): RouteDecisionEvent =>
  appendEvent(repoRoot, {
    event_type: 'route_decision',
    ...(input.timestamp ? { timestamp: input.timestamp } : {}),
    ...(input.run_id ? { run_id: input.run_id } : {}),
    subsystem: 'repository_memory',
    subject: input.route_id,
    related_artifacts: [...(input.related_artifacts ?? [])],
    payload: {
      task_text: input.task_text,
      task_family: input.task_family,
      route_id: input.route_id,
      confidence: Number(input.confidence.toFixed(6))
    },
    task_text: input.task_text,
    task_family: input.task_family,
    route_id: input.route_id,
    confidence: Number(input.confidence.toFixed(6))
  }) as RouteDecisionEvent;

export const recordLaneTransition = (
  repoRoot: string,
  input: {
    timestamp?: string;
    run_id?: string;
    lane_id: string;
    from_state: string;
    to_state: string;
    reason?: string;
    related_artifacts?: RepositoryEventRelatedArtifact[];
  }
): LaneTransitionEvent =>
  appendEvent(repoRoot, {
    event_type: 'lane_transition',
    ...(input.timestamp ? { timestamp: input.timestamp } : {}),
    ...(input.run_id ? { run_id: input.run_id } : {}),
    subsystem: 'repository_memory',
    subject: input.lane_id,
    related_artifacts: [...(input.related_artifacts ?? [])],
    payload: {
      lane_id: input.lane_id,
      from_state: input.from_state,
      to_state: input.to_state,
      ...(input.reason ? { reason: input.reason } : {})
    },
    lane_id: input.lane_id,
    from_state: input.from_state,
    to_state: input.to_state,
    ...(input.reason ? { reason: input.reason } : {})
  }) as LaneTransitionEvent;

export const recordWorkerAssignment = (
  repoRoot: string,
  input: {
    timestamp?: string;
    run_id?: string;
    lane_id: string;
    worker_id: string;
    assignment_status: 'assigned' | 'blocked' | 'skipped';
    assigned_prompt?: string;
    related_artifacts?: RepositoryEventRelatedArtifact[];
  }
): WorkerAssignmentEvent =>
  appendEvent(repoRoot, {
    event_type: 'worker_assignment',
    ...(input.timestamp ? { timestamp: input.timestamp } : {}),
    ...(input.run_id ? { run_id: input.run_id } : {}),
    subsystem: 'repository_memory',
    subject: input.lane_id,
    related_artifacts: [...(input.related_artifacts ?? [])],
    payload: {
      lane_id: input.lane_id,
      worker_id: input.worker_id,
      assignment_status: input.assignment_status,
      ...(input.assigned_prompt ? { assigned_prompt: input.assigned_prompt } : {})
    },
    lane_id: input.lane_id,
    worker_id: input.worker_id,
    assignment_status: input.assignment_status,
    ...(input.assigned_prompt ? { assigned_prompt: input.assigned_prompt } : {})
  }) as WorkerAssignmentEvent;

export const recordExecutionOutcome = (
  repoRoot: string,
  input: {
    timestamp?: string;
    run_id?: string;
    lane_id: string;
    outcome: 'success' | 'failure' | 'blocked' | 'partial';
    summary: string;
    related_artifacts?: RepositoryEventRelatedArtifact[];
  }
): ExecutionOutcomeEvent =>
  appendEvent(repoRoot, {
    event_type: 'execution_outcome',
    ...(input.timestamp ? { timestamp: input.timestamp } : {}),
    ...(input.run_id ? { run_id: input.run_id } : {}),
    subsystem: 'repository_memory',
    subject: input.lane_id,
    related_artifacts: [...(input.related_artifacts ?? [])],
    payload: {
      lane_id: input.lane_id,
      outcome: input.outcome,
      summary: input.summary
    },
    lane_id: input.lane_id,
    outcome: input.outcome,
    summary: input.summary
  }) as ExecutionOutcomeEvent;

export const recordImprovementSignal = (
  repoRoot: string,
  input: {
    timestamp?: string;
    run_id?: string;
    candidate_id: string;
    source: string;
    summary: string;
    confidence?: number;
    related_artifacts?: RepositoryEventRelatedArtifact[];
  }
): ImprovementSignalEvent =>
  appendEvent(repoRoot, {
    event_type: 'improvement_signal',
    ...(input.timestamp ? { timestamp: input.timestamp } : {}),
    ...(input.run_id ? { run_id: input.run_id } : {}),
    subsystem: 'knowledge_lifecycle',
    subject: input.candidate_id,
    related_artifacts: [...(input.related_artifacts ?? [])],
    payload: {
      candidate_id: input.candidate_id,
      source: input.source,
      summary: input.summary,
      ...(typeof input.confidence === 'number' ? { confidence: Number(input.confidence.toFixed(6)) } : {})
    },
    candidate_id: input.candidate_id,
    source: input.source,
    summary: input.summary,
    confidence: typeof input.confidence === 'number' ? Number(input.confidence.toFixed(6)) : 0
  }) as ImprovementSignalEvent;

export type RepositoryEventLookupOptions = {
  eventType?: RepositoryEventType;
  subsystem?: RepositoryEventBase['subsystem'];
  subject?: string;
  runId?: string;
  relatedArtifact?: string;
  order?: 'asc' | 'desc';
  limit?: number;
};

export type RepositoryEventSummaryKind =
  | 'recent_route_decisions'
  | 'lane_transitions_for_run'
  | 'worker_assignments_for_run'
  | 'improvement_signals_for_artifact';

export type RepositoryEventSummaryResult = {
  schemaVersion: typeof REPOSITORY_EVENTS_SCHEMA_VERSION;
  summary: RepositoryEventSummaryKind;
  generatedAt: string;
  total: number;
  events: RepositoryEvent[];
};

const sortEvents = (events: RepositoryEvent[], order: 'asc' | 'desc'): RepositoryEvent[] => {
  const sorted = [...events].sort((left, right) => {
    const timestampDelta = compareTimestamp(left.timestamp, right.timestamp);
    if (timestampDelta !== 0) {
      return timestampDelta;
    }

    return left.event_id.localeCompare(right.event_id);
  });

  return order === 'desc' ? sorted.reverse() : sorted;
};

export const readRepositoryEvents = (repoRoot: string, options: RepositoryEventLookupOptions = {}): RepositoryEvent[] => {
  const eventsDir = path.join(repoRoot, ...EVENTS_DIR);
  if (!fs.existsSync(eventsDir)) {
    return [];
  }

  const events = fs
    .readdirSync(eventsDir)
    .filter((entry) => entry.endsWith('.json'))
    .sort((left, right) => left.localeCompare(right))
    .map((entry) => readJsonIfExists<RepositoryEvent>(path.join(eventsDir, entry)))
    .filter((entry): entry is RepositoryEvent => Boolean(entry))
    .filter((entry) => (options.eventType ? entry.event_type === options.eventType : true))
    .filter((entry) => (options.subsystem ? entry.subsystem === options.subsystem : true))
    .filter((entry) => (options.subject ? entry.subject === options.subject : true))
    .filter((entry) => (options.runId ? entry.run_id === options.runId : true))
    .filter((entry) =>
      options.relatedArtifact
        ? (entry.related_artifacts ?? []).some((artifact) => artifact.path === options.relatedArtifact)
        : true
    );

  const sorted = sortEvents(events, options.order ?? 'asc');
  if (typeof options.limit === 'number' && options.limit >= 0) {
    return sorted.slice(0, options.limit);
  }

  return sorted;
};

export const queryRepositoryEvents = (repoRoot: string, options: RepositoryEventLookupOptions = {}): RepositoryEvent[] =>
  readRepositoryEvents(repoRoot, options);

export const queryRepositoryEventsByType = (
  repoRoot: string,
  eventType: RepositoryEventType,
  options: Omit<RepositoryEventLookupOptions, 'eventType'> = {}
): RepositoryEvent[] => readRepositoryEvents(repoRoot, { ...options, eventType });

export const queryRepositoryEventsBySubsystem = (
  repoRoot: string,
  subsystem: RepositoryEventBase['subsystem'],
  options: Omit<RepositoryEventLookupOptions, 'subsystem'> = {}
): RepositoryEvent[] => readRepositoryEvents(repoRoot, { ...options, subsystem });

export const queryRepositoryEventsByRunId = (
  repoRoot: string,
  runId: string,
  options: Omit<RepositoryEventLookupOptions, 'runId'> = {}
): RepositoryEvent[] => readRepositoryEvents(repoRoot, { ...options, runId });

export const queryRepositoryEventsBySubject = (
  repoRoot: string,
  subject: string,
  options: Omit<RepositoryEventLookupOptions, 'subject'> = {}
): RepositoryEvent[] => readRepositoryEvents(repoRoot, { ...options, subject });

export const queryRepositoryEventsByRelatedArtifact = (
  repoRoot: string,
  relatedArtifact: string,
  options: Omit<RepositoryEventLookupOptions, 'relatedArtifact'> = {}
): RepositoryEvent[] => readRepositoryEvents(repoRoot, { ...options, relatedArtifact });

export const summarizeRecentRouteDecisions = (
  repoRoot: string,
  options: Pick<RepositoryEventLookupOptions, 'limit'> = {}
): RepositoryEventSummaryResult => {
  const events = readRepositoryEvents(repoRoot, {
    eventType: 'route_decision',
    order: 'desc',
    limit: options.limit
  });
  return {
    schemaVersion: REPOSITORY_EVENTS_SCHEMA_VERSION,
    summary: 'recent_route_decisions',
    generatedAt: new Date().toISOString(),
    total: events.length,
    events
  };
};

export const summarizeLaneTransitionsForRun = (repoRoot: string, runId: string): RepositoryEventSummaryResult => {
  const events = readRepositoryEvents(repoRoot, {
    eventType: 'lane_transition',
    runId,
    order: 'asc'
  });
  return {
    schemaVersion: REPOSITORY_EVENTS_SCHEMA_VERSION,
    summary: 'lane_transitions_for_run',
    generatedAt: new Date().toISOString(),
    total: events.length,
    events
  };
};

export const summarizeWorkerAssignmentsForRun = (repoRoot: string, runId: string): RepositoryEventSummaryResult => {
  const events = readRepositoryEvents(repoRoot, {
    eventType: 'worker_assignment',
    runId,
    order: 'asc'
  });
  return {
    schemaVersion: REPOSITORY_EVENTS_SCHEMA_VERSION,
    summary: 'worker_assignments_for_run',
    generatedAt: new Date().toISOString(),
    total: events.length,
    events
  };
};

export const summarizeImprovementSignalsForArtifact = (
  repoRoot: string,
  relatedArtifact: string
): RepositoryEventSummaryResult => {
  const events = readRepositoryEvents(repoRoot, {
    eventType: 'improvement_signal',
    relatedArtifact,
    order: 'desc'
  });
  return {
    schemaVersion: REPOSITORY_EVENTS_SCHEMA_VERSION,
    summary: 'improvement_signals_for_artifact',
    generatedAt: new Date().toISOString(),
    total: events.length,
    events
  };
};

export const recordLaneOutcome = recordExecutionOutcome;
export const recordImprovementCandidate = recordImprovementSignal;

export type LaneOutcomeEvent = ExecutionOutcomeEvent | LaneOutcomeLegacyEvent;
export type ImprovementCandidateEvent = ImprovementSignalEvent | ImprovementCandidateLegacyEvent;

export const safeRecordRepositoryEvent = (callback: () => void): void => {
  try {
    callback();
  } catch {
    // Event recording must remain best-effort and never block command workflows.
  }
};
