import fs from 'node:fs';
import path from 'node:path';
import { controlPlaneRuntimePaths, type CompiledRuntimeTaskInput, type QueueItem } from '@zachariahredfield/playbook-core';
import { classifyQueueItems, createQueueItem, hasRetryBudgetRemaining, type SchedulerQueueItem } from '../scheduler/index.js';

type QueueRuntimeState = 'pending' | 'completed';

type QueueRuntimeItem = QueueItem & {
  attempts?: number;
  retryBudget?: number;
  state?: QueueRuntimeState;
  approvalState?: 'not-required' | 'pending' | 'approved' | 'rejected';
};

export type PreviewBlockedReasonCode = 'approval-required' | 'dependency-pending' | 'retry-budget-exhausted';

export type PreviewTaskRecord = {
  runtimeTaskId: string;
  sourcePlanTaskId: string;
  sourcePlanTaskIndex: number;
  taskKind: CompiledRuntimeTaskInput['taskKind'];
  mutabilityClass: CompiledRuntimeTaskInput['mutabilityClass'];
  priority: number;
  attempts: number;
  retryBudget: number;
  dependencies: string[];
};

export type PreviewReadyTask = PreviewTaskRecord;

export type PreviewBlockedTask = PreviewTaskRecord & {
  blockedReasons: PreviewBlockedReasonCode[];
  blockedByTaskIds: string[];
};

export type PreviewCompletedTask = PreviewTaskRecord;

export type RuntimeDryRunSchedulingPreview = {
  runId: string;
  deterministicNextTaskOrder: string[];
  nextTaskId: string | null;
  ready: PreviewReadyTask[];
  blocked: PreviewBlockedTask[];
  completed: PreviewCompletedTask[];
  blockedReasonSummary: Record<PreviewBlockedReasonCode, number>;
};

const DEFAULT_PRIORITY = 0;
const DEFAULT_RETRY_BUDGET = 0;
const DEFAULT_ATTEMPTS = 0;

const readJson = <T>(filePath: string): T => JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;

const compareCompiledTasks = (left: CompiledRuntimeTaskInput, right: CompiledRuntimeTaskInput): number =>
  (left.sourcePlanTaskIndex - right.sourcePlanTaskIndex) || left.runtimeTaskId.localeCompare(right.runtimeTaskId);

const compareTaskRecords = (left: PreviewTaskRecord, right: PreviewTaskRecord): number => {
  if (left.priority !== right.priority) {
    return right.priority - left.priority;
  }

  return left.runtimeTaskId.localeCompare(right.runtimeTaskId);
};

const classifyBlockedReasons = (
  item: SchedulerQueueItem,
  approvalRequired: boolean,
  completedTaskIds: ReadonlySet<string>
): { blockedReasons: PreviewBlockedReasonCode[]; blockedByTaskIds: string[] } => {
  const blockedReasons: PreviewBlockedReasonCode[] = [];

  if (!hasRetryBudgetRemaining(item)) {
    blockedReasons.push('retry-budget-exhausted');
  }

  const blockedByTaskIds = item.dependsOn.filter((dependencyId) => !completedTaskIds.has(dependencyId));
  if (blockedByTaskIds.length > 0) {
    blockedReasons.push('dependency-pending');
  }

  if (approvalRequired) {
    blockedReasons.push('approval-required');
  }

  return {
    blockedReasons,
    blockedByTaskIds
  };
};

const isApprovalRequired = (task: CompiledRuntimeTaskInput, queueItem?: QueueRuntimeItem): boolean => {
  if (queueItem?.approvalState === 'approved' || queueItem?.approvalState === 'not-required') {
    return false;
  }

  if (queueItem?.approvalState === 'pending' || queueItem?.approvalState === 'rejected') {
    return true;
  }

  return task.taskKind === 'manual-remediation';
};

export const loadCompiledRuntimeTasks = (repoRoot: string, runId: string): CompiledRuntimeTaskInput[] => {
  const root = path.join(repoRoot, controlPlaneRuntimePaths.compiledTasks);
  if (!fs.existsSync(root)) {
    return [];
  }

  return fs
    .readdirSync(root)
    .filter((entry) => entry.endsWith('.json'))
    .map((entry) => readJson<CompiledRuntimeTaskInput>(path.join(root, entry)))
    .filter((task) => task.runId === runId)
    .sort(compareCompiledTasks);
};

export const loadRuntimeQueueItems = (repoRoot: string, runId: string): QueueRuntimeItem[] => {
  const root = path.join(repoRoot, controlPlaneRuntimePaths.queue);
  if (!fs.existsSync(root)) {
    return [];
  }

  return fs
    .readdirSync(root)
    .filter((entry) => entry.endsWith('.json'))
    .map((entry) => readJson<QueueRuntimeItem>(path.join(root, entry)))
    .filter((item) => item.runId === runId)
    .sort((left, right) => (left.enqueuedAt - right.enqueuedAt) || left.taskId.localeCompare(right.taskId));
};

export const previewDryRunScheduling = (repoRoot: string, runId: string): RuntimeDryRunSchedulingPreview => {
  const compiledTasks = loadCompiledRuntimeTasks(repoRoot, runId);
  const queueItems = loadRuntimeQueueItems(repoRoot, runId);
  const queueByTaskId = new Map(queueItems.map((item) => [item.taskId, item]));

  const schedulerItems = compiledTasks.map((task, index) => {
    const queueItem = queueByTaskId.get(task.runtimeTaskId);
    const fallbackPriority = compiledTasks.length - index;

    return createQueueItem({
      taskId: task.runtimeTaskId,
      priority: queueItem?.priority ?? fallbackPriority ?? DEFAULT_PRIORITY,
      dependsOn: task.dependencies,
      retryBudget: queueItem?.retryBudget ?? DEFAULT_RETRY_BUDGET,
      attempts: queueItem?.attempts ?? DEFAULT_ATTEMPTS,
      state: queueItem?.state ?? 'pending'
    });
  });

  const classification = classifyQueueItems(schedulerItems);
  const completedTaskIds = new Set(classification.completed.map((item) => item.taskId));

  const taskById = new Map(compiledTasks.map((task) => [task.runtimeTaskId, task]));
  const toTaskRecord = (item: SchedulerQueueItem): PreviewTaskRecord => {
    const task = taskById.get(item.taskId);
    if (!task) {
      throw new Error(`Missing compiled runtime task for queue item: ${item.taskId}`);
    }

    return {
      runtimeTaskId: task.runtimeTaskId,
      sourcePlanTaskId: task.sourcePlanTaskId,
      sourcePlanTaskIndex: task.sourcePlanTaskIndex,
      taskKind: task.taskKind,
      mutabilityClass: task.mutabilityClass,
      priority: item.priority,
      attempts: item.attempts,
      retryBudget: item.retryBudget,
      dependencies: [...item.dependsOn]
    };
  };

  const blocked: PreviewBlockedTask[] = [];
  const ready: PreviewReadyTask[] = [];

  for (const item of classification.ready) {
    const task = taskById.get(item.taskId);
    if (!task) {
      continue;
    }

    const queueItem = queueByTaskId.get(item.taskId);
    const approvalRequired = isApprovalRequired(task, queueItem);

    if (approvalRequired) {
      const blockedReason = classifyBlockedReasons(item, true, completedTaskIds);
      blocked.push({
        ...toTaskRecord(item),
        blockedReasons: blockedReason.blockedReasons,
        blockedByTaskIds: blockedReason.blockedByTaskIds
      });
      continue;
    }

    ready.push(toTaskRecord(item));
  }

  for (const item of classification.blocked) {
    const task = taskById.get(item.taskId);
    if (!task) {
      continue;
    }

    const queueItem = queueByTaskId.get(item.taskId);
    const blockedReason = classifyBlockedReasons(item, isApprovalRequired(task, queueItem), completedTaskIds);

    blocked.push({
      ...toTaskRecord(item),
      blockedReasons: blockedReason.blockedReasons,
      blockedByTaskIds: blockedReason.blockedByTaskIds
    });
  }

  const completed = classification.completed.map((item) => toTaskRecord(item)).sort(compareTaskRecords);
  const sortedReady = [...ready].sort(compareTaskRecords);
  const sortedBlocked = [...blocked].sort(compareTaskRecords);

  const blockedReasonSummary: Record<PreviewBlockedReasonCode, number> = {
    'approval-required': 0,
    'dependency-pending': 0,
    'retry-budget-exhausted': 0
  };

  for (const entry of sortedBlocked) {
    for (const reason of entry.blockedReasons) {
      blockedReasonSummary[reason] += 1;
    }
  }

  return {
    runId,
    deterministicNextTaskOrder: sortedReady.map((task) => task.runtimeTaskId),
    nextTaskId: sortedReady.at(0)?.runtimeTaskId ?? null,
    ready: sortedReady,
    blocked: sortedBlocked,
    completed,
    blockedReasonSummary
  };
};

export type { QueueRuntimeItem };
