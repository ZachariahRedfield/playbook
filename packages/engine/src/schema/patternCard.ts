import type { PatternCardVersionRef, PromotionDecisionType, PromotionState } from './promotionDecision.js';

export const PATTERN_CARD_SCHEMA_VERSION = '1.0' as const;

export type PatternCardDecisionType = PromotionDecisionType;

export type PatternCardVersionEntry = {
  version: number;
  decisionId: string;
  decisionType: PatternCardDecisionType;
  timestamp: string;
  state: PromotionState;
};

export type PatternCardLineage = {
  originCycleIds: string[];
  sourceDraftIds: string[];
  sourceGroupIds: string[];
  sourceZettelIds: string[];
  sourceArtifactPaths: string[];
  evidenceRefs: string[];
  parentPatternIds: string[];
  priorVersionIds: string[];
  decisionIds: string[];
};

export type PatternCard = {
  schemaVersion: typeof PATTERN_CARD_SCHEMA_VERSION;
  kind: 'playbook-pattern-card';
  patternId: string;
  canonicalKey: string;
  title: string;
  summary: string;
  mechanism?: string;
  invariant?: string;
  linkedContractRefs: string[];
  linkedContractProposalRefs?: string[];
  state: PromotionState;
  createdAt: string;
  updatedAt: string;
  currentVersion: number;
  versionHistory: PatternCardVersionEntry[];
  lineage: PatternCardLineage;
  versionRef: PatternCardVersionRef;
};

export type PatternCardCollectionArtifact = {
  schemaVersion: '1.0';
  kind: 'playbook-pattern-cards';
  artifactId: string;
  originCycleId: string;
  createdAt: string;
  cards: PatternCard[];
};
