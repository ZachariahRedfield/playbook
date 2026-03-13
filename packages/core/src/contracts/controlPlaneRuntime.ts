export const CONTROL_PLANE_RUNTIME_SCHEMA_VERSION = '1.0.0' as const;

export const controlPlaneArtifactKinds = [
  'agent-record',
  'run-record',
  'task-record',
  'task-dependency-edge',
  'queue-item',
  'policy-decision-record',
  'runtime-log-envelope',
  'compiled-runtime-task-input',
  'plan-runtime-compilation-metadata',
  'dry-run-summary-envelope',
  'approval-requirement-summary',
  'scheduling-preview-record'
] as const;

export type ControlPlaneArtifactKind = (typeof controlPlaneArtifactKinds)[number];

export type ControlPlaneSchemaMetadata<TKind extends ControlPlaneArtifactKind = ControlPlaneArtifactKind> = {
  kind: TKind;
  schemaVersion: string;
};

export const runStates = ['pending', 'queued', 'running', 'succeeded', 'failed', 'cancelled'] as const;
export type RunState = (typeof runStates)[number];

export const taskStates = ['pending', 'queued', 'ready', 'running', 'succeeded', 'failed', 'cancelled', 'blocked'] as const;
export type TaskState = (typeof taskStates)[number];

export const approvalStates = ['not-required', 'pending', 'approved', 'rejected'] as const;
export type ApprovalState = (typeof approvalStates)[number];

export const policyStates = ['allow', 'deny', 'review-required'] as const;
export type PolicyState = (typeof policyStates)[number];

export type AgentDescriptor = {
  namespace: string;
  name: string;
  version: string;
  capabilities: string[];
};

export type AgentRecord = ControlPlaneSchemaMetadata<'agent-record'> & {
  agentId: string;
  descriptor: AgentDescriptor;
  createdAt: number;
};

export type RunRecord = ControlPlaneSchemaMetadata<'run-record'> & {
  runId: string;
  agentId: string;
  repoId: string;
  objective: string;
  state: RunState;
  createdAt: number;
  updatedAt: number;
};

export type TaskRecord = ControlPlaneSchemaMetadata<'task-record'> & {
  taskId: string;
  runId: string;
  label: string;
  state: TaskState;
  createdAt: number;
  updatedAt: number;
};

export type TaskDependencyEdge = ControlPlaneSchemaMetadata<'task-dependency-edge'> & {
  runId: string;
  fromTaskId: string;
  toTaskId: string;
};

export type QueueItem = ControlPlaneSchemaMetadata<'queue-item'> & {
  runId: string;
  taskId: string;
  enqueuedAt: number;
  priority: number;
};

export type PolicyDecisionRecord = ControlPlaneSchemaMetadata<'policy-decision-record'> & {
  runId: string;
  taskId?: string;
  policyState: PolicyState;
  approvalState: ApprovalState;
  reason: string;
  decidedAt: number;
};

export type RuntimeLogEnvelope = ControlPlaneSchemaMetadata<'runtime-log-envelope'> & {
  runId: string;
  taskId?: string;
  loggedAt: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
};

export type PlanTaskContractInput = {
  ruleId: string;
  file: string | null;
  action: string;
  autoFix: boolean;
};

export const runtimeTaskKinds = ['apply-fix', 'manual-remediation', 'observe-only'] as const;
export type RuntimeTaskKind = (typeof runtimeTaskKinds)[number];

export const runtimeTaskMutabilityClasses = ['mutating', 'read-only'] as const;
export type RuntimeTaskMutabilityClass = (typeof runtimeTaskMutabilityClasses)[number];

export type CompiledRuntimeTaskInput = ControlPlaneSchemaMetadata<'compiled-runtime-task-input'> & {
  runId: string;
  runtimeTaskId: string;
  sourcePlanTaskId: string;
  sourcePlanTaskIndex: number;
  ruleId: string;
  file: string | null;
  action: string;
  taskKind: RuntimeTaskKind;
  mutabilityClass: RuntimeTaskMutabilityClass;
  dependencies: string[];
  provenance: {
    planTaskId: string;
    planTaskIndex: number;
  };
};

export type PlanRuntimeCompilationMetadata = ControlPlaneSchemaMetadata<'plan-runtime-compilation-metadata'> & {
  runId: string;
  planDigest: string;
  planTaskCount: number;
  compiledTaskCount: number;
  derivedDependencyEdgeCount: number;
  createdAt: number;
};

export type ApprovalRequirementSummary = ControlPlaneSchemaMetadata<'approval-requirement-summary'> & {
  runId: string;
  approvalRequired: boolean;
  approvalRequiredTaskIds: string[];
  approvalRequiredTaskCount: number;
  reason: 'manual-remediation-tasks-present' | 'none';
};

export type SchedulingPreviewRecord = ControlPlaneSchemaMetadata<'scheduling-preview-record'> & {
  runId: string;
  runtimeTaskId: string;
  sequence: number;
  dependencyCount: number;
  blockedByTaskIds: string[];
  ready: boolean;
};

export type DryRunSummaryEnvelope = ControlPlaneSchemaMetadata<'dry-run-summary-envelope'> & {
  runId: string;
  metadata: PlanRuntimeCompilationMetadata;
  approval: ApprovalRequirementSummary;
  scheduling: SchedulingPreviewRecord[];
  tasks: CompiledRuntimeTaskInput[];
};

export const controlPlaneRuntimePaths = {
  root: '.playbook/runtime',
  agents: '.playbook/runtime/agents',
  runs: '.playbook/runtime/runs',
  tasks: '.playbook/runtime/tasks',
  compiledTasks: '.playbook/runtime/tasks/compiled',
  logs: '.playbook/runtime/logs',
  queue: '.playbook/runtime/queue',
  dryRuns: '.playbook/runtime/dry-runs'
} as const;

const stableSerialize = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, nestedValue]) => `${JSON.stringify(key)}:${stableSerialize(nestedValue)}`);
    return `{${entries.join(',')}}`;
  }

  return JSON.stringify(value);
};

const stableHash = (value: string): string => {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
};

export const createControlPlaneSchemaMetadata = <TKind extends ControlPlaneArtifactKind>(kind: TKind): ControlPlaneSchemaMetadata<TKind> => ({
  kind,
  schemaVersion: CONTROL_PLANE_RUNTIME_SCHEMA_VERSION
});

export const createAgentId = (input: { repoId: string; descriptor: AgentDescriptor }): string => {
  const canonicalRepresentation = stableSerialize({
    repoId: input.repoId,
    namespace: input.descriptor.namespace,
    name: input.descriptor.name,
    version: input.descriptor.version,
    capabilities: [...new Set(input.descriptor.capabilities)].sort()
  });

  return `agt_${stableHash(canonicalRepresentation)}`;
};

export const createRunId = (input: { agentId: string; repoId: string; objective: string; createdAt: number }): string =>
  `run_${stableHash(stableSerialize(input))}`;

export const createTaskId = (input: { runId: string; label: string }): string => `tsk_${stableHash(stableSerialize(input))}`;

export const createPlanTaskId = (input: { task: PlanTaskContractInput; index: number }): string =>
  `plt_${stableHash(stableSerialize({ index: input.index, ...input.task }))}`;

const classifyRuntimeTaskKind = (task: PlanTaskContractInput): RuntimeTaskKind => {
  if (task.autoFix) return 'apply-fix';
  const normalizedAction = task.action.trim().toLowerCase();
  if (normalizedAction.startsWith('verify') || normalizedAction.startsWith('audit') || normalizedAction.startsWith('inspect')) {
    return 'observe-only';
  }

  return 'manual-remediation';
};

const classifyMutability = (task: PlanTaskContractInput): RuntimeTaskMutabilityClass => (task.autoFix ? 'mutating' : 'read-only');

export const compilePlanTaskToRuntimeTask = (input: {
  runId: string;
  task: PlanTaskContractInput;
  taskIndex: number;
  dependencyTaskIds: string[];
}): CompiledRuntimeTaskInput => {
  const sourcePlanTaskId = createPlanTaskId({ task: input.task, index: input.taskIndex });

  return {
    ...createControlPlaneSchemaMetadata('compiled-runtime-task-input'),
    runId: input.runId,
    runtimeTaskId: createTaskId({ runId: input.runId, label: sourcePlanTaskId }),
    sourcePlanTaskId,
    sourcePlanTaskIndex: input.taskIndex,
    ruleId: input.task.ruleId,
    file: input.task.file,
    action: input.task.action,
    taskKind: classifyRuntimeTaskKind(input.task),
    mutabilityClass: classifyMutability(input.task),
    dependencies: [...new Set(input.dependencyTaskIds)].sort(),
    provenance: {
      planTaskId: sourcePlanTaskId,
      planTaskIndex: input.taskIndex
    }
  };
};

export const compilePlanToRuntimeDryRun = (input: {
  runId: string;
  planTasks: PlanTaskContractInput[];
  createdAt: number;
}): DryRunSummaryEnvelope => {
  const planTaskIdsByFile = new Map<string, string>();
  const compiledTasks: CompiledRuntimeTaskInput[] = input.planTasks.map((task, index) => {
    const priorDependency = task.file ? planTaskIdsByFile.get(task.file) : undefined;
    const compiledTask = compilePlanTaskToRuntimeTask({
      runId: input.runId,
      task,
      taskIndex: index,
      dependencyTaskIds: priorDependency ? [priorDependency] : []
    });

    if (task.file) {
      planTaskIdsByFile.set(task.file, compiledTask.runtimeTaskId);
    }

    return compiledTask;
  });

  const approvalRequiredTaskIds = compiledTasks
    .filter((task) => task.taskKind === 'manual-remediation')
    .map((task) => task.runtimeTaskId)
    .sort();

  const scheduling = compiledTasks.map((task, index) => ({
    ...createControlPlaneSchemaMetadata('scheduling-preview-record'),
    runId: input.runId,
    runtimeTaskId: task.runtimeTaskId,
    sequence: index,
    dependencyCount: task.dependencies.length,
    blockedByTaskIds: [...task.dependencies],
    ready: task.dependencies.length === 0
  }));

  const metadata: PlanRuntimeCompilationMetadata = {
    ...createControlPlaneSchemaMetadata('plan-runtime-compilation-metadata'),
    runId: input.runId,
    planDigest: `pln_${stableHash(stableSerialize(input.planTasks))}`,
    planTaskCount: input.planTasks.length,
    compiledTaskCount: compiledTasks.length,
    derivedDependencyEdgeCount: compiledTasks.reduce((total, task) => total + task.dependencies.length, 0),
    createdAt: input.createdAt
  };

  const approval: ApprovalRequirementSummary = {
    ...createControlPlaneSchemaMetadata('approval-requirement-summary'),
    runId: input.runId,
    approvalRequired: approvalRequiredTaskIds.length > 0,
    approvalRequiredTaskIds,
    approvalRequiredTaskCount: approvalRequiredTaskIds.length,
    reason: approvalRequiredTaskIds.length > 0 ? 'manual-remediation-tasks-present' : 'none'
  };

  return {
    ...createControlPlaneSchemaMetadata('dry-run-summary-envelope'),
    runId: input.runId,
    metadata,
    approval,
    scheduling,
    tasks: compiledTasks
  };
};

const validRunStateTransitions: Record<RunState, ReadonlySet<RunState>> = {
  pending: new Set(['queued', 'cancelled']),
  queued: new Set(['running', 'cancelled']),
  running: new Set(['succeeded', 'failed', 'cancelled']),
  succeeded: new Set(),
  failed: new Set(),
  cancelled: new Set()
};

const validTaskStateTransitions: Record<TaskState, ReadonlySet<TaskState>> = {
  pending: new Set(['queued', 'blocked', 'cancelled']),
  queued: new Set(['ready', 'blocked', 'cancelled']),
  ready: new Set(['running', 'blocked', 'cancelled']),
  running: new Set(['succeeded', 'failed', 'blocked', 'cancelled']),
  blocked: new Set(['queued', 'ready', 'cancelled']),
  succeeded: new Set(),
  failed: new Set(),
  cancelled: new Set()
};

const validApprovalStateTransitions: Record<ApprovalState, ReadonlySet<ApprovalState>> = {
  'not-required': new Set(['approved']),
  pending: new Set(['approved', 'rejected']),
  approved: new Set(),
  rejected: new Set()
};

export const assertRunStateTransition = (from: RunState, to: RunState): void => {
  if (from === to) return;
  if (!validRunStateTransitions[from].has(to)) throw new Error(`Invalid run state transition: ${from} -> ${to}`);
};

export const assertTaskStateTransition = (from: TaskState, to: TaskState): void => {
  if (from === to) return;
  if (!validTaskStateTransitions[from].has(to)) throw new Error(`Invalid task state transition: ${from} -> ${to}`);
};

export const assertApprovalStateTransition = (from: ApprovalState, to: ApprovalState): void => {
  if (from === to) return;
  if (!validApprovalStateTransitions[from].has(to)) throw new Error(`Invalid approval state transition: ${from} -> ${to}`);
};
