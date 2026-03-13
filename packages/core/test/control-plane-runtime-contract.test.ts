import { describe, expect, it } from 'vitest';
import {
  CONTROL_PLANE_RUNTIME_SCHEMA_VERSION,
  assertApprovalStateTransition,
  assertRunStateTransition,
  assertTaskStateTransition,
  controlPlaneRuntimePaths,
  createAgentId,
  createRunId,
  createTaskId,
  createControlPlaneSchemaMetadata
} from '../src/contracts/controlPlaneRuntime.js';
import { memoryArtifactSchemaRegistry } from '../src/contracts/schemaRegistry.js';

describe('control plane runtime contracts', () => {
  it('creates deterministic ids for agent, run, and task contracts', () => {
    const descriptor = {
      namespace: 'playbook',
      name: 'control-plane',
      version: '1.0.0',
      capabilities: ['plan', 'verify', 'apply']
    };

    const agentIdA = createAgentId({ repoId: 'ZachariahRedfield/playbook', descriptor });
    const agentIdB = createAgentId({
      repoId: 'ZachariahRedfield/playbook',
      descriptor: { ...descriptor, capabilities: ['apply', 'verify', 'plan', 'verify'] }
    });

    expect(agentIdA).toBe(agentIdB);

    const runIdA = createRunId({
      agentId: agentIdA,
      repoId: 'ZachariahRedfield/playbook',
      objective: 'PB-V09-CONTROL-PLANE-001',
      createdAt: 1710000000000
    });
    const runIdB = createRunId({
      agentId: agentIdA,
      repoId: 'ZachariahRedfield/playbook',
      objective: 'PB-V09-CONTROL-PLANE-001',
      createdAt: 1710000000000
    });

    expect(runIdA).toBe(runIdB);

    const taskIdA = createTaskId({ runId: runIdA, label: 'contracts-bootstrap' });
    const taskIdB = createTaskId({ runId: runIdA, label: 'contracts-bootstrap' });

    expect(taskIdA).toBe(taskIdB);
  });

  it('enforces valid state transitions for run, task, and approvals', () => {
    expect(() => assertRunStateTransition('pending', 'queued')).not.toThrow();
    expect(() => assertRunStateTransition('pending', 'running')).toThrow('Invalid run state transition: pending -> running');

    expect(() => assertTaskStateTransition('queued', 'ready')).not.toThrow();
    expect(() => assertTaskStateTransition('ready', 'succeeded')).toThrow('Invalid task state transition: ready -> succeeded');

    expect(() => assertApprovalStateTransition('pending', 'approved')).not.toThrow();
    expect(() => assertApprovalStateTransition('approved', 'pending')).toThrow('Invalid approval state transition: approved -> pending');
  });

  it('defines stable runtime paths and schema metadata', () => {
    const metadata = createControlPlaneSchemaMetadata('run-record');

    expect(metadata.schemaVersion).toBe(CONTROL_PLANE_RUNTIME_SCHEMA_VERSION);
    expect(controlPlaneRuntimePaths.root).toBe('.playbook/runtime');
    expect(controlPlaneRuntimePaths.agents).toBe('.playbook/runtime/agents');
    expect(controlPlaneRuntimePaths.runs).toBe('.playbook/runtime/runs');
    expect(controlPlaneRuntimePaths.tasks).toBe('.playbook/runtime/tasks');
    expect(controlPlaneRuntimePaths.logs).toBe('.playbook/runtime/logs');
    expect(controlPlaneRuntimePaths.queue).toBe('.playbook/runtime/queue');
  });

  it('registers control plane runtime artifacts in schema registry', () => {
    const ids = memoryArtifactSchemaRegistry.map((entry) => entry.id);

    expect(ids).toContain('agent-record');
    expect(ids).toContain('run-record');
    expect(ids).toContain('task-record');
    expect(ids).toContain('task-dependency-edge');
    expect(ids).toContain('queue-item');
    expect(ids).toContain('policy-decision-record');
    expect(ids).toContain('runtime-log-envelope');
  });
});
