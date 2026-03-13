import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  appendRuntimeLogRecord,
  createRuntimeRun,
  createRuntimeTask,
  listRuntimeLogRecords,
  listRuntimeRuns,
  listRuntimeTasks,
  readRuntimeRun,
  readRuntimeTask,
  runtimeLifecyclePaths,
  transitionRuntimeRunState,
  transitionRuntimeTaskState
} from '../src/runtime/index.js';

const makeRepo = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-runtime-lifecycle-'));

describe('runtime lifecycle store', () => {
  it('creates a run and persists it under runtime layout', () => {
    const repo = makeRepo();
    const run = createRuntimeRun(repo, {
      agentId: 'agt_test',
      repoId: 'repo_test',
      objective: 'ship deterministic runtime lifecycle',
      createdAt: 100
    });

    expect(run.state).toBe('pending');
    expect(readRuntimeRun(repo, run.runId)?.runId).toBe(run.runId);
    expect(fs.existsSync(path.join(repo, runtimeLifecyclePaths.runFilePath(repo, run.runId)))).toBe(true);
  });

  it('creates a task for an existing run and lists tasks deterministically', () => {
    const repo = makeRepo();
    const run = createRuntimeRun(repo, {
      agentId: 'agt_test',
      repoId: 'repo_test',
      objective: 'task lifecycle',
      createdAt: 100
    });

    const taskB = createRuntimeTask(repo, { runId: run.runId, label: 'b task', createdAt: 200 });
    const taskA = createRuntimeTask(repo, { runId: run.runId, label: 'a task', createdAt: 200 });

    const listed = listRuntimeTasks(repo, run.runId);
    expect(listed.map((task) => task.taskId)).toEqual([taskA.taskId, taskB.taskId].sort());
    expect(readRuntimeTask(repo, run.runId, taskA.taskId)?.state).toBe('pending');
  });

  it('enforces legal and illegal run/task transitions', () => {
    const repo = makeRepo();
    const run = createRuntimeRun(repo, {
      agentId: 'agt_test',
      repoId: 'repo_test',
      objective: 'transition checks',
      createdAt: 100
    });
    const task = createRuntimeTask(repo, { runId: run.runId, label: 'execute', createdAt: 110 });

    expect(transitionRuntimeRunState(repo, { runId: run.runId, to: 'queued', updatedAt: 120 }).state).toBe('queued');
    expect(() => transitionRuntimeRunState(repo, { runId: run.runId, to: 'succeeded', updatedAt: 130 })).toThrow(
      'Invalid run state transition: queued -> succeeded'
    );

    expect(transitionRuntimeTaskState(repo, { runId: run.runId, taskId: task.taskId, to: 'queued', updatedAt: 121 }).state).toBe('queued');
    expect(() => transitionRuntimeTaskState(repo, { runId: run.runId, taskId: task.taskId, to: 'succeeded', updatedAt: 130 })).toThrow(
      'Invalid task state transition: queued -> succeeded'
    );
  });

  it('orders runtime logs deterministically', () => {
    const repo = makeRepo();
    const run = createRuntimeRun(repo, {
      agentId: 'agt_test',
      repoId: 'repo_test',
      objective: 'log ordering',
      createdAt: 100
    });
    const task = createRuntimeTask(repo, { runId: run.runId, label: 'loggable', createdAt: 105 });

    appendRuntimeLogRecord(repo, { runId: run.runId, loggedAt: 300, level: 'info', message: 'later' });
    appendRuntimeLogRecord(repo, { runId: run.runId, taskId: task.taskId, loggedAt: 200, level: 'warn', message: 'earlier' });
    appendRuntimeLogRecord(repo, { runId: run.runId, loggedAt: 200, level: 'debug', message: 'same-timestamp' });

    const logs = listRuntimeLogRecords(repo, run.runId);
    expect(logs.map((entry) => `${entry.loggedAt}:${entry.level}:${entry.message}`)).toEqual([
      '200:debug:same-timestamp',
      '200:warn:earlier',
      '300:info:later'
    ]);
  });

  it('reads and lists runs by deterministic creation order', () => {
    const repo = makeRepo();
    const runB = createRuntimeRun(repo, {
      agentId: 'agt_test',
      repoId: 'repo_test',
      objective: 'run b',
      createdAt: 20
    });
    const runA = createRuntimeRun(repo, {
      agentId: 'agt_test',
      repoId: 'repo_test',
      objective: 'run a',
      createdAt: 10
    });

    expect(listRuntimeRuns(repo).map((run) => run.runId)).toEqual([runA.runId, runB.runId]);
    expect(readRuntimeRun(repo, 'missing')).toBeNull();
  });
});
