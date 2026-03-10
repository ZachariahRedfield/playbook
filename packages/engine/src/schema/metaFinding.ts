export const META_FINDING_SCHEMA_VERSION = '1.0' as const;

export const META_FINDING_TYPES = [
  'promotion_latency',
  'duplicate_pattern_pressure',
  'unresolved_draft_age',
  'supersede_rate',
  'contract_mutation_frequency',
  'entropy_trend'
] as const;

export type MetaFindingType = (typeof META_FINDING_TYPES)[number];

export type MetaFindingSeverity = 'low' | 'medium' | 'high';

export type MetaFinding = {
  findingId: string;
  type: MetaFindingType;
  title: string;
  summary: string;
  severity: MetaFindingSeverity;
  value: number;
  threshold?: number;
  trend?: 'improving' | 'stable' | 'degrading';
  artifactRefs: string[];
  recommendation: string;
  supportingMetrics: Record<string, number>;
};

export type MetaFindingsArtifact = {
  schemaVersion: typeof META_FINDING_SCHEMA_VERSION;
  kind: 'playbook-meta-findings';
  createdAt: string;
  findings: MetaFinding[];
};
