export const PROMOTION_DECISION_TYPES = ['promote', 'defer', 'reject', 'merge', 'split', 'supersede'] as const;
export const PROMOTION_STATES = ['draft', 'hold', 'review', 'promoted', 'deferred', 'rejected', 'superseded'] as const;

export type PromotionDecisionType = (typeof PROMOTION_DECISION_TYPES)[number];
export type PromotionState = (typeof PROMOTION_STATES)[number];

export type PromotionDecisionLineage = {
  sourceGroupIds: string[];
  sourceZettelIds: string[];
  sourceArtifactPaths: string[];
  priorVersionIds: string[];
};

export type PromotionDecision = {
  decisionId: string;
  originCycleId: string;
  sequence: number;
  timestamp: string;
  decisionType: PromotionDecisionType;
  inputPatternIds: string[];
  inputDraftIds: string[];
  decisionReason: string;
  resultingPatternIds: string[];
  resultingState: PromotionState;
  evidenceRefs: string[];
  reviewer?: string;
  lineage: PromotionDecisionLineage;
};

export type PromotionStateTransition = {
  fromState: PromotionState;
  toState: PromotionState;
  allowed: boolean;
  validationErrors: string[];
};

export type DecisionBatch = {
  schemaVersion: '1.0';
  kind: 'playbook-promotion-decision-batch';
  batchId: string;
  originCycleId: string;
  createdAt: string;
  decisions: PromotionDecision[];
};

export type PromotionDecisionArtifact = DecisionBatch;

export type PatternCardVersionRef = {
  patternId: string;
  version: number;
  status: PromotionState;
  supersedes?: string;
  supersededBy?: string;
};
