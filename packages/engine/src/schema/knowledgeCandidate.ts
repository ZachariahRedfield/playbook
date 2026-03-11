export type KnowledgeCandidateDedupe = {
  kind: 'none';
  hint?: string;
};

export type KnowledgeCandidateEvidencePointer = {
  path: string;
};

export type KnowledgeCandidate = {
  candidateId: string;
  theme: string;
  evidence: KnowledgeCandidateEvidencePointer[];
  dedupe: KnowledgeCandidateDedupe;
};

export type LearnDraftResult = {
  schemaVersion: '1.0';
  command: 'learn-draft';
  baseRef: string;
  baseSha: string;
  headSha: string;
  diffContext: boolean;
  changedFiles: string[];
  candidates: KnowledgeCandidate[];
};
