export const META_FINDING_SCHEMA_VERSION = '1.0' as const;

export const META_FINDING_TYPES = [
  'promotion_latency',
  'duplicate_pattern_pressure',
  'unresolved_draft_age',
  'supersede_rate',
  'entropy_trend',
  'contract_mutation_frequency'
] as const;

export type MetaFindingType = (typeof META_FINDING_TYPES)[number];

export type MetaFinding = {
  findingId: string;
  findingType: MetaFindingType;
  description: string;
  sourceArtifactRefs: string[];
  supportingMetrics: Record<string, number>;
  confidence: number;
  observedCycleIds: string[];
  createdAt: string;
};

export type MetaFindingsArtifact = {
  schemaVersion: typeof META_FINDING_SCHEMA_VERSION;
  kind: 'playbook-meta-findings';
  createdAt: string;
  findings: MetaFinding[];
};
