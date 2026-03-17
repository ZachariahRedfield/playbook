export type SessionPinnedArtifactKind = 'finding' | 'plan' | 'run' | 'pattern' | 'artifact';

export type SessionPinnedArtifact = {
  artifact: string;
  kind: SessionPinnedArtifactKind;
  pinnedAt: string;
};

export type SessionStep = 'verify' | 'plan' | 'apply' | 'resume' | 'idle';

export type SessionEvidenceArtifactKind =
  | 'session'
  | 'run'
  | 'pinned'
  | 'cycle-state'
  | 'cycle-history'
  | 'proposal-candidates'
  | 'policy-evaluation'
  | 'policy-apply-result';

export type SessionEvidenceArtifactReference = {
  path: string;
  kind: SessionEvidenceArtifactKind;
  present: boolean;
};

export type SessionEvidencePolicyDecision = {
  proposal_id: string;
  decision: 'safe' | 'requires_review' | 'blocked';
  reason: string;
  source: 'policy-evaluation' | 'policy-apply-result';
};

export type SessionEvidenceExecutionResult = {
  executed: string[];
  skipped_requires_review: string[];
  skipped_blocked: string[];
  failed_execution: string[];
};

export type SessionEvidenceLineageReference = {
  order: number;
  stage: 'session' | 'proposal_generation' | 'policy_evaluation' | 'execution_result';
  artifact: string;
  present: boolean;
};

export type SessionEvidenceEnvelope = {
  version: 1;
  session_id: string;
  selected_run_id: string | null;
  cycle_id: string | null;
  generated_from_last_updated_time: string;
  artifacts: SessionEvidenceArtifactReference[];
  proposal_ids: string[];
  policy_decisions: SessionEvidencePolicyDecision[];
  execution_result: SessionEvidenceExecutionResult | null;
  lineage: SessionEvidenceLineageReference[];
};

export type SessionContract = {
  version: 1;
  sessionId: string;
  repoRoot: string;
  activeGoal: string;
  selectedRunId: string | null;
  pinnedArtifacts: SessionPinnedArtifact[];
  currentStep: SessionStep;
  unresolvedQuestions: string[];
  constraints: string[];
  evidenceEnvelope: SessionEvidenceEnvelope;
  lastUpdatedTime: string;
};

export type ResumeSessionResult = {
  session: SessionContract;
  warnings: string[];
  activeRunFound: boolean;
};
