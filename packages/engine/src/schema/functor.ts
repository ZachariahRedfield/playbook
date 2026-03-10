export const KNOWLEDGE_FUNCTOR_SCHEMA_VERSION = '1.0' as const;

export const FUNCTOR_TARGET_DOMAINS = ['contract-proposal', 'documentation-template', 'ci-rule'] as const;

export type FunctorTargetDomain = (typeof FUNCTOR_TARGET_DOMAINS)[number];

export type StructuralInvariantProjection = {
  mechanism?: string;
  invariant?: string;
  dependencies: string[];
};

export type FunctorMapping = {
  mappingId: string;
  sourceKind: 'playbook-pattern-card';
  targetKind: string;
  targetDomain: FunctorTargetDomain;
  transformVersion: string;
  description: string;
  preserveFields: Array<keyof StructuralInvariantProjection>;
};

export type KnowledgeFunctor = {
  schemaVersion: typeof KNOWLEDGE_FUNCTOR_SCHEMA_VERSION;
  kind: 'playbook-knowledge-functor';
  functorId: string;
  sourceKind: FunctorMapping['sourceKind'];
  targetDomain: FunctorTargetDomain;
  description: string;
  mapping: FunctorMapping;
};

export type FunctorLineage = {
  sourcePatternId: string;
  sourceCanonicalKey: string;
  sourceArtifactPath?: string;
  sourceEvidenceRefs: string[];
  generatedAt: string;
};

export type FunctorApplication = {
  schemaVersion: typeof KNOWLEDGE_FUNCTOR_SCHEMA_VERSION;
  kind: 'playbook-functor-application';
  applicationId: string;
  functorId: string;
  mappingId: string;
  inputKind: 'playbook-pattern-card';
  outputKind: string;
  outputDomain: FunctorTargetDomain;
  structuralInvariantProjection: StructuralInvariantProjection;
  deterministicDigest: string;
  lineage: FunctorLineage;
  output: Record<string, unknown>;
};

export type FunctorApplicationArtifact = {
  schemaVersion: typeof KNOWLEDGE_FUNCTOR_SCHEMA_VERSION;
  kind: 'playbook-functor-output';
  artifactId: string;
  generatedAt: string;
  applications: FunctorApplication[];
};
