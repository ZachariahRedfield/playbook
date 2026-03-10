import type { CompactionBucketKind } from './bucketTypes.js';

export const PATTERN_CARD_SCHEMA_VERSION = '1.0' as const;

export type PatternCardStatus = 'candidate' | 'reviewed' | 'promoted' | 'archived';

export type PatternCard = {
  schemaVersion: typeof PATTERN_CARD_SCHEMA_VERSION;
  kind: 'playbook-pattern-card';
  patternId: string;
  title: string;
  status: PatternCardStatus;
  createdFromBucket: Exclude<CompactionBucketKind, 'discard'>;
  trigger: string;
  context: string;
  mechanism: string;
  invariant: string;
  implication: string;
  response: string;
  examples: string[];
  evidence: string[];
  sourceKinds: string[];
  sourceRefs: string[];
  relatedModules: string[];
  relatedRules: string[];
  relatedDocs: string[];
  relatedOwners: string[];
  relatedTests: string[];
  relatedRiskSignals: string[];
  relatedGraphNodes: string[];
  relatedPatterns: string[];
  supersedes: string[];
  supersededBy: string[];
  reviewState: 'pending-review' | 'reviewed';
  promotionState: 'not-promoted' | 'promoted';
  confidence: number | null;
  notes?: string;
};

export type PatternCardReviewDraftEntry = {
  candidateId: string;
  bucket: CompactionBucketKind;
  reason: string;
  targetPatternId?: string;
  draftPatternId?: string;
  deferredGeneralizationCandidate: boolean;
};

export type PatternCardReviewDraftArtifact = {
  schemaVersion: '1.0';
  kind: 'playbook-compaction-review-drafts';
  generatedAt: 'deterministic';
  summary: {
    newCardsToReview: number;
    attach: number;
    merge: number;
    add: number;
    discard: number;
    deferredGeneralization: number;
  };
  newCardsToReview: string[];
  attachDecisions: PatternCardReviewDraftEntry[];
  mergeDecisions: PatternCardReviewDraftEntry[];
  addDecisions: PatternCardReviewDraftEntry[];
  discarded: PatternCardReviewDraftEntry[];
};
