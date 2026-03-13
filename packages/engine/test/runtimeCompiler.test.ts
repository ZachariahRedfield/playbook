import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { compilePlanArtifactToRuntime, runtimeCompilerPaths } from '../src/runtimeCompiler/index.js';

const makeRepo = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-runtime-compiler-'));

const writePlanArtifact = (repoRoot: string, filePath = '.playbook/plan.json'): string => {
  const absolutePath = path.join(repoRoot, filePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    `${JSON.stringify(
      {
        schemaVersion: '1.0',
        command: 'plan',
        tasks: [
          { id: 'task-b', ruleId: 'PB200', file: 'src/a.ts', action: 'apply deterministic fix', autoFix: true },
          { id: 'task-a', ruleId: 'PB201', file: 'src/a.ts', action: 'manual verify evidence', autoFix: false },
          { id: 'task-c', ruleId: 'PB202', file: null, action: 'inspect reports', autoFix: false }
        ]
      },
      null,
      2
    )}\n`,
    'utf8'
  );

  return absolutePath;
};

describe('runtime compiler', () => {
  it('creates a plan-backed runtime run record without executing tasks', () => {
    const repo = makeRepo();
    const planPath = writePlanArtifact(repo);

    const result = compilePlanArtifactToRuntime({
      repoRoot: repo,
      planArtifactPath: planPath,
      agentId: 'agt_engine',
      repoId: 'repo_playbook',
      objective: 'compile runtime only'
    });

    expect(result.run.state).toBe('pending');
    expect(result.tasks.every((task) => task.state === 'pending')).toBe(true);
    expect(result.run.sourcePlan.artifactPath).toBe('.playbook/plan.json');
    expect(result.run.sourcePlan.artifactId).toMatch(/^plan_/);
  });

  it('maps runtime tasks deterministically from plan ordering and produces stable ids', () => {
    const repoA = makeRepo();
    const repoB = makeRepo();
    const planA = writePlanArtifact(repoA);
    const planB = writePlanArtifact(repoB);

    const first = compilePlanArtifactToRuntime({
      repoRoot: repoA,
      planArtifactPath: planA,
      agentId: 'agt_engine',
      repoId: 'repo_playbook',
      objective: 'compile runtime only'
    });

    const second = compilePlanArtifactToRuntime({
      repoRoot: repoB,
      planArtifactPath: planB,
      agentId: 'agt_engine',
      repoId: 'repo_playbook',
      objective: 'compile runtime only'
    });

    expect(first.run.runId).toBe(second.run.runId);
    expect(first.tasks.map((task) => task.taskId)).toEqual(second.tasks.map((task) => task.taskId));
    expect(first.tasks.map((task) => task.sourcePlanTask.taskIndex)).toEqual([0, 1, 2]);
  });

  it('retains provenance from run and runtime tasks back to plan artifact and source task ids', () => {
    const repo = makeRepo();
    const planPath = writePlanArtifact(repo);

    const result = compilePlanArtifactToRuntime({
      repoRoot: repo,
      planArtifactPath: planPath,
      agentId: 'agt_engine',
      repoId: 'repo_playbook',
      objective: 'compile runtime only'
    });

    expect(result.metadata.sourcePlan).toEqual({
      artifactPath: '.playbook/plan.json',
      artifactId: result.run.sourcePlan.artifactId
    });
    expect(result.tasks.map((task) => task.sourcePlanTask.taskId)).toEqual(result.compiledTasks.map((task) => task.sourcePlanTaskId));
  });

  it('persists run, tasks, compiled tasks, metadata, and queue artifacts under runtime layout', () => {
    const repo = makeRepo();
    const planPath = writePlanArtifact(repo);

    const result = compilePlanArtifactToRuntime({
      repoRoot: repo,
      planArtifactPath: planPath,
      agentId: 'agt_engine',
      repoId: 'repo_playbook',
      objective: 'compile runtime only'
    });

    const runPath = path.join(repo, runtimeCompilerPaths.runFile(repo, result.run.runId));
    const taskPath = path.join(repo, runtimeCompilerPaths.taskFile(repo, result.run.runId, result.tasks[0].taskId));
    const queuePath = path.join(repo, runtimeCompilerPaths.queueFile(repo, result.run.runId));
    const compiledPath = path.join(repo, runtimeCompilerPaths.compiledTasksFile(repo, result.run.runId));
    const metadataPath = path.join(repo, runtimeCompilerPaths.metadataFile(repo, result.run.runId));

    expect(fs.existsSync(runPath)).toBe(true);
    expect(fs.existsSync(taskPath)).toBe(true);
    expect(fs.existsSync(queuePath)).toBe(true);
    expect(fs.existsSync(compiledPath)).toBe(true);
    expect(fs.existsSync(metadataPath)).toBe(true);

    const queue = JSON.parse(fs.readFileSync(queuePath, 'utf8')) as Array<{ priority: number }>;
    expect(queue.map((item) => item.priority)).toEqual([0, 1, 2]);
  });
});
