export type SessionPinnedArtifactKind = 'finding' | 'plan' | 'run' | 'pattern' | 'artifact';

export type SessionPinnedArtifact = {
  artifact: string;
  kind: SessionPinnedArtifactKind;
  pinnedAt: string;
};

export type SessionStep = 'verify' | 'plan' | 'apply' | 'resume' | 'idle';

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
  lastUpdatedTime: string;
};

export type ResumeSessionResult = {
  session: SessionContract;
  warnings: string[];
  activeRunFound: boolean;
};
