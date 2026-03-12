import type { ExecutionCheckpoint, ExecutionEvidence, ExecutionOutcome, ExecutionRun, ExecutionStep, ExecutionStepKind, ExecutionStepStatus } from './runContract.js';
import { readExecutionRun, writeExecutionRun } from './writeExecutionRun.js';

export type AppendExecutionStepInput = {
  kind: ExecutionStepKind;
  status: ExecutionStepStatus;
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  evidence?: ExecutionEvidence[];
  error?: ExecutionStep['error'];
};

const nextStepId = (run: ExecutionRun): string => `step-${String(run.steps.length + 1).padStart(3, '0')}`;

const nextCheckpointId = (run: ExecutionRun): string => `checkpoint-${String(run.checkpoints.length + 1).padStart(3, '0')}`;

const ensureMutable = (run: ExecutionRun): void => {
  if (run.frozen) {
    throw new Error(`Execution run ${run.id} is frozen and cannot be modified.`);
  }
};

export const appendExecutionStep = (repoRoot: string, runId: string, input: AppendExecutionStepInput): ExecutionRun => {
  const run = readExecutionRun(repoRoot, runId);
  ensureMutable(run);

  const step: ExecutionStep = {
    id: nextStepId(run),
    kind: input.kind,
    status: input.status,
    inputs: input.inputs ?? {},
    outputs: input.outputs ?? {},
    evidence: input.evidence ?? [],
    error: input.error
  };

  const checkpoint: ExecutionCheckpoint = {
    id: nextCheckpointId(run),
    created_at: new Date().toISOString(),
    step_id: step.id,
    label: `${step.kind}:${step.status}`
  };

  run.steps.push(step);
  run.checkpoints.push(checkpoint);

  writeExecutionRun(repoRoot, run);
  return run;
};

export const completeExecutionRun = (repoRoot: string, runId: string, outcome: ExecutionOutcome): ExecutionRun => {
  const run = readExecutionRun(repoRoot, runId);
  ensureMutable(run);

  run.outcome = outcome;
  run.completed_at = new Date().toISOString();
  run.frozen = true;

  writeExecutionRun(repoRoot, run);
  return run;
};

export const recordExecutionFailure = (repoRoot: string, runId: string, failureCause: string): ExecutionRun =>
  completeExecutionRun(repoRoot, runId, {
    status: 'failed',
    summary: 'Execution failed.',
    failure_cause: failureCause
  });
