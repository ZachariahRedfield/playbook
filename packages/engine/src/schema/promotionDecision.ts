export const PROMOTION_DECISION_TYPES = ['promote', 'defer', 'reject', 'merge', 'split', 'supersede'] as const;

export type PromotionDecisionType = (typeof PROMOTION_DECISION_TYPES)[number];

export type PromotionSplitDraft = {
  title: string;
  summary: string;
  sourceZettelIds: string[];
  mechanism?: string;
  invariant?: string;
};

export type PromotionDecision = {
  decisionId: string;
  originCycleId: string;
  patternDraftId: string;
  decisionType: PromotionDecisionType;
  decisionReason: string;
  reviewer?: string;
  timestamp: string;
  sourceGroupIds: string[];
  sourceZettelIds: string[];
  resultingPatternIds: string[];
  relatedDraftIds?: string[];
  relatedPatternIds?: string[];
  splitDrafts?: PromotionSplitDraft[];
};

export type PromotionDecisionArtifact = {
  schemaVersion: '1.0';
  kind: 'playbook-promotion-decisions';
  artifactId: string;
  originCycleId: string;
  createdAt: string;
  decisions: PromotionDecision[];
};
