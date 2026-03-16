import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';

const createRepo = (name: string): string => fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));

const readCycleArtifact = (repo: string): { steps: Array<{ name: string; status: string }>; status: string; artifacts_written: string[] } =>
  JSON.parse(fs.readFileSync(path.join(repo, '.playbook', 'cycle-state.json'), 'utf8'));

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
    expect(artifact.status).toBe('success');
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
    expect(artifact.status).toBe('failure');
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
      cycle_id: expect.any(String),
      started_at: expect.any(String),
      steps: expect.any(Array),
      artifacts_written: expect.any(Array),
      status: 'success'
    });

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
    expect(artifact.status).toBe('failure');
    expect(artifact.steps.map((step) => step.name)).toEqual(['verify', 'route', 'orchestrate', 'execute']);
    expect(artifact.steps.at(-1)).toMatchObject({ name: 'execute', status: 'failure' });

    logSpy.mockRestore();
  });
});
