export const META_PATTERN_SCHEMA_VERSION = '1.0' as const;

export type MetaPattern = {
  patternId: string;
  canonicalKey: string;
  occurrences: number;
  promotedCount: number;
  rejectedCount: number;
  firstSeenAt?: string;
  lastSeenAt?: string;
  linkedContractRefs: string[];
  sourceArtifactRefs: string[];
};

export type MetaPatternsArtifact = {
  schemaVersion: typeof META_PATTERN_SCHEMA_VERSION;
  kind: 'playbook-meta-patterns';
  createdAt: string;
  patterns: MetaPattern[];
};

