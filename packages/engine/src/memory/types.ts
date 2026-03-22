export const MEMORY_SCHEMA_VERSION = '1.0' as const;
export const TEMPORAL_MEMORY_INDEX_KIND = 'playbook-temporal-memory-index' as const;
export const SESSION_REPLAY_EVIDENCE_KIND = 'playbook-session-replay-evidence' as const;

export type MemoryEventKind = 'verify_run' | 'plan_run' | 'apply_run' | 'pr_analysis' | 'failure_ingest';

export type MemoryRiskSummary = {
  level: 'low' | 'medium' | 'high' | 'unknown';
  score?: number;
  signals: string[];
};

export type MemoryOutcome = {
  status: 'success' | 'failure' | 'partial' | 'skipped';
  summary: string;
  metrics?: Record<string, number>;
};

export type MemoryEventSource = {
  type: string;
  reference: string;
};

export type MemoryScope = {
  modules: string[];
  ruleIds: string[];
};

export type MemoryEvent = {
  schemaVersion: typeof MEMORY_SCHEMA_VERSION;
  kind: MemoryEventKind;
  eventId: string;
  eventFingerprint: string;
  createdAt: string;
  repoRevision: string;
  scope: MemoryScope;
  sources: MemoryEventSource[];
  riskSummary: MemoryRiskSummary;
  outcome: MemoryOutcome;
  salienceInputs: Record<string, string | number | boolean | string[] | number[] | boolean[] | null>;
};

export type LegacyMemoryEventInput = {
  subjectModules?: string[] | null;
  ruleIds?: string[] | null;
  scope?: MemoryScope | Partial<MemoryScope> | null;
};

export type MemoryEventInput = Omit<MemoryEvent, 'schemaVersion' | 'eventId' | 'eventFingerprint' | 'createdAt' | 'repoRevision' | 'scope'> &
  LegacyMemoryEventInput & {
    repoRevision?: string;
  };

export type MemoryIndexEntry = {
  eventId: string;
  relativePath: string;
  scope: MemoryScope;
  fingerprint: string;
  createdAt: string;
  memoryKind: MemoryEventKind;
};

export type MemoryIndex = {
  schemaVersion: typeof MEMORY_SCHEMA_VERSION;
  kind: typeof TEMPORAL_MEMORY_INDEX_KIND;
  generatedAt: string;
  events: MemoryIndexEntry[];
  byModule: Record<string, string[]>;
  byRule: Record<string, string[]>;
  byFingerprint: Record<string, string[]>;
};

export type SessionReplayEvidenceInput = {
  eventId: string;
  sourcePath: string;
  fingerprint: string;
  runId: string | null;
  scope: MemoryScope;
};

export type SessionReplayEvidence = {
  schemaVersion: typeof MEMORY_SCHEMA_VERSION;
  kind: typeof SESSION_REPLAY_EVIDENCE_KIND;
  generatedAt: string;
  memoryIndex: {
    path: '.playbook/memory/index.json';
    eventCount: number;
  };
  replayInputs: SessionReplayEvidenceInput[];
  authority: {
    mutation: 'read-only';
    promotion: 'review-required';
  };
};
