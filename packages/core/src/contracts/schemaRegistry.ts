import { MEMORY_CONTRACT_SCHEMA_VERSION, memoryArtifactPaths } from './memory.js';
import { CONTROL_PLANE_RUNTIME_SCHEMA_VERSION, controlPlaneRuntimePaths } from './controlPlaneRuntime.js';

export type RegisteredSchemaContract = {
  id: string;
  version: string;
  path: string;
  kind: 'memory-artifact' | 'command-output';
};

export const memoryArtifactSchemaRegistry: RegisteredSchemaContract[] = [
  { id: 'memory-event', version: MEMORY_CONTRACT_SCHEMA_VERSION, path: `${memoryArtifactPaths.runtimeEvents}/*.json`, kind: 'memory-artifact' },
  {
    id: 'candidate-knowledge-record',
    version: MEMORY_CONTRACT_SCHEMA_VERSION,
    path: `${memoryArtifactPaths.candidateKnowledge}/*.json`,
    kind: 'memory-artifact'
  },
  {
    id: 'promoted-knowledge-record',
    version: MEMORY_CONTRACT_SCHEMA_VERSION,
    path: `${memoryArtifactPaths.promotedKnowledge}/*.json`,
    kind: 'memory-artifact'
  },
  {
    id: 'retired-knowledge-record',
    version: MEMORY_CONTRACT_SCHEMA_VERSION,
    path: `${memoryArtifactPaths.promotedKnowledge}/*.json`,
    kind: 'memory-artifact'
  },
  { id: 'memory-replay-result', version: '1.0', path: `${memoryArtifactPaths.replayOutputs}/*.json`, kind: 'memory-artifact' },
  { id: 'knowledge-candidate-output', version: '1.0', path: '.playbook/knowledge/candidates.json', kind: 'memory-artifact' },
  { id: 'transfer-plans', version: '1.0', path: '.playbook/transfer-plans.json', kind: 'memory-artifact' },
  { id: 'transfer-readiness', version: '1.0', path: '.playbook/transfer-readiness.json', kind: 'memory-artifact' },
  { id: 'agent-record', version: CONTROL_PLANE_RUNTIME_SCHEMA_VERSION, path: `${controlPlaneRuntimePaths.agents}/*.json`, kind: 'memory-artifact' },
  { id: 'run-record', version: CONTROL_PLANE_RUNTIME_SCHEMA_VERSION, path: `${controlPlaneRuntimePaths.runs}/*.json`, kind: 'memory-artifact' },
  { id: 'task-record', version: CONTROL_PLANE_RUNTIME_SCHEMA_VERSION, path: `${controlPlaneRuntimePaths.tasks}/*.json`, kind: 'memory-artifact' },
  {
    id: 'task-dependency-edge',
    version: CONTROL_PLANE_RUNTIME_SCHEMA_VERSION,
    path: `${controlPlaneRuntimePaths.tasks}/dependencies/*.json`,
    kind: 'memory-artifact'
  },
  { id: 'queue-item', version: CONTROL_PLANE_RUNTIME_SCHEMA_VERSION, path: `${controlPlaneRuntimePaths.queue}/*.json`, kind: 'memory-artifact' },
  {
    id: 'policy-decision-record',
    version: CONTROL_PLANE_RUNTIME_SCHEMA_VERSION,
    path: `${controlPlaneRuntimePaths.runs}/*/policy-decisions/*.json`,
    kind: 'memory-artifact'
  },
  { id: 'runtime-log-envelope', version: CONTROL_PLANE_RUNTIME_SCHEMA_VERSION, path: `${controlPlaneRuntimePaths.logs}/*.jsonl`, kind: 'memory-artifact' },
  {
    id: 'compiled-runtime-task-input',
    version: CONTROL_PLANE_RUNTIME_SCHEMA_VERSION,
    path: `${controlPlaneRuntimePaths.compiledTasks}/*.json`,
    kind: 'memory-artifact'
  },
  {
    id: 'plan-runtime-compilation-metadata',
    version: CONTROL_PLANE_RUNTIME_SCHEMA_VERSION,
    path: `${controlPlaneRuntimePaths.dryRuns}/*/metadata.json`,
    kind: 'memory-artifact'
  },
  {
    id: 'dry-run-summary-envelope',
    version: CONTROL_PLANE_RUNTIME_SCHEMA_VERSION,
    path: `${controlPlaneRuntimePaths.dryRuns}/*/summary.json`,
    kind: 'memory-artifact'
  },
  {
    id: 'approval-requirement-summary',
    version: CONTROL_PLANE_RUNTIME_SCHEMA_VERSION,
    path: `${controlPlaneRuntimePaths.dryRuns}/*/approval.json`,
    kind: 'memory-artifact'
  },
  {
    id: 'scheduling-preview-record',
    version: CONTROL_PLANE_RUNTIME_SCHEMA_VERSION,
    path: `${controlPlaneRuntimePaths.dryRuns}/*/schedule/*.json`,
    kind: 'memory-artifact'
  },
] as const;

export const additiveCommandFieldSchemaRegistry: RegisteredSchemaContract[] = [
  { id: 'query.memoryKnowledge', version: '1.0', path: 'schema://cli/query', kind: 'command-output' },
  { id: 'knowledge', version: '1.0', path: 'packages/contracts/src/knowledge.schema.json', kind: 'command-output' },
  { id: 'pattern-graph', version: '1.0', path: 'packages/contracts/src/pattern-graph.schema.json', kind: 'command-output' },
  { id: 'cross-repo-candidates', version: '1.0', path: 'packages/contracts/src/cross-repo-candidates.schema.json', kind: 'command-output' },
  { id: 'pattern-portability', version: '1.0', path: 'packages/contracts/src/pattern-portability.schema.json', kind: 'command-output' },
  { id: 'transfer-plans', version: '1.0', path: 'packages/contracts/src/transfer-plans.schema.json', kind: 'command-output' },
  { id: 'transfer-readiness', version: '1.0', path: 'packages/contracts/src/transfer-readiness.schema.json', kind: 'command-output' },
  { id: 'task-execution-profile', version: '1.0', path: 'packages/contracts/src/task-execution-profile.schema.json', kind: 'command-output' },
  { id: 'execution-plan', version: '1.0', path: 'packages/contracts/src/execution-plan.schema.json', kind: 'command-output' },
  { id: 'execution-receipt', version: '1.0', path: 'packages/contracts/src/execution-receipt.schema.json', kind: 'command-output' },
  { id: 'execution-updated-state', version: '1.0', path: 'packages/contracts/src/execution-updated-state.schema.json', kind: 'command-output' },
  { id: 'workflow-promotion', version: '1.0', path: 'packages/contracts/src/workflow-promotion.schema.json', kind: 'command-output' },
  { id: 'workset-plan', version: '1.0', path: 'packages/contracts/src/workset-plan.schema.json', kind: 'command-output' },
  { id: 'lane-state', version: '1.0', path: 'packages/contracts/src/lane-state.schema.json', kind: 'command-output' },
  { id: 'learning-state', version: '1.0', path: 'packages/contracts/src/learning-state.schema.json', kind: 'command-output' },
  { id: 'policy-evaluation', version: '1.0', path: 'packages/contracts/src/policy-evaluation.schema.json', kind: 'command-output' },
  { id: 'explain.memoryKnowledge', version: '1.0', path: 'schema://cli/explain', kind: 'command-output' },
  { id: 'plan.tasks[].advisory.outcomeLearning', version: '1.0', path: 'schema://cli/plan', kind: 'command-output' },
  { id: 'analyze-pr.preventionGuidance', version: '1.0', path: 'schema://cli/analyze-pr', kind: 'command-output' },
  { id: 'analyze-pr.context.sources[].promoted-knowledge', version: '1.0', path: 'schema://cli/analyze-pr', kind: 'command-output' }
] as const;

export const getContractsSchemaRegistry = (): { memoryArtifacts: RegisteredSchemaContract[]; commandOutputs: RegisteredSchemaContract[] } => ({
  memoryArtifacts: [...memoryArtifactSchemaRegistry],
  commandOutputs: [...additiveCommandFieldSchemaRegistry]
});
