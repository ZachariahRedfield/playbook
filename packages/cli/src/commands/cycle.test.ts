import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';

const createRepo = (name: string): string => fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));

const readCycleArtifact = (repo: string): {
  cycle_version: number;
  repo: string;
  steps: Array<{ name: string; status: string; duration_ms: number }>;
  result: string;
  failed_step?: string;
  artifacts_written: string[];
} => JSON.parse(fs.readFileSync(path.join(repo, '.playbook', 'cycle-state.json'), 'utf8'));

const successStepRunners = {
  verify: async () => ExitCode.Success,
  route: async () => ExitCode.Success,
  orchestrate: async () => ExitCode.Success,
  execute: async () => ExitCode.Success,
  telemetry: async () => ExitCode.Success,
  improve: async () => ExitCode.Success
};

describe('runCycle', { timeout: 30000 }, () => {
  it('runs all primitive steps and writes cycle-state artifact', async () => {
    const { runCycle } = await import('./cycle.js');
    const repo = createRepo('playbook-cycle-success');
    fs.mkdirSync(path.join(repo, '.playbook', 'orchestrator'), { recursive: true });
    fs.writeFileSync(path.join(repo, '.playbook', 'orchestrator', 'orchestrator.json'), '{}\n', 'utf8');
    fs.writeFileSync(path.join(repo, '.playbook', 'execution-plan.json'), '{}\n', 'utf8');
    fs.writeFileSync(path.join(repo, '.playbook', 'workset-plan.json'), '{}\n', 'utf8');
    fs.writeFileSync(path.join(repo, '.playbook', 'lane-state.json'), '{}\n', 'utf8');
    fs.writeFileSync(path.join(repo, '.playbook', 'execution-state.json'), '{}\n', 'utf8');
    fs.writeFileSync(path.join(repo, '.playbook', 'learning-compaction.json'), '{}\n', 'utf8');
    fs.writeFileSync(path.join(repo, '.playbook', 'improvement-candidates.json'), '{}\n', 'utf8');
    fs.writeFileSync(path.join(repo, '.playbook', 'command-improvements.json'), '{}\n', 'utf8');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const code = await runCycle(repo, { format: 'json', quiet: false, stopOnError: true, stepRunners: successStepRunners });

    expect(code).toBe(ExitCode.Success);
    const artifact = readCycleArtifact(repo);
    expect(artifact.result).toBe('success');
    expect(artifact.cycle_version).toBe(1);
    expect(artifact.repo).toBe(repo);
    expect(artifact.steps.map((step) => step.name)).toEqual(['verify', 'route', 'orchestrate', 'execute', 'telemetry', 'improve']);
    expect(artifact.steps.every((step) => step.status === 'success')).toBe(true);
    expect(artifact.artifacts_written).toEqual([
      '.playbook/execution-plan.json',
      '.playbook/orchestrator/orchestrator.json',
      '.playbook/workset-plan.json',
      '.playbook/lane-state.json',
      '.playbook/execution-state.json',
      '.playbook/learning-compaction.json',
      '.playbook/improvement-candidates.json',
      '.playbook/command-improvements.json'
    ]);

    logSpy.mockRestore();
  });

  it('verify failure stops cycle', async () => {
    const { runCycle } = await import('./cycle.js');
    const repo = createRepo('playbook-cycle-verify-fail');
    const routeRunner = vi.fn(async () => ExitCode.Success);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const code = await runCycle(repo, {
      format: 'json',
      quiet: false,
      stopOnError: true,
      stepRunners: { ...successStepRunners, verify: async () => ExitCode.Failure, route: routeRunner }
    });

    expect(code).toBe(ExitCode.Failure);
    expect(routeRunner).not.toHaveBeenCalled();
    const artifact = readCycleArtifact(repo);
    expect(artifact.result).toBe('failed');
    expect(artifact.steps).toHaveLength(1);
    expect(artifact.steps[0]).toMatchObject({ name: 'verify', status: 'failure' });

    logSpy.mockRestore();
  });

  it('emits stable json output shape', async () => {
    const { runCycle } = await import('./cycle.js');
    const repo = createRepo('playbook-cycle-json');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const code = await runCycle(repo, { format: 'json', quiet: false, stopOnError: true, stepRunners: successStepRunners });

    expect(code).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0]));
    expect(payload).toMatchObject({
      cycle_version: 1,
      repo,
      cycle_id: expect.any(String),
      started_at: expect.any(String),
      steps: expect.any(Array),
      artifacts_written: expect.any(Array),
      result: 'success'
    });
    expect(payload).not.toHaveProperty('failed_step');

    logSpy.mockRestore();
  });

  it('continues running when stopOnError=false and still returns failure', async () => {
    const { runCycle } = await import('./cycle.js');
    const repo = createRepo('playbook-cycle-continue-on-error');
    const routeRunner = vi.fn(async () => ExitCode.Success);
    const orchestrateRunner = vi.fn(async () => ExitCode.Success);
    const executeRunner = vi.fn(async () => ExitCode.Success);
    const telemetryRunner = vi.fn(async () => ExitCode.Success);
    const improveRunner = vi.fn(async () => ExitCode.Success);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const code = await runCycle(repo, {
      format: 'json',
      quiet: false,
      stopOnError: false,
      stepRunners: {
        ...successStepRunners,
        verify: async () => ExitCode.Failure,
        route: routeRunner,
        orchestrate: orchestrateRunner,
        execute: executeRunner,
        telemetry: telemetryRunner,
        improve: improveRunner
      }
    });

    expect(code).toBe(ExitCode.Failure);
    expect(routeRunner).toHaveBeenCalledTimes(1);
    expect(orchestrateRunner).toHaveBeenCalledTimes(1);
    expect(executeRunner).toHaveBeenCalledTimes(1);
    expect(telemetryRunner).toHaveBeenCalledTimes(1);
    expect(improveRunner).toHaveBeenCalledTimes(1);

    const artifact = readCycleArtifact(repo);
    expect(artifact.steps.map((step) => step.name)).toEqual(['verify', 'route', 'orchestrate', 'execute', 'telemetry', 'improve']);
    expect(artifact.result).toBe('failed');
    expect(artifact.failed_step).toBe('verify');

    logSpy.mockRestore();
  });

  it('records failed_step when a primitive throws', async () => {
    const { runCycle } = await import('./cycle.js');
    const repo = createRepo('playbook-cycle-throw-fail');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await expect(
      runCycle(repo, {
        format: 'json',
        quiet: false,
        stopOnError: true,
        stepRunners: {
          ...successStepRunners,
          orchestrate: async () => {
            throw new Error('boom');
          }
        }
      })
    ).rejects.toThrow('boom');

    const artifact = readCycleArtifact(repo);
    expect(artifact.result).toBe('failed');
    expect(artifact.failed_step).toBe('orchestrate');
    expect(artifact.steps.map((step) => step.name)).toEqual(['verify', 'route']);

    logSpy.mockRestore();
  });

  it('help text documents --no-stop-on-error flag', async () => {
    const { runCycle } = await import('./cycle.js');
    const repo = createRepo('playbook-cycle-help-flags');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const code = await runCycle(repo, { format: 'text', quiet: false, stopOnError: true, help: true });

    expect(code).toBe(ExitCode.Success);
    const output = logSpy.mock.calls.map((call) => String(call[0])).join('\n');
    expect(output).toContain('--no-stop-on-error');
    expect(output).not.toContain('--stop-on-error            Stop at first failing step');

    logSpy.mockRestore();
  });

  it('writes deterministic artifact step ordering', async () => {
    const { runCycle } = await import('./cycle.js');
    const repo = createRepo('playbook-cycle-deterministic');

    await runCycle(repo, { format: 'json', quiet: false, stopOnError: true, stepRunners: successStepRunners });
    const first = readCycleArtifact(repo);

    await runCycle(repo, { format: 'json', quiet: false, stopOnError: true, stepRunners: successStepRunners });
    const second = readCycleArtifact(repo);

    expect(first.steps.map((step) => step.name)).toEqual(second.steps.map((step) => step.name));
    expect(first.steps.map((step) => step.status)).toEqual(second.steps.map((step) => step.status));
  });

  it('stops after execute primitive failure (missing prerequisite behavior)', async () => {
    const { runCycle } = await import('./cycle.js');
    const repo = createRepo('playbook-cycle-missing-prereq');
    const telemetryRunner = vi.fn(async () => ExitCode.Success);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const code = await runCycle(repo, {
      format: 'json',
      quiet: false,
      stopOnError: true,
      stepRunners: { ...successStepRunners, execute: async () => ExitCode.Failure, telemetry: telemetryRunner }
    });

    expect(code).toBe(ExitCode.Failure);
    expect(telemetryRunner).not.toHaveBeenCalled();
    const artifact = readCycleArtifact(repo);
    expect(artifact.result).toBe('failed');
    expect(artifact.steps.map((step) => step.name)).toEqual(['verify', 'route', 'orchestrate', 'execute']);
    expect(artifact.steps.at(-1)).toMatchObject({ name: 'execute', status: 'failure' });
    expect(artifact.failed_step).toBe('execute');

    logSpy.mockRestore();
  });
});
