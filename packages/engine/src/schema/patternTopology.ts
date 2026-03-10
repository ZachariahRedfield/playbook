import type { PatternCard } from './patternCard.js';

export const PATTERN_TOPOLOGY_SCHEMA_VERSION = '1.0' as const;

export type PatternTopologySignature = {
  schemaVersion: typeof PATTERN_TOPOLOGY_SCHEMA_VERSION;
  kind: 'playbook-pattern-topology-signature';
  patternId: string;
  stageCount: number;
  dependencyStructure: string[];
  contractReferences: string[];
  invariantType: string;
  mechanismType: string;
  deterministicInvariantKey: string;
};

export type PatternVariant = {
  patternId: string;
  canonicalPatternId: string;
  lineagePreserved: boolean;
  transformationNotes: string[];
};

export type PatternEquivalenceClass = {
  classId: string;
  signature: PatternTopologySignature;
  canonicalPattern: PatternCard;
  memberPatterns: PatternCard[];
  variants: PatternVariant[];
  transformationNotes: string[];
};

export type PatternTopologyTelemetry = {
  patternEquivalenceCount: number;
  canonicalizationRate: number;
  variantCollapseRate: number;
};

export type PatternEquivalenceArtifact = {
  schemaVersion: typeof PATTERN_TOPOLOGY_SCHEMA_VERSION;
  kind: 'playbook-pattern-equivalence';
  artifactId: string;
  createdAt: string;
  equivalenceClasses: PatternEquivalenceClass[];
  signatures: PatternTopologySignature[];
  telemetry: PatternTopologyTelemetry;
};
