import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';
import { listRegisteredCommands } from './index.js';
import { runRendezvous } from './rendezvous.js';

const createRepo = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-rendezvous-'));

const initGitRepo = (repo: string): void => {
  execFileSync('git', ['init'], { cwd: repo, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.email', 'dev@example.com'], { cwd: repo, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.name', 'Dev'], { cwd: repo, stdio: 'ignore' });
  fs.writeFileSync(path.join(repo, 'README.md'), 'seed\n');
  execFileSync('git', ['add', '.'], { cwd: repo, stdio: 'ignore' });
  execFileSync('git', ['commit', '-m', 'seed'], { cwd: repo, stdio: 'ignore' });
};

const writeArtifact = (repo: string, relativePath: string, payload: unknown): void => {
  const absolute = path.join(repo, relativePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2));
};

const seedCanonicalArtifacts = (repo: string): void => {
  writeArtifact(repo, '.playbook/ci-failure.log', 'failure line');
  writeArtifact(repo, '.playbook/test-triage.json', { command: 'test-triage' });
  writeArtifact(repo, '.playbook/test-fix-plan.json', { command: 'test-fix-plan' });
  writeArtifact(repo, '.playbook/test-autofix-apply.json', { command: 'apply' });
  writeArtifact(repo, '.playbook/test-autofix.json', { command: 'test-autofix', run_id: 'test-autofix-run-0001', failure_signatures: ['sig-a'] });
  writeArtifact(repo, '.playbook/remediation-status.json', { command: 'remediation-status' });
};

describe('runRendezvous', () => {
  it('creates manifest deterministically from canonical artifacts', async () => {
    const repo = createRepo();
    initGitRepo(repo);
    seedCanonicalArtifacts(repo);

    const exitCode = await runRendezvous(repo, ['create'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);

    const manifest = JSON.parse(fs.readFileSync(path.join(repo, '.playbook/rendezvous-manifest.json'), 'utf8'));
    expect(manifest.requiredArtifactIds).toEqual(['apply-result', 'failure-log', 'remediation-status', 'test-autofix', 'test-fix-plan', 'test-triage']);
    expect(manifest.blockers).toEqual([]);
    expect(manifest.confidence).toBe(1);
  });

  it('status returns stale when manifest base sha no longer matches HEAD', async () => {
    const repo = createRepo();
    initGitRepo(repo);
    seedCanonicalArtifacts(repo);
    await runRendezvous(repo, ['create'], { format: 'json', quiet: false });

    fs.writeFileSync(path.join(repo, 'README.md'), 'changed\n');
    execFileSync('git', ['add', '.'], { cwd: repo, stdio: 'ignore' });
    execFileSync('git', ['commit', '-m', 'change'], { cwd: repo, stdio: 'ignore' });

    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runRendezvous(repo, ['status'], { format: 'json', quiet: false });
    const payload = JSON.parse(String(spy.mock.calls.at(-1)?.[0]));

    expect(exitCode).toBe(ExitCode.Success);
    expect(payload.evaluation.state).toBe('stale');
    expect(payload.evaluation.releaseReady).toBe(false);
  });

  it('release --dry-run blocks when artifacts are incomplete', async () => {
    const repo = createRepo();
    initGitRepo(repo);
    seedCanonicalArtifacts(repo);
    fs.rmSync(path.join(repo, '.playbook/test-fix-plan.json'));

    await runRendezvous(repo, ['create'], { format: 'json', quiet: false });

    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runRendezvous(repo, ['release', '--dry-run'], { format: 'json', quiet: false });
    const payload = JSON.parse(String(spy.mock.calls.at(-1)?.[0]));

    expect(exitCode).toBe(ExitCode.Failure);
    expect(payload.evaluation.state).toBe('incomplete');
    expect(payload.evaluation.missingArtifactIds).toContain('test-fix-plan');
  });

  it('registers rendezvous command', () => {
    const command = listRegisteredCommands().find((entry) => entry.name === 'rendezvous');
    expect(command).toBeDefined();
    expect(command?.description).toBe('Create/status/release-dry-run artifact rendezvous readiness from canonical remediation artifacts');
  });
});
