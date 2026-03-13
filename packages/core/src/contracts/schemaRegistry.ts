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
  { id: 'runtime-log-envelope', version: CONTROL_PLANE_RUNTIME_SCHEMA_VERSION, path: `${controlPlaneRuntimePaths.logs}/*.jsonl`, kind: 'memory-artifact' }
] as const;

export const additiveCommandFieldSchemaRegistry: RegisteredSchemaContract[] = [
  { id: 'query.memoryKnowledge', version: '1.0', path: 'schema://cli/query', kind: 'command-output' },
  { id: 'explain.memoryKnowledge', version: '1.0', path: 'schema://cli/explain', kind: 'command-output' },
  { id: 'plan.tasks[].advisory.outcomeLearning', version: '1.0', path: 'schema://cli/plan', kind: 'command-output' },
  { id: 'analyze-pr.preventionGuidance', version: '1.0', path: 'schema://cli/analyze-pr', kind: 'command-output' },
  { id: 'analyze-pr.context.sources[].promoted-knowledge', version: '1.0', path: 'schema://cli/analyze-pr', kind: 'command-output' }
] as const;

export const getContractsSchemaRegistry = (): { memoryArtifacts: RegisteredSchemaContract[]; commandOutputs: RegisteredSchemaContract[] } => ({
  memoryArtifacts: [...memoryArtifactSchemaRegistry],
  commandOutputs: [...additiveCommandFieldSchemaRegistry]
});
