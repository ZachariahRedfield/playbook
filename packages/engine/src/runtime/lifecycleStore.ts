import fs from 'node:fs';
import path from 'node:path';
import {
  assertRunStateTransition,
  assertTaskStateTransition,
  controlPlaneRuntimePaths,
  createControlPlaneSchemaMetadata,
  createRunId,
  createTaskId,
  type RunRecord,
  type RunState,
  type RuntimeLogEnvelope,
  type TaskRecord,
  type TaskState
} from '@zachariahredfield/playbook-core';

type CreateRunInput = {
  agentId: string;
  repoId: string;
  objective: string;
  createdAt?: number;
};

type CreateTaskInput = {
  runId: string;
  label: string;
  createdAt?: number;
};

type TransitionRunStateInput = {
  runId: string;
  to: RunState;
  updatedAt?: number;
};

type TransitionTaskStateInput = {
  runId: string;
  taskId: string;
  to: TaskState;
  updatedAt?: number;
};

type AppendRuntimeLogInput = {
  runId: string;
  taskId?: string;
  loggedAt?: number;
  level: RuntimeLogEnvelope['level'];
  message: string;
};

const stringify = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

export type RuntimeControlPlaneStatus = {
  schemaVersion: '1.0';
  command: 'agent-status';
  runtimeRootExists: boolean;
  runCount: number;
  taskCount: number;
  logCount: number;
  latestRunId: string | null;
  latestRunState: RunState | null;
};

const normalize = (value: string): string => value.split(path.sep).join('/');

const runtimeRootPath = (repoRoot: string): string => path.join(repoRoot, controlPlaneRuntimePaths.root);
const runsRootPath = (repoRoot: string): string => path.join(repoRoot, controlPlaneRuntimePaths.runs);
const tasksRootPath = (repoRoot: string): string => path.join(repoRoot, controlPlaneRuntimePaths.tasks);
const logsRootPath = (repoRoot: string): string => path.join(repoRoot, controlPlaneRuntimePaths.logs);
const runFilePath = (repoRoot: string, runId: string): string => path.join(runsRootPath(repoRoot), `${runId}.json`);
const taskDirPath = (repoRoot: string, runId: string): string => path.join(tasksRootPath(repoRoot), runId);
const taskFilePath = (repoRoot: string, runId: string, taskId: string): string => path.join(taskDirPath(repoRoot, runId), `${taskId}.json`);
const logFilePath = (repoRoot: string, runId: string): string => path.join(logsRootPath(repoRoot), `${runId}.jsonl`);

const ensureRuntimeLayout = (repoRoot: string): void => {
  const root = runtimeRootPath(repoRoot);
  fs.mkdirSync(root, { recursive: true });
  fs.mkdirSync(path.join(repoRoot, controlPlaneRuntimePaths.agents), { recursive: true });
  fs.mkdirSync(runsRootPath(repoRoot), { recursive: true });
  fs.mkdirSync(tasksRootPath(repoRoot), { recursive: true });
  fs.mkdirSync(logsRootPath(repoRoot), { recursive: true });
  fs.mkdirSync(path.join(repoRoot, controlPlaneRuntimePaths.queue), { recursive: true });
};

const readJson = <T>(filePath: string): T => JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;

const readRunRequired = (repoRoot: string, runId: string): RunRecord => {
  const filePath = runFilePath(repoRoot, runId);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Run not found: ${runId}`);
  }
  return readJson<RunRecord>(filePath);
};

const readTaskRequired = (repoRoot: string, runId: string, taskId: string): TaskRecord => {
  const filePath = taskFilePath(repoRoot, runId, taskId);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Task not found: ${runId}/${taskId}`);
  }
  return readJson<TaskRecord>(filePath);
};

const writeRun = (repoRoot: string, run: RunRecord): RunRecord => {
  const filePath = runFilePath(repoRoot, run.runId);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, stringify(run), 'utf8');
  return run;
};

const writeTask = (repoRoot: string, task: TaskRecord): TaskRecord => {
  const filePath = taskFilePath(repoRoot, task.runId, task.taskId);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, stringify(task), 'utf8');
  return task;
};

const parseJsonl = <T>(contents: string): T[] =>
  contents
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as T);

const serializeJsonl = <T>(records: T[]): string => records.map((record) => JSON.stringify(record)).join('\n').concat(records.length > 0 ? '\n' : '');

const compareLogs = (left: RuntimeLogEnvelope, right: RuntimeLogEnvelope): number => {
  if (left.loggedAt !== right.loggedAt) {
    return left.loggedAt - right.loggedAt;
  }

  const leftKey = `${left.runId}|${left.taskId ?? ''}|${left.level}|${left.message}`;
  const rightKey = `${right.runId}|${right.taskId ?? ''}|${right.level}|${right.message}`;
  return leftKey.localeCompare(rightKey);
};

export const createRuntimeRun = (repoRoot: string, input: CreateRunInput): RunRecord => {
  ensureRuntimeLayout(repoRoot);
  const createdAt = input.createdAt ?? Date.now();
  const run: RunRecord = {
    ...createControlPlaneSchemaMetadata('run-record'),
    runId: createRunId({
      agentId: input.agentId,
      repoId: input.repoId,
      objective: input.objective,
      createdAt
    }),
    agentId: input.agentId,
    repoId: input.repoId,
    objective: input.objective,
    state: 'pending',
    createdAt,
    updatedAt: createdAt
  };

  return writeRun(repoRoot, run);
};

export const createRuntimeTask = (repoRoot: string, input: CreateTaskInput): TaskRecord => {
  ensureRuntimeLayout(repoRoot);
  readRunRequired(repoRoot, input.runId);

  const createdAt = input.createdAt ?? Date.now();
  const task: TaskRecord = {
    ...createControlPlaneSchemaMetadata('task-record'),
    taskId: createTaskId({ runId: input.runId, label: input.label }),
    runId: input.runId,
    label: input.label,
    state: 'pending',
    createdAt,
    updatedAt: createdAt
  };

  return writeTask(repoRoot, task);
};

export const transitionRuntimeRunState = (repoRoot: string, input: TransitionRunStateInput): RunRecord => {
  const current = readRunRequired(repoRoot, input.runId);
  assertRunStateTransition(current.state, input.to);

  return writeRun(repoRoot, {
    ...current,
    state: input.to,
    updatedAt: input.updatedAt ?? Date.now()
  });
};

export const transitionRuntimeTaskState = (repoRoot: string, input: TransitionTaskStateInput): TaskRecord => {
  const current = readTaskRequired(repoRoot, input.runId, input.taskId);
  assertTaskStateTransition(current.state, input.to);

  return writeTask(repoRoot, {
    ...current,
    state: input.to,
    updatedAt: input.updatedAt ?? Date.now()
  });
};

export const appendRuntimeLogRecord = (repoRoot: string, input: AppendRuntimeLogInput): RuntimeLogEnvelope => {
  ensureRuntimeLayout(repoRoot);
  readRunRequired(repoRoot, input.runId);

  if (input.taskId) {
    readTaskRequired(repoRoot, input.runId, input.taskId);
  }

  const logEntry: RuntimeLogEnvelope = {
    ...createControlPlaneSchemaMetadata('runtime-log-envelope'),
    runId: input.runId,
    taskId: input.taskId,
    loggedAt: input.loggedAt ?? Date.now(),
    level: input.level,
    message: input.message
  };

  const filePath = logFilePath(repoRoot, input.runId);
  const currentEntries = fs.existsSync(filePath) ? parseJsonl<RuntimeLogEnvelope>(fs.readFileSync(filePath, 'utf8')) : [];
  const nextEntries = [...currentEntries, logEntry].sort(compareLogs);

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, serializeJsonl(nextEntries), 'utf8');

  return logEntry;
};

export const readRuntimeRun = (repoRoot: string, runId: string): RunRecord | null => {
  const filePath = runFilePath(repoRoot, runId);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return readJson<RunRecord>(filePath);
};

export const listRuntimeRuns = (repoRoot: string): RunRecord[] => {
  const root = runsRootPath(repoRoot);
  if (!fs.existsSync(root)) {
    return [];
  }

  return fs
    .readdirSync(root)
    .filter((entry) => entry.endsWith('.json'))
    .map((entry) => readJson<RunRecord>(path.join(root, entry)))
    .sort((left, right) => (left.createdAt - right.createdAt) || left.runId.localeCompare(right.runId));
};

export const readRuntimeTask = (repoRoot: string, runId: string, taskId: string): TaskRecord | null => {
  const filePath = taskFilePath(repoRoot, runId, taskId);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return readJson<TaskRecord>(filePath);
};

export const listRuntimeTasks = (repoRoot: string, runId: string): TaskRecord[] => {
  const root = taskDirPath(repoRoot, runId);
  if (!fs.existsSync(root)) {
    return [];
  }

  return fs
    .readdirSync(root)
    .filter((entry) => entry.endsWith('.json'))
    .map((entry) => readJson<TaskRecord>(path.join(root, entry)))
    .sort((left, right) => (left.createdAt - right.createdAt) || left.taskId.localeCompare(right.taskId));
};

export const listRuntimeLogRecords = (repoRoot: string, runId: string): RuntimeLogEnvelope[] => {
  const filePath = logFilePath(repoRoot, runId);
  if (!fs.existsSync(filePath)) {
    return [];
  }

  return parseJsonl<RuntimeLogEnvelope>(fs.readFileSync(filePath, 'utf8')).sort(compareLogs);
};


export const readRuntimeControlPlaneStatus = (repoRoot: string): RuntimeControlPlaneStatus => {
  const runs = listRuntimeRuns(repoRoot);
  const runCount = runs.length;
  const taskCount = runs.reduce((sum, run) => sum + listRuntimeTasks(repoRoot, run.runId).length, 0);
  const logCount = runs.reduce((sum, run) => sum + listRuntimeLogRecords(repoRoot, run.runId).length, 0);
  const latestRun = runCount > 0 ? runs[runCount - 1] : null;

  return {
    schemaVersion: '1.0',
    command: 'agent-status',
    runtimeRootExists: fs.existsSync(runtimeRootPath(repoRoot)),
    runCount,
    taskCount,
    logCount,
    latestRunId: latestRun?.runId ?? null,
    latestRunState: latestRun?.state ?? null
  };
};

export const runtimeLifecyclePaths = {
  runtimeRootPath: (repoRoot: string): string => normalize(path.relative(repoRoot, runtimeRootPath(repoRoot))),
  runFilePath: (repoRoot: string, runId: string): string => normalize(path.relative(repoRoot, runFilePath(repoRoot, runId))),
  taskFilePath: (repoRoot: string, runId: string, taskId: string): string => normalize(path.relative(repoRoot, taskFilePath(repoRoot, runId, taskId))),
  logFilePath: (repoRoot: string, runId: string): string => normalize(path.relative(repoRoot, logFilePath(repoRoot, runId)))
};
