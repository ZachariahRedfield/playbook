export type ExecutionRequestedBy = 'user' | 'system';

export type ExecutionIntent = {
  id: string;
  goal: string;
  scope: string[];
  constraints: string[];
  requested_by: ExecutionRequestedBy;
};

export type ExecutionStepKind = 'observe' | 'plan' | 'apply' | 'verify' | 'learn';

export type ExecutionStepStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';

export type ExecutionEvidence = {
  id: string;
  kind: 'artifact' | 'finding' | 'log' | 'metric';
  ref: string;
  note?: string;
};

export type ExecutionCheckpoint = {
  id: string;
  created_at: string;
  step_id: string;
  label: string;
};

export type ExecutionStep = {
  id: string;
  kind: ExecutionStepKind;
  status: ExecutionStepStatus;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  evidence: ExecutionEvidence[];
  error?: {
    code: string;
    message: string;
  };
};

export type ExecutionOutcome = {
  status: 'passed' | 'failed' | 'partial';
  summary: string;
  failure_cause?: string;
};

export type ExecutionRun = {
  id: string;
  version: 1;
  intent: ExecutionIntent;
  steps: ExecutionStep[];
  checkpoints: ExecutionCheckpoint[];
  created_at: string;
  completed_at?: string;
  outcome?: ExecutionOutcome;
  frozen: boolean;
};
