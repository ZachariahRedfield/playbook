export const EVIDENCE_SCHEMA_VERSION = '1.0' as const;

export type CorePrimitive = 'observe' | 'represent' | 'relate' | 'compress' | 'decide';

export type Evidence = {
  schemaVersion: typeof EVIDENCE_SCHEMA_VERSION;
  kind: 'playbook-evidence';
  evidenceId: string;
  sourceKind: string;
  observedAt: string;
  artifactRef: string;
  digest?: string;
  attributes?: Record<string, string | number | boolean>;
};

export type Zettel = {
  zettelId: string;
  title: string;
  summary: string;
  evidenceRefs: string[];
};

export type Edge = {
  edgeId: string;
  from: string;
  to: string;
  relation: string;
  weight?: number;
};

export type Pattern = {
  patternId: string;
  canonicalKey: string;
  evidenceRefs: string[];
  confidence: number;
};

export type Decision = {
  decisionId: string;
  decisionType: string;
  decidedAt: string;
  rationale: string;
  evidenceRefs: string[];
  patternRefs: string[];
};
