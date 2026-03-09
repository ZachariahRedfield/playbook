export const COMPACTION_CANDIDATE_SCHEMA_VERSION = '1.0' as const;

export type CandidateSourceKind = 'verify' | 'plan' | 'apply' | 'analyze-pr' | 'docs-audit';

export type CandidateSubjectKind = 'rule' | 'task' | 'module' | 'docs' | 'artifact' | 'repository';

export type CandidateEvidence = {
  sourceKind: CandidateSourceKind;
  sourceRef: string;
  pointer: string;
  summary: string;
};

export type CandidateRelated = {
  modules: string[];
  rules: string[];
  docs: string[];
  owners: string[];
  graphNodes: string[];
  riskSignals: string[];
  tests: string[];
};

export type CandidateCanonical = {
  normalizedTrigger: string;
  normalizedMechanism: string;
  normalizedSubject: string;
  fingerprint: string;
};

export type CompactionCandidate = {
  schemaVersion: typeof COMPACTION_CANDIDATE_SCHEMA_VERSION;
  kind: 'compaction-candidate';
  candidateId: string;
  sourceKind: CandidateSourceKind;
  sourceRef: string;
  subjectKind: CandidateSubjectKind;
  subjectRef: string;
  trigger: string;
  mechanism: string;
  invariant?: string;
  response?: string;
  evidence: CandidateEvidence[];
  related: CandidateRelated;
  canonical: CandidateCanonical;
};

export type CompactionCandidateArtifact = {
  schemaVersion: '1.0';
  kind: 'playbook-compaction-candidates';
  candidates: CompactionCandidate[];
  summary: {
    total: number;
    bySourceKind: Record<CandidateSourceKind, number>;
    bySubjectKind: Record<CandidateSubjectKind, number>;
  };
};
