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
      lanes: 2,
      outDir: '.playbook/orchestrator',
      artifactFormat: 'both'
    });

    expect(exitCode).toBe(ExitCode.Success);

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(payload.command).toBe('orchestrate');
    expect(payload.ok).toBe(true);

    const jsonArtifact = path.join(repoDir, '.playbook', 'orchestrator', 'orchestration.json');
    const markdownArtifact = path.join(repoDir, '.playbook', 'orchestrator', 'orchestration.md');

    expect(fs.existsSync(jsonArtifact)).toBe(true);
    expect(fs.existsSync(markdownArtifact)).toBe(true);

    const artifactPayload = JSON.parse(fs.readFileSync(jsonArtifact, 'utf8')) as Record<string, unknown>;
    expect(artifactPayload.goal).toBe('ship orchestration command');
    expect(artifactPayload.lanes).toBe(2);

    const markdown = fs.readFileSync(markdownArtifact, 'utf8');
    expect(markdown).toContain('# Playbook Orchestration Plan');
    expect(markdown).toContain('Lane 1');
    expect(markdown).toContain('Lane 2');

    logSpy.mockRestore();
  });
});
