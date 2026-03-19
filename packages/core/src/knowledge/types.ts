export const knowledgeArtifactTypes = ['evidence', 'candidate', 'promoted', 'superseded'] as const;
export type KnowledgeArtifactType = (typeof knowledgeArtifactTypes)[number];

export const knowledgeRecordStatuses = ['observed', 'active', 'stale', 'retired', 'superseded'] as const;
export type KnowledgeRecordStatus = (typeof knowledgeRecordStatuses)[number];

export const knowledgeLifecycleStates = ['observed', 'candidate', 'active', 'stale', 'retired', 'superseded', 'demoted'] as const;
export type KnowledgeLifecycleState = (typeof knowledgeLifecycleStates)[number];

export const knowledgeSourceKinds = ['memory-event', 'memory-candidate', 'memory-knowledge', 'global-pattern-memory'] as const;
export type KnowledgeSourceKind = (typeof knowledgeSourceKinds)[number];

export type KnowledgeRecordSource = {
  kind: KnowledgeSourceKind;
  path: string;
  command: string | null;
};

export type KnowledgeRecordProvenance = {
  repo: string;
  sourceCommand: string | null;
  runId: string | null;
  sourcePath: string;
  eventIds: string[];
  evidenceIds: string[];
  fingerprints: string[];
  relatedRecordIds: string[];
};

export type KnowledgeRecord = {
  id: string;
  type: KnowledgeArtifactType;
  createdAt: string;
  repo: string;
  source: KnowledgeRecordSource;
  confidence: number | null;
  status: KnowledgeRecordStatus;
  lifecycle: {
    state: KnowledgeLifecycleState;
    warnings: string[];
    supersedes: string[];
    supersededBy: string[];
  };
  provenance: KnowledgeRecordProvenance;
  metadata: Record<string, unknown>;
};

export type KnowledgeQueryOptions = {
  type?: KnowledgeArtifactType;
  status?: KnowledgeRecordStatus;
  module?: string;
  ruleId?: string;
  text?: string;
  limit?: number;
  order?: 'asc' | 'desc';
  staleDays?: number;
  lifecycle?: KnowledgeLifecycleState;
};

export type KnowledgeTimelineOptions = KnowledgeQueryOptions;

export type KnowledgeProvenanceResult = {
  record: KnowledgeRecord;
  evidence: KnowledgeRecord[];
  relatedRecords: KnowledgeRecord[];
};

export type KnowledgeSummary = {
  total: number;
  byType: Record<KnowledgeArtifactType, number>;
  byStatus: Record<KnowledgeRecordStatus, number>;
  byLifecycle: Record<KnowledgeLifecycleState, number>;
};

export type KnowledgeCompareResult = {
  left: KnowledgeRecord;
  right: KnowledgeRecord;
  common: {
    evidenceIds: string[];
    fingerprints: string[];
    relatedRecordIds: string[];
  };
};

export type KnowledgeSupersessionResult = {
  record: KnowledgeRecord;
  supersedes: KnowledgeRecord[];
  supersededBy: KnowledgeRecord[];
};
