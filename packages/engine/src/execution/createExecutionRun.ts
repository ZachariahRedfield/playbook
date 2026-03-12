import { createHash } from 'node:crypto';
import type { ExecutionIntent, ExecutionRun } from './runContract.js';
import { writeExecutionRun } from './writeExecutionRun.js';

const deterministicId = (prefix: string, seed: string): string => {
  const digest = createHash('sha256').update(seed, 'utf8').digest('hex').slice(0, 12);
  return `${prefix}-${digest}`;
};

export const createExecutionRun = (repoRoot: string, intent: ExecutionIntent): ExecutionRun => {
  const createdAt = new Date().toISOString();
  const runId = deterministicId('run', `${intent.id}:${intent.goal}:${createdAt}`);
  const run: ExecutionRun = {
    id: runId,
    version: 1,
    intent,
    steps: [],
    checkpoints: [],
    created_at: createdAt,
    frozen: false
  };

  writeExecutionRun(repoRoot, run);
  return run;
};

export const createExecutionIntent = (goal: string, scope: string[], constraints: string[], requestedBy: 'user' | 'system'): ExecutionIntent => {
  const id = deterministicId('intent', `${goal}:${scope.join('|')}:${constraints.join('|')}:${requestedBy}`);
  return {
    id,
    goal,
    scope,
    constraints,
    requested_by: requestedBy
  };
};
