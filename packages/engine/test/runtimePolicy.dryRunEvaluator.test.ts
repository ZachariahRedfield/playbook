import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { CompiledRuntimeTaskInput } from '@zachariahredfield/playbook-core';
import { evaluateDryRunRuntimePolicy } from '../src/runtimePolicy/dryRunEvaluator.js';

const tempDirs: string[] = [];

const createTempCompiledTaskDir = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'runtime-policy-'));
  tempDirs.push(dir);
  return dir;
};

const writeCompiledTasks = (dir: string, tasks: CompiledRuntimeTaskInput[]): void => {
  tasks.forEach((task, index) => {
    const fileName = `${String(index + 1).padStart(2, '0')}-${task.runtimeTaskId}.json`;
    fs.writeFileSync(path.join(dir, fileName), JSON.stringify(task, null, 2));
  });
};

afterEach(() => {
  while (tempDirs.length > 0) {
    const target = tempDirs.pop();
    if (target) fs.rmSync(target, { recursive: true, force: true });
  }
});

const taskBase = (overrides: Partial<CompiledRuntimeTaskInput>): CompiledRuntimeTaskInput => ({
  kind: 'compiled-runtime-task-input',
  schemaVersion: '1.0.0',
  runId: 'run_policy_eval',
  runtimeTaskId: 'tsk_default',
  sourcePlanTaskId: 'plt_default',
  sourcePlanTaskIndex: 0,
  ruleId: 'workspace:test',
  file: 'packages/engine/src/policy/evaluator.ts',
  action: 'pnpm playbook verify --json',
  taskKind: 'observe-only',
  mutabilityClass: 'read-only',
  dependencies: [],
  provenance: {
    planTaskId: 'plt_default',
    planTaskIndex: 0
  },
  ...overrides
});

const policyConfig = {
  repoRoot: path.resolve('/workspace/playbook'),
  allowedCommandFamilies: ['verify', 'apply', 'query'],
  allowedRemediationScopes: ['workspace'],
  allowedPathScopes: ['packages/engine']
} as const;

describe('runtimePolicy dry-run evaluator', () => {
  it('records read-only task as allowed', () => {
    const compiledDir = createTempCompiledTaskDir();
    writeCompiledTasks(
      compiledDir,
      [
        taskBase({
          runtimeTaskId: 'tsk_read_allowed',
          sourcePlanTaskId: 'plt_read_allowed',
          mutabilityClass: 'read-only',
          taskKind: 'observe-only',
          action: 'pnpm playbook query modules --json'
        })
      ]
    );

    const result = evaluateDryRunRuntimePolicy({
      runId: 'run_policy_eval',
      compiledTasksPath: compiledDir,
      policyConfig,
      now: () => 100
    });

    expect(result.decisions).toHaveLength(1);
    expect(result.decisions[0]?.outcome).toBe('allowed');
    expect(result.decisions[0]?.decisionCode).toBe('READ_ONLY_ALLOWED');
    expect(result.tasks[0]?.policyDecision.policyDecision.policyState).toBe('allow');
    expect(result.approvalSummary.allowedTaskIds).toEqual(['tsk_read_allowed']);
  });

  it('marks mutation-bearing task as requiring approval when no approval exists', () => {
    const compiledDir = createTempCompiledTaskDir();
    writeCompiledTasks(
      compiledDir,
      [
        taskBase({
          runtimeTaskId: 'tsk_requires_approval',
          sourcePlanTaskId: 'plt_requires_approval',
          taskKind: 'apply-fix',
          mutabilityClass: 'mutating',
          action: 'pnpm playbook apply --from-plan .playbook/plan.json'
        })
      ]
    );

    const result = evaluateDryRunRuntimePolicy({
      runId: 'run_policy_eval',
      compiledTasksPath: compiledDir,
      policyConfig,
      now: () => 200
    });

    expect(result.decisions[0]?.outcome).toBe('requires_approval');
    expect(result.decisions[0]?.decisionCode).toBe('MUTATION_REQUIRES_APPROVAL');
    expect(result.decisions[0]?.policyDecision.approvalState).toBe('pending');
    expect(result.approvalSummary.approvalRequiredTaskIds).toEqual(['tsk_requires_approval']);
  });

  it('records denied task outcome deterministically', () => {
    const compiledDir = createTempCompiledTaskDir();
    writeCompiledTasks(
      compiledDir,
      [
        taskBase({
          runtimeTaskId: 'tsk_denied',
          sourcePlanTaskId: 'plt_denied',
          file: 'docs/CHANGELOG.md',
          action: 'pnpm playbook verify --json',
          mutabilityClass: 'read-only'
        })
      ]
    );

    const result = evaluateDryRunRuntimePolicy({
      runId: 'run_policy_eval',
      compiledTasksPath: compiledDir,
      policyConfig,
      now: () => 300
    });

    expect(result.decisions[0]?.outcome).toBe('denied');
    expect(result.decisions[0]?.decisionCode).toBe('PATH_OUT_OF_SCOPE');
    expect(result.approvalSummary.deniedTaskIds).toEqual(['tsk_denied']);
  });

  it('produces deterministic approval summary aggregates', () => {
    const compiledDir = createTempCompiledTaskDir();
    writeCompiledTasks(compiledDir, [
      taskBase({
        runtimeTaskId: 'tsk_c',
        sourcePlanTaskId: 'plt_c',
        file: 'docs/ARCHITECTURE.md',
        mutabilityClass: 'read-only',
        taskKind: 'observe-only',
        action: 'pnpm playbook query modules --json'
      }),
      taskBase({
        runtimeTaskId: 'tsk_a',
        sourcePlanTaskId: 'plt_a',
        mutabilityClass: 'read-only',
        taskKind: 'observe-only',
        action: 'pnpm playbook query modules --json'
      }),
      taskBase({
        runtimeTaskId: 'tsk_b',
        sourcePlanTaskId: 'plt_b',
        mutabilityClass: 'mutating',
        taskKind: 'apply-fix',
        action: 'pnpm playbook apply --from-plan .playbook/plan.json'
      })
    ]);

    const result = evaluateDryRunRuntimePolicy({
      runId: 'run_policy_eval',
      compiledTasksPath: compiledDir,
      policyConfig,
      now: () => 400
    });

    expect(result.approvalSummary).toEqual({
      totalTasks: 3,
      allowedTaskIds: ['tsk_a'],
      deniedTaskIds: ['tsk_c'],
      approvalRequiredTaskIds: ['tsk_b'],
      outcomes: {
        allowed: 1,
        denied: 1,
        requires_approval: 1
      }
    });
    expect(result.decisions.map((decision) => decision.runtimeTaskId)).toEqual(['tsk_a', 'tsk_b', 'tsk_c']);
  });
});
