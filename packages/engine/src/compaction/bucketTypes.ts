import type { CompactionCandidate } from './candidateTypes.js';

export const COMPACTION_BUCKET_SCHEMA_VERSION = '1.0' as const;

export type CompactionBucketKind = 'discard' | 'attach' | 'merge' | 'add';

export type RelationKind = 'same-mechanism' | 'same-pattern-different-evidence' | 'overlap' | 'distinct';

export type RelationAssessment = {
  targetId: string;
  relationKind: RelationKind;
  similarityScore: number;
  mechanismMatch: boolean;
  invariantMatch: boolean | 'unknown';
  responseMatch: boolean | 'unknown';
  evidenceOnlyDifference: boolean;
  synergySignal: boolean;
};

export type ImportanceLevel = 'low' | 'medium' | 'high';
export type RecurrenceSignal = 'none' | 'weak' | 'medium' | 'strong';

export type ImportanceAssessment = {
  riskLevel: ImportanceLevel;
  recurrenceSignal: RecurrenceSignal;
  noveltyLevel: ImportanceLevel;
  transferabilityLevel: ImportanceLevel;
  actionabilityLevel: ImportanceLevel;
};

export type BucketTarget = {
  targetId: string;
  origin: 'known-pattern' | 'same-run-draft';
  candidate: CompactionCandidate;
};

export type BucketDecision = {
  bucket: CompactionBucketKind;
  reason: string;
  targetId?: string;
  deferredGeneralizationCandidate: boolean;
};

export type BucketedCandidateEntry = {
  candidateId: string;
  candidateFingerprint: string;
  bucket: CompactionBucketKind;
  reason: string;
  targetId?: string;
  targetOrigin?: BucketTarget['origin'];
  deferredGeneralizationCandidate: boolean;
  relation: RelationAssessment;
  importance: ImportanceAssessment;
  notes: string[];
  candidate: CompactionCandidate;
};

export type CompactionBucketArtifact = {
  schemaVersion: typeof COMPACTION_BUCKET_SCHEMA_VERSION;
  kind: 'playbook-compaction-buckets';
  generatedAt: 'deterministic';
  inputCandidateCount: number;
  summary: {
    discard: number;
    attach: number;
    merge: number;
    add: number;
  };
  entries: BucketedCandidateEntry[];
};
