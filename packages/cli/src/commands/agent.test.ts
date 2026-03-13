import { describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';

const listRuntimeRuns = vi.fn();
const readRuntimeRun = vi.fn();
const listRuntimeTasks = vi.fn();
const listRuntimeLogRecords = vi.fn();
const readRuntimeControlPlaneStatus = vi.fn();
const runAgentPlanDryRun = vi.fn();

vi.mock('@zachariahredfield/playbook-engine', () => ({
  listRuntimeRuns,
  readRuntimeRun,
  listRuntimeTasks,
  listRuntimeLogRecords,
  readRuntimeControlPlaneStatus,
  runAgentPlanDryRun
}));

describe('runAgent', () => {
  it('supports runs subcommand and emits json output', async () => {
    const { runAgent } = await import('./agent.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    listRuntimeRuns.mockReturnValue([{ runId: 'run-1', state: 'pending' }]);

    const exitCode = await runAgent('/repo', ['runs'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.command).toBe('agent-runs');
    expect(payload.runs).toHaveLength(1);

    logSpy.mockRestore();
  });

  it('supports show subcommand', async () => {
    const { runAgent } = await import('./agent.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    readRuntimeRun.mockReturnValue({ runId: 'run-1', state: 'running' });

    const exitCode = await runAgent('/repo', ['show', 'run-1'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.command).toBe('agent-show');
    expect(payload.run.runId).toBe('run-1');

    logSpy.mockRestore();
  });

  it('fails tasks subcommand when --run-id is missing', async () => {
    const { runAgent } = await import('./agent.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runAgent('/repo', ['tasks'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Failure);

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(String(payload.error)).toContain('missing required --run-id');

    logSpy.mockRestore();
  });

  it('supports status subcommand', async () => {
    const { runAgent } = await import('./agent.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    readRuntimeControlPlaneStatus.mockReturnValue({
      schemaVersion: '1.0',
      command: 'agent-status',
      runtimeRootExists: true,
      runCount: 2,
      taskCount: 4,
      logCount: 8,
      latestRunId: 'run-2',
      latestRunState: 'running'
    });

    const exitCode = await runAgent('/repo', ['status'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.command).toBe('agent-status');
    expect(payload.runCount).toBe(2);

    logSpy.mockRestore();
  });

  it('supports run subcommand in dry-run mode', async () => {
    const { runAgent } = await import('./agent.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    runAgentPlanDryRun.mockReturnValue({
      runMetadata: {
        runId: 'run-1',
        agentId: 'playbook-agent',
        repoId: 'playbook',
        objective: 'plan-backed-agent-dry-run',
        mode: 'dry-run',
        createdAt: 123
      },
      compiledTaskCount: 2,
      readyBlockedSummary: { readyCount: 1, blockedCount: 1, completedCount: 0 },
      approvalRequiredSummary: { taskCount: 1, taskIds: ['rt-2'] },
      deniedTaskSummary: { taskCount: 0, taskIds: [] },
      schedulingPreview: {
        runId: 'run-1',
        deterministicNextTaskOrder: ['rt-1'],
        nextTaskId: 'rt-1',
        ready: [],
        blocked: [],
        completed: [],
        blockedReasonSummary: {
          'approval-required': 1,
          'dependency-pending': 0,
          'retry-budget-exhausted': 0
        }
      },
      provenance: {
        sourcePlanArtifactPath: '.playbook/plan.json',
        sourcePlanArtifactId: 'plan_123'
      }
    });

    const exitCode = await runAgent('/repo', ['run', '--from-plan', '.playbook/plan.json', '--dry-run'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.command).toBe('agent-run');
    expect(payload.dryRun).toBe(true);
    expect(payload.compiledTaskCount).toBe(2);

    logSpy.mockRestore();
  });

  it('requires --dry-run for run subcommand', async () => {
    const { runAgent } = await import('./agent.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runAgent('/repo', ['run', '--from-plan', '.playbook/plan.json'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Failure);

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(String(payload.error)).toContain('--dry-run is required');

    logSpy.mockRestore();
  });
});
