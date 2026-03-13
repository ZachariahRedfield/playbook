import { describe, expect, it } from 'vitest';
import {
  CONTROL_PLANE_RUNTIME_SCHEMA_VERSION,
  assertApprovalStateTransition,
  assertRunStateTransition,
  assertTaskStateTransition,
  compilePlanTaskToRuntimeTask,
  compilePlanToRuntimeDryRun,
  controlPlaneRuntimePaths,
  createAgentId,
  createControlPlaneSchemaMetadata,
  createRunId,
  createTaskId
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
    expect(controlPlaneRuntimePaths.compiledTasks).toBe('.playbook/runtime/tasks/compiled');
    expect(controlPlaneRuntimePaths.logs).toBe('.playbook/runtime/logs');
    expect(controlPlaneRuntimePaths.queue).toBe('.playbook/runtime/queue');
    expect(controlPlaneRuntimePaths.dryRuns).toBe('.playbook/runtime/dry-runs');
  });

  it('maps a plan task to deterministic runtime fields with provenance', () => {
    const runId = 'run_123';
    const task = {
      ruleId: 'rule.require-notes',
      file: 'README.md',
      action: 'Add release notes',
      autoFix: false
    };

    const compiled = compilePlanTaskToRuntimeTask({
      runId,
      task,
      taskIndex: 2,
      dependencyTaskIds: ['tsk_dep_b', 'tsk_dep_a', 'tsk_dep_a']
    });

    expect(compiled.runId).toBe(runId);
    expect(compiled.taskKind).toBe('manual-remediation');
    expect(compiled.mutabilityClass).toBe('read-only');
    expect(compiled.dependencies).toEqual(['tsk_dep_a', 'tsk_dep_b']);
    expect(compiled.provenance.planTaskId).toBe(compiled.sourcePlanTaskId);
    expect(compiled.provenance.planTaskIndex).toBe(2);
  });

  it('builds deterministic dry-run envelope with derived dependencies and approval summary', () => {
    const dryRunA = compilePlanToRuntimeDryRun({
      runId: 'run_bootstrap',
      createdAt: 1710000001111,
      planTasks: [
        { ruleId: 'rule-1', file: 'src/a.ts', action: 'Apply deterministic fix', autoFix: true },
        { ruleId: 'rule-2', file: 'src/a.ts', action: 'Update dependency settings', autoFix: false },
        { ruleId: 'rule-3', file: null, action: 'Verify result', autoFix: false }
      ]
    });

    const dryRunB = compilePlanToRuntimeDryRun({
      runId: 'run_bootstrap',
      createdAt: 1710000001111,
      planTasks: [
        { ruleId: 'rule-1', file: 'src/a.ts', action: 'Apply deterministic fix', autoFix: true },
        { ruleId: 'rule-2', file: 'src/a.ts', action: 'Update dependency settings', autoFix: false },
        { ruleId: 'rule-3', file: null, action: 'Verify result', autoFix: false }
      ]
    });

    expect(dryRunA).toEqual(dryRunB);
    expect(dryRunA.metadata.planTaskCount).toBe(3);
    expect(dryRunA.metadata.compiledTaskCount).toBe(3);
    expect(dryRunA.metadata.derivedDependencyEdgeCount).toBe(1);
    expect(dryRunA.tasks[0]?.taskKind).toBe('apply-fix');
    expect(dryRunA.tasks[1]?.taskKind).toBe('manual-remediation');
    expect(dryRunA.tasks[1]?.dependencies.length).toBe(1);
    expect(dryRunA.tasks[2]?.taskKind).toBe('observe-only');
    expect(dryRunA.approval.approvalRequired).toBe(true);
    expect(dryRunA.approval.approvalRequiredTaskCount).toBe(1);
    expect(dryRunA.approval.reason).toBe('manual-remediation-tasks-present');
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
    expect(ids).toContain('compiled-runtime-task-input');
    expect(ids).toContain('plan-runtime-compilation-metadata');
    expect(ids).toContain('dry-run-summary-envelope');
    expect(ids).toContain('approval-requirement-summary');
    expect(ids).toContain('scheduling-preview-record');

    const compiledEntry = memoryArtifactSchemaRegistry.find((entry) => entry.id === 'compiled-runtime-task-input');
    expect(compiledEntry?.version).toBe(CONTROL_PLANE_RUNTIME_SCHEMA_VERSION);
    expect(compiledEntry?.path).toBe('.playbook/runtime/tasks/compiled/*.json');
  });
});
