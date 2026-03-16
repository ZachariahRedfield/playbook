import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';
import { runOrchestrate } from './orchestrate.js';

describe('runOrchestrate', () => {
  it('prints help side-effect-free', async () => {
    const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-orchestrate-help-'));
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runOrchestrate(repoDir, {
      format: 'text',
      quiet: false,
      lanes: 3,
      outDir: '.playbook/orchestrator',
      artifactFormat: 'both',
      help: true
    });

    expect(exitCode).toBe(ExitCode.Success);
    expect(logSpy.mock.calls.flat().join('\n')).toContain('Usage: playbook orchestrate (--goal <goal> | --tasks-file <path>) [options]');
    expect(fs.existsSync(path.join(repoDir, '.playbook', 'workset-plan.json'))).toBe(false);

    logSpy.mockRestore();
  });

  it('fails deterministically when --goal is missing', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runOrchestrate('/repo', {
      format: 'json',
      quiet: false,
      lanes: 3,
      outDir: '.playbook/orchestrator',
      artifactFormat: 'both'
    });

    expect(exitCode).toBe(ExitCode.Failure);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(payload.command).toBe('orchestrate');
    expect(payload.ok).toBe(false);
    expect(payload.exitCode).toBe(ExitCode.Failure);

    logSpy.mockRestore();
  });

  it('preserves deterministic missing --goal failure in a non-writable cwd', async () => {
    const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-orchestrate-missing-goal-readonly-'));
    const telemetryDir = path.join(repoDir, '.playbook', 'telemetry');
    fs.mkdirSync(telemetryDir, { recursive: true });
    fs.chmodSync(telemetryDir, 0o555);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runOrchestrate(repoDir, {
      format: 'json',
      quiet: false,
      lanes: 3,
      outDir: '.playbook/orchestrator',
      artifactFormat: 'both'
    });

    expect(exitCode).toBe(ExitCode.Failure);

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as {
      command: string;
      ok: boolean;
      exitCode: number;
      summary: string;
      findings: Array<{ id: string }>;
    };

    expect(payload.command).toBe('orchestrate');
    expect(payload.ok).toBe(false);
    expect(payload.exitCode).toBe(ExitCode.Failure);
    expect(payload.summary).toBe('Orchestration failed: --goal is required when --tasks-file is not provided.');
    expect(payload.findings[0]?.id).toBe('orchestrate.goal.required');

    logSpy.mockRestore();
    fs.chmodSync(telemetryDir, 0o755);
  });

  it('writes deterministic artifacts and returns success', async () => {
    const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-orchestrate-'));
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runOrchestrate(repoDir, {
      format: 'json',
      quiet: false,
      goal: 'ship orchestration command',
      lanes: 3,
      outDir: '.playbook/orchestrator',
      artifactFormat: 'both'
    });

    expect(exitCode).toBe(ExitCode.Success);

    const jsonArtifact = path.join(repoDir, '.playbook', 'orchestrator', 'orchestrator.json');
    const lane1Prompt = path.join(repoDir, '.playbook', 'orchestrator', 'lane-1.prompt.md');
    const workersDir = path.join(repoDir, '.playbook', 'orchestrator', 'workers');

    expect(fs.existsSync(jsonArtifact)).toBe(true);
    expect(fs.existsSync(lane1Prompt)).toBe(true);
    expect(fs.existsSync(workersDir)).toBe(true);

    const artifactPayload = JSON.parse(fs.readFileSync(jsonArtifact, 'utf8')) as {
      goal: string;
      laneCountProduced: number;
      lanes: Array<{ id: string; shardKey: string; wave: number; dependsOn: string[]; allowedPaths: string[] }>;
      sharedPaths: string[];
    };
    expect(artifactPayload.goal).toBe('ship orchestration command');
    expect(artifactPayload.laneCountProduced).toBe(3);
    expect(artifactPayload.sharedPaths).toEqual(['README.md', 'docs/CHANGELOG.md', 'docs/PLAYBOOK_PRODUCT_ROADMAP.md']);

    const workerDirs = fs.readdirSync(workersDir);
    expect(workerDirs).toHaveLength(artifactPayload.laneCountProduced);

    workerDirs.forEach((laneId) => {
      expect(fs.existsSync(path.join(workersDir, laneId, 'prompt.md'))).toBe(true);
      expect(fs.existsSync(path.join(workersDir, laneId, 'contract.json'))).toBe(true);
    });

    const lane1WorkerContract = JSON.parse(fs.readFileSync(path.join(workersDir, 'lane-1', 'contract.json'), 'utf8')) as {
      laneId: string;
      goal: string;
      allowedPaths: string[];
      forbiddenPaths: string[];
      sharedPaths: string[];
      wave: number;
      dependsOn: string[];
      shardKey: string;
      verification: string[];
    };

    expect(lane1WorkerContract).toMatchObject({
      laneId: 'lane-1',
      goal: 'ship orchestration command',
      allowedPaths: expect.any(Array),
      forbiddenPaths: expect.any(Array),
      sharedPaths: expect.any(Array),
      shardKey: expect.any(String),
      wave: expect.any(Number),
      dependsOn: expect.any(Array),
      verification: expect.any(Array)
    });

    const owned = new Set<string>();
    artifactPayload.lanes.forEach((lane) => {
      lane.allowedPaths.forEach((ownedPath) => {
        expect(owned.has(ownedPath)).toBe(false);
        owned.add(ownedPath);
      });
    });

    artifactPayload.lanes.forEach((lane) => {
      expect(lane.shardKey).toBeTruthy();
    });

    const lane1WorkerPrompt = fs.readFileSync(path.join(workersDir, 'lane-1', 'prompt.md'), 'utf8');
    expect(lane1WorkerPrompt).toContain('## Shard ownership');

    const lane3 = artifactPayload.lanes.find((lane) => lane.id === 'lane-3');
    expect(lane3?.wave).toBe(2);
    expect(lane3?.dependsOn).toEqual(['lane-1', 'lane-2']);

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(payload.command).toBe('orchestrate');
    expect(payload.ok).toBe(true);

    logSpy.mockRestore();
  });

  it('omits orchestrator.json guidance when artifact format is md', async () => {
    const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-orchestrate-md-only-'));
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runOrchestrate(repoDir, {
      format: 'json',
      quiet: false,
      goal: 'md-only artifacts',
      lanes: 3,
      outDir: '.playbook/orchestrator',
      artifactFormat: 'md'
    });

    expect(exitCode).toBe(ExitCode.Success);

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as {
      nextActions: string[];
    };

    expect(fs.existsSync(path.join(repoDir, '.playbook', 'orchestrator', 'orchestrator.json'))).toBe(false);
    expect(payload.nextActions.some((action) => action.includes('orchestrator.json'))).toBe(false);

    logSpy.mockRestore();
  });

  it('degrades to a single lane when one lane is requested', async () => {
    const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-orchestrate-one-lane-'));
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await runOrchestrate(repoDir, {
      format: 'json',
      quiet: false,
      goal: 'single lane scenario',
      lanes: 1,
      outDir: '.playbook/orchestrator',
      artifactFormat: 'json'
    });

    const artifactPayload = JSON.parse(
      fs.readFileSync(path.join(repoDir, '.playbook', 'orchestrator', 'orchestrator.json'), 'utf8')
    ) as { laneCountProduced: number };

    expect(artifactPayload.laneCountProduced).toBe(1);
    expect(fs.existsSync(path.join(repoDir, '.playbook', 'orchestrator', 'lane-1.prompt.md'))).toBe(false);
    expect(fs.existsSync(path.join(repoDir, '.playbook', 'orchestrator', 'workers', 'lane-1', 'prompt.md'))).toBe(true);
    expect(fs.existsSync(path.join(repoDir, '.playbook', 'orchestrator', 'workers', 'lane-1', 'contract.json'))).toBe(true);

    logSpy.mockRestore();
  });

  it('builds workset plan from --tasks-file input', async () => {
    const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-orchestrate-workset-'));
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    fs.mkdirSync(path.join(repoDir, 'fixtures'), { recursive: true });
    fs.writeFileSync(
      path.join(repoDir, 'fixtures', 'tasks.json'),
      JSON.stringify(
        {
          tasks: [
            { task_id: 'task-docs', task: 'update documentation changelog' },
            { task_id: 'task-docs-2', task: 'update release notes and markdown references' }
          ]
        },
        null,
        2
      )
    );

    const exitCode = await runOrchestrate(repoDir, {
      format: 'json',
      quiet: false,
      tasksFile: './fixtures/tasks.json',
      lanes: 3,
      outDir: '.playbook/orchestrator',
      artifactFormat: 'json'
    });

    expect(exitCode).toBe(ExitCode.Failure);
    expect(fs.existsSync(path.join(repoDir, '.playbook', 'workset-plan.json'))).toBe(true);
    expect(fs.existsSync(path.join(repoDir, '.playbook', 'lane-state.json'))).toBe(true);

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as { command: string; ok: boolean };
    expect(payload.command).toBe('orchestrate');
    expect(payload.ok).toBe(true);

    logSpy.mockRestore();
  });

});
