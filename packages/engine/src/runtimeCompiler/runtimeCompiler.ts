import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  compilePlanTaskToRuntimeTask,
  controlPlaneRuntimePaths,
  createControlPlaneSchemaMetadata,
  createRunId,
  type CompiledRuntimeTaskInput,
  type PlanRuntimeCompilationMetadata,
  type PlanTaskContractInput,
  type QueueItem,
  type RunRecord,
  type TaskRecord
} from '@zachariahredfield/playbook-core';
import { parsePlanArtifact } from '../execution/index.js';

export type CompilePlanArtifactToRuntimeInput = {
  repoRoot: string;
  planArtifactPath: string;
  agentId: string;
  repoId: string;
  objective: string;
};

export type RuntimeCompiledRunRecord = RunRecord & {
  sourcePlan: {
    artifactPath: string;
    artifactId: string;
    taskCount: number;
  };
};

export type RuntimeCompiledTaskRecord = TaskRecord & {
  sourcePlanTask: {
    taskId: string;
    taskIndex: number;
  };
};

export type CompilePlanArtifactToRuntimeResult = {
  run: RuntimeCompiledRunRecord;
  tasks: RuntimeCompiledTaskRecord[];
  queue: QueueItem[];
  compiledTasks: CompiledRuntimeTaskInput[];
  metadata: PlanRuntimeCompilationMetadata & {
    sourcePlan: {
      artifactPath: string;
      artifactId: string;
    };
  };
};

const stringify = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

const normalize = (value: string): string => value.split(path.sep).join('/');

const stableSerialize = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableSerialize(entry)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableSerialize(entry)}`);

    return `{${entries.join(',')}}`;
  }

  return JSON.stringify(value);
};

const stableHex = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');

const relativePath = (repoRoot: string, targetPath: string): string => normalize(path.relative(repoRoot, targetPath));

const writeJson = (targetPath: string, payload: unknown): void => {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, stringify(payload), 'utf8');
};

const ensureLayout = (repoRoot: string): void => {
  fs.mkdirSync(path.join(repoRoot, controlPlaneRuntimePaths.root), { recursive: true });
  fs.mkdirSync(path.join(repoRoot, controlPlaneRuntimePaths.runs), { recursive: true });
  fs.mkdirSync(path.join(repoRoot, controlPlaneRuntimePaths.tasks), { recursive: true });
  fs.mkdirSync(path.join(repoRoot, controlPlaneRuntimePaths.compiledTasks), { recursive: true });
  fs.mkdirSync(path.join(repoRoot, controlPlaneRuntimePaths.queue), { recursive: true });
};

const toContractTask = (task: { ruleId: string; file: string | null; action: string; autoFix: boolean }): PlanTaskContractInput => ({
  ruleId: task.ruleId,
  file: task.file,
  action: task.action,
  autoFix: task.autoFix
});

const toDeterministicTimestamp = (seed: string): number => {
  const hash = stableHex(seed).slice(0, 12);
  return Number.parseInt(hash, 16);
};

const mapTasks = (runId: string, tasks: Array<{ id: string; ruleId: string; file: string | null; action: string; autoFix: boolean }>): CompiledRuntimeTaskInput[] => {
  const lastTaskByFile = new Map<string, string>();

  return tasks.map((task, index) => {
    const dependency = task.file ? lastTaskByFile.get(task.file) : undefined;
    const compiled = compilePlanTaskToRuntimeTask({
      runId,
      task: toContractTask(task),
      taskIndex: index,
      dependencyTaskIds: dependency ? [dependency] : []
    });

    if (task.file) {
      lastTaskByFile.set(task.file, compiled.runtimeTaskId);
    }

    return compiled;
  });
};

export const runtimeCompilerPaths = {
  runFile: (repoRoot: string, runId: string): string => relativePath(repoRoot, path.join(repoRoot, controlPlaneRuntimePaths.runs, `${runId}.json`)),
  taskFile: (repoRoot: string, runId: string, taskId: string): string =>
    relativePath(repoRoot, path.join(repoRoot, controlPlaneRuntimePaths.tasks, runId, `${taskId}.json`)),
  queueFile: (repoRoot: string, runId: string): string => relativePath(repoRoot, path.join(repoRoot, controlPlaneRuntimePaths.queue, `${runId}.json`)),
  compiledTasksFile: (repoRoot: string, runId: string): string =>
    relativePath(repoRoot, path.join(repoRoot, controlPlaneRuntimePaths.compiledTasks, `${runId}.json`)),
  metadataFile: (repoRoot: string, runId: string): string => relativePath(repoRoot, path.join(repoRoot, controlPlaneRuntimePaths.root, `${runId}.compilation.json`))
};

export const compilePlanArtifactToRuntime = (input: CompilePlanArtifactToRuntimeInput): CompilePlanArtifactToRuntimeResult => {
  ensureLayout(input.repoRoot);

  const absolutePlanPath = path.isAbsolute(input.planArtifactPath) ? input.planArtifactPath : path.join(input.repoRoot, input.planArtifactPath);
  const artifactPayload = JSON.parse(fs.readFileSync(absolutePlanPath, 'utf8')) as unknown;
  const parsedPlan = parsePlanArtifact(artifactPayload);
  const orderedTasks = parsedPlan.tasks
    .map((task, index) => ({ ...task, index }))
    .sort((left, right) => (left.index - right.index) || left.id.localeCompare(right.id));

  const sourcePlanPath = relativePath(input.repoRoot, absolutePlanPath);
  const sourcePlanId = `plan_${stableHex(stableSerialize({ path: sourcePlanPath, tasks: orderedTasks.map((task) => task.id) })).slice(0, 12)}`;
  const createdAt = toDeterministicTimestamp(stableSerialize({ sourcePlanId, sourcePlanPath }));
  const runId = createRunId({
    agentId: input.agentId,
    repoId: input.repoId,
    objective: input.objective,
    createdAt
  });

  const compiledTasks = mapTasks(runId, orderedTasks);
  const runtimeTasks = compiledTasks
    .map((task): RuntimeCompiledTaskRecord => ({
      ...createControlPlaneSchemaMetadata('task-record'),
      taskId: task.runtimeTaskId,
      runId,
      label: task.action,
      state: 'pending',
      createdAt,
      updatedAt: createdAt,
      sourcePlanTask: {
        taskId: task.sourcePlanTaskId,
        taskIndex: task.sourcePlanTaskIndex
      }
    }))
    .sort((left, right) => (left.sourcePlanTask.taskIndex - right.sourcePlanTask.taskIndex) || left.taskId.localeCompare(right.taskId));

  const queue: QueueItem[] = runtimeTasks.map((task, sequence) => ({
    ...createControlPlaneSchemaMetadata('queue-item'),
    runId,
    taskId: task.taskId,
    enqueuedAt: createdAt,
    priority: sequence
  }));

  const metadata: CompilePlanArtifactToRuntimeResult['metadata'] = {
    ...createControlPlaneSchemaMetadata('plan-runtime-compilation-metadata'),
    runId,
    planDigest: `pln_${stableHex(stableSerialize(orderedTasks.map(({ index, ...task }) => ({ ...task, index })))).slice(0, 12)}`,
    planTaskCount: orderedTasks.length,
    compiledTaskCount: runtimeTasks.length,
    derivedDependencyEdgeCount: compiledTasks.reduce((sum, task) => sum + task.dependencies.length, 0),
    createdAt,
    sourcePlan: {
      artifactPath: sourcePlanPath,
      artifactId: sourcePlanId
    }
  };

  const run: RuntimeCompiledRunRecord = {
    ...createControlPlaneSchemaMetadata('run-record'),
    runId,
    agentId: input.agentId,
    repoId: input.repoId,
    objective: input.objective,
    state: 'pending',
    createdAt,
    updatedAt: createdAt,
    sourcePlan: {
      artifactPath: sourcePlanPath,
      artifactId: sourcePlanId,
      taskCount: orderedTasks.length
    }
  };

  writeJson(path.join(input.repoRoot, runtimeCompilerPaths.runFile(input.repoRoot, runId)), run);
  for (const task of runtimeTasks) {
    writeJson(path.join(input.repoRoot, runtimeCompilerPaths.taskFile(input.repoRoot, runId, task.taskId)), task);
  }
  writeJson(path.join(input.repoRoot, runtimeCompilerPaths.queueFile(input.repoRoot, runId)), queue);
  writeJson(path.join(input.repoRoot, runtimeCompilerPaths.compiledTasksFile(input.repoRoot, runId)), compiledTasks);
  writeJson(path.join(input.repoRoot, runtimeCompilerPaths.metadataFile(input.repoRoot, runId)), metadata);

  return {
    run,
    tasks: runtimeTasks,
    queue,
    compiledTasks,
    metadata
  };
};
