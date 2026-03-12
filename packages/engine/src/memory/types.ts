export const MEMORY_SCHEMA_VERSION = '1.0' as const;

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

export type MemoryEvent = {
  schemaVersion: typeof MEMORY_SCHEMA_VERSION;
  kind: MemoryEventKind;
  eventInstanceId: string;
  eventFingerprint: string;
  createdAt: string;
  repoRevision: string;
  sources: MemoryEventSource[];
  subjectModules: string[];
  ruleIds: string[];
  riskSummary: MemoryRiskSummary;
  outcome: MemoryOutcome;
  salienceInputs: Record<string, string | number | boolean | string[] | number[] | boolean[] | null>;
};

export type MemoryEventInput = Omit<MemoryEvent, 'schemaVersion' | 'eventInstanceId' | 'eventFingerprint' | 'createdAt' | 'repoRevision'> & {
  repoRevision?: string;
};

export type MemoryIndex = {
  schemaVersion: typeof MEMORY_SCHEMA_VERSION;
  generatedAt: string;
  byModule: Record<string, string[]>;
  byRule: Record<string, string[]>;
  byFingerprint: Record<string, string[]>;
};
