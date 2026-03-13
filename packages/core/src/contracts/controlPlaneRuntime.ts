export const CONTROL_PLANE_RUNTIME_SCHEMA_VERSION = '1.0.0' as const;

export const controlPlaneArtifactKinds = [
  'agent-record',
  'run-record',
  'task-record',
  'task-dependency-edge',
  'queue-item',
  'policy-decision-record',
  'runtime-log-envelope'
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

export const controlPlaneRuntimePaths = {
  root: '.playbook/runtime',
  agents: '.playbook/runtime/agents',
  runs: '.playbook/runtime/runs',
  tasks: '.playbook/runtime/tasks',
  logs: '.playbook/runtime/logs',
  queue: '.playbook/runtime/queue'
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
