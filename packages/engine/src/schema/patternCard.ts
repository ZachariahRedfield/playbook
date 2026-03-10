export const PATTERN_CARD_SCHEMA_VERSION = '1.0' as const;

export type PatternCardDecisionType = 'promote' | 'merge' | 'supersede';

export type PatternCardVersionEntry = {
  version: number;
  decisionId: string;
  decisionType: PatternCardDecisionType;
  timestamp: string;
};

export type PatternCardLineage = {
  originCycleIds: string[];
  sourceDraftIds: string[];
  sourceGroupIds: string[];
  sourceZettelIds: string[];
  evidenceRefs: string[];
  supersedesPatternIds: string[];
  mergedFromPatternIds: string[];
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
  status: 'active' | 'superseded';
  createdAt: string;
  updatedAt: string;
  currentVersion: number;
  versionHistory: PatternCardVersionEntry[];
  lineage: PatternCardLineage;
  supersededByPatternId?: string;
};

export type PatternCardCollectionArtifact = {
  schemaVersion: '1.0';
  kind: 'playbook-pattern-cards';
  artifactId: string;
  originCycleId: string;
  createdAt: string;
  cards: PatternCard[];
};
