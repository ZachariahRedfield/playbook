export type CandidatePattern = {
  id: string;
  sourcePatternId: string;
  canonicalPatternName: string;
  whyItExists: string;
  examples: string[];
  confidence: number;
  reusableEngineeringMeaning: string;
  recurrenceCount: number;
  repoSurfaceBreadth: number;
  remediationUsefulness: number;
  canonicalClarity: number;
  falsePositiveRisk: number;
  promotionScore: number;
  stage: 'candidate' | 'review';
};

export type PromotionDecision = {
  candidateId: string;
  decision: 'approve' | 'reject';
  decidedBy: 'human-reviewed-local';
  decidedAt: string;
  rationale: string;
};

export type PromotionReviewRecord = {
  candidateId: string;
  canonicalPatternName: string;
  whyItExists: string;
  examples: string[];
  confidence: number;
  reusableEngineeringMeaning: string;
  decision: PromotionDecision;
};

export type PromotedPattern = {
  id: string;
  sourceCandidateId: string;
  canonicalPatternName: string;
  whyItExists: string;
  examples: string[];
  confidence: number;
  reusableEngineeringMeaning: string;
  promotedAt: string;
  reviewRecord: PromotionReviewRecord;
};
