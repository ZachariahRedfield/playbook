import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';
import { runOrchestrate } from './orchestrate.js';

describe('runOrchestrate', () => {
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

    expect(fs.existsSync(jsonArtifact)).toBe(true);
    expect(fs.existsSync(lane1Prompt)).toBe(true);

    const artifactPayload = JSON.parse(fs.readFileSync(jsonArtifact, 'utf8')) as {
      goal: string;
      laneCountProduced: number;
      lanes: Array<{ id: string; wave: number; dependsOn: string[]; allowedPaths: string[] }>;
      sharedPaths: string[];
    };
    expect(artifactPayload.goal).toBe('ship orchestration command');
    expect(artifactPayload.laneCountProduced).toBe(3);
    expect(artifactPayload.sharedPaths).toEqual(['README.md', 'docs/CHANGELOG.md', 'docs/PLAYBOOK_PRODUCT_ROADMAP.md']);

    const owned = new Set<string>();
    artifactPayload.lanes.forEach((lane) => {
      lane.allowedPaths.forEach((ownedPath) => {
        expect(owned.has(ownedPath)).toBe(false);
        owned.add(ownedPath);
      });
    });

    const lane3 = artifactPayload.lanes.find((lane) => lane.id === 'lane-3');
    expect(lane3?.wave).toBe(2);
    expect(lane3?.dependsOn).toEqual(['lane-1', 'lane-2']);

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(payload.command).toBe('orchestrate');
    expect(payload.ok).toBe(true);

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

    logSpy.mockRestore();
  });
});
