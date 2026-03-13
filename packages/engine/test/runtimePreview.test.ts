import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { controlPlaneRuntimePaths, createControlPlaneSchemaMetadata, type CompiledRuntimeTaskInput } from '@zachariahredfield/playbook-core';
import { describe, expect, it } from 'vitest';
import { previewDryRunScheduling } from '../src/runtimePreview/index.js';

const makeRepo = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-runtime-preview-'));

const writeJson = (filePath: string, payload: unknown): void => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
};

const writeCompiledTask = (repo: string, task: CompiledRuntimeTaskInput): void => {
  writeJson(path.join(repo, controlPlaneRuntimePaths.compiledTasks, `${task.runtimeTaskId}.json`), task);
};

const writeQueueItem = (
  repo: string,
  payload: {
    runId: string;
    taskId: string;
    enqueuedAt: number;
    priority: number;
    attempts?: number;
    retryBudget?: number;
    state?: 'pending' | 'completed';
    approvalState?: 'not-required' | 'pending' | 'approved' | 'rejected';
  }
): void => {
  writeJson(path.join(repo, controlPlaneRuntimePaths.queue, `${payload.taskId}.json`), {
    ...createControlPlaneSchemaMetadata('queue-item'),
    ...payload
  });
};

const compiledTask = (input: {
  runId: string;
  runtimeTaskId: string;
  sourcePlanTaskIndex: number;
  taskKind?: 'apply-fix' | 'manual-remediation' | 'observe-only';
  dependencies?: string[];
}): CompiledRuntimeTaskInput => ({
  ...createControlPlaneSchemaMetadata('compiled-runtime-task-input'),
  runId: input.runId,
  runtimeTaskId: input.runtimeTaskId,
  sourcePlanTaskId: `plan-${input.sourcePlanTaskIndex}`,
  sourcePlanTaskIndex: input.sourcePlanTaskIndex,
  ruleId: 'PB-V09-CONTROL-PLANE-001',
  file: null,
  action: 'preview task',
  taskKind: input.taskKind ?? 'apply-fix',
  mutabilityClass: input.taskKind === 'manual-remediation' ? 'read-only' : 'mutating',
  dependencies: [...(input.dependencies ?? [])],
  provenance: {
    planTaskId: `plan-${input.sourcePlanTaskIndex}`,
    planTaskIndex: input.sourcePlanTaskIndex
  }
});

describe('runtime dry-run scheduling preview', () => {
  it('orders ready tasks after dependency completion and separates blocked dependencies', () => {
    const repo = makeRepo();
    const runId = 'run_dep_order';

    writeCompiledTask(repo, compiledTask({ runId, runtimeTaskId: 'task-setup', sourcePlanTaskIndex: 0 }));
    writeCompiledTask(repo, compiledTask({ runId, runtimeTaskId: 'task-run', sourcePlanTaskIndex: 1, dependencies: ['task-setup'] }));
    writeCompiledTask(repo, compiledTask({ runId, runtimeTaskId: 'task-late', sourcePlanTaskIndex: 2, dependencies: ['task-missing'] }));

    writeQueueItem(repo, { runId, taskId: 'task-setup', enqueuedAt: 1, priority: 10, state: 'completed' });
    writeQueueItem(repo, { runId, taskId: 'task-run', enqueuedAt: 2, priority: 8, state: 'pending' });
    writeQueueItem(repo, { runId, taskId: 'task-late', enqueuedAt: 3, priority: 9, state: 'pending' });

    const preview = previewDryRunScheduling(repo, runId);

    expect(preview.completed.map((entry) => entry.runtimeTaskId)).toEqual(['task-setup']);
    expect(preview.ready.map((entry) => entry.runtimeTaskId)).toEqual(['task-run']);
    expect(preview.blocked.map((entry) => entry.runtimeTaskId)).toEqual(['task-late']);
    expect(preview.blocked[0]?.blockedReasons).toEqual(['dependency-pending']);
    expect(preview.blocked[0]?.blockedByTaskIds).toEqual(['task-missing']);
    expect(preview.nextTaskId).toBe('task-run');
  });

  it('breaks equal-priority ties deterministically by runtime task id', () => {
    const repo = makeRepo();
    const runId = 'run_tie_break';

    writeCompiledTask(repo, compiledTask({ runId, runtimeTaskId: 'task-beta', sourcePlanTaskIndex: 0 }));
    writeCompiledTask(repo, compiledTask({ runId, runtimeTaskId: 'task-alpha', sourcePlanTaskIndex: 1 }));

    writeQueueItem(repo, { runId, taskId: 'task-beta', enqueuedAt: 2, priority: 5, state: 'pending', approvalState: 'approved' });
    writeQueueItem(repo, { runId, taskId: 'task-alpha', enqueuedAt: 1, priority: 5, state: 'pending', approvalState: 'approved' });

    const preview = previewDryRunScheduling(repo, runId);

    expect(preview.deterministicNextTaskOrder).toEqual(['task-alpha', 'task-beta']);
    expect(preview.nextTaskId).toBe('task-alpha');
  });

  it('summarizes blocked reasons across retry, dependency, and approval gates', () => {
    const repo = makeRepo();
    const runId = 'run_blocked_summary';

    writeCompiledTask(repo, compiledTask({ runId, runtimeTaskId: 'task-retry', sourcePlanTaskIndex: 0 }));
    writeCompiledTask(repo, compiledTask({ runId, runtimeTaskId: 'task-dep', sourcePlanTaskIndex: 1, dependencies: ['task-missing'] }));
    writeCompiledTask(repo, compiledTask({ runId, runtimeTaskId: 'task-approval', sourcePlanTaskIndex: 2, taskKind: 'manual-remediation' }));

    writeQueueItem(repo, { runId, taskId: 'task-retry', enqueuedAt: 1, priority: 9, attempts: 3, retryBudget: 1, state: 'pending', approvalState: 'approved' });
    writeQueueItem(repo, { runId, taskId: 'task-dep', enqueuedAt: 2, priority: 8, state: 'pending', approvalState: 'approved' });
    writeQueueItem(repo, { runId, taskId: 'task-approval', enqueuedAt: 3, priority: 7, state: 'pending', approvalState: 'pending' });

    const preview = previewDryRunScheduling(repo, runId);

    expect(preview.blockedReasonSummary).toEqual({
      'approval-required': 1,
      'dependency-pending': 1,
      'retry-budget-exhausted': 1
    });
    expect(preview.ready).toHaveLength(0);
  });

  it('keeps approval-gated manual remediation tasks non-executable in preview ordering', () => {
    const repo = makeRepo();
    const runId = 'run_approval_gate';

    writeCompiledTask(repo, compiledTask({ runId, runtimeTaskId: 'task-safe', sourcePlanTaskIndex: 0, taskKind: 'observe-only' }));
    writeCompiledTask(repo, compiledTask({ runId, runtimeTaskId: 'task-manual', sourcePlanTaskIndex: 1, taskKind: 'manual-remediation' }));

    writeQueueItem(repo, { runId, taskId: 'task-safe', enqueuedAt: 1, priority: 3, state: 'pending', approvalState: 'not-required' });
    writeQueueItem(repo, { runId, taskId: 'task-manual', enqueuedAt: 2, priority: 10, state: 'pending', approvalState: 'pending' });

    const preview = previewDryRunScheduling(repo, runId);

    expect(preview.ready.map((entry) => entry.runtimeTaskId)).toEqual(['task-safe']);
    expect(preview.blocked.map((entry) => entry.runtimeTaskId)).toEqual(['task-manual']);
    expect(preview.blocked[0]?.blockedReasons).toEqual(['approval-required']);
    expect(preview.nextTaskId).toBe('task-safe');
  });
});
