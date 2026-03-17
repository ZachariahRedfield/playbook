import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ExitCode } from '../lib/cliContract.js';

const checkOne = vi.fn();
const applyOne = vi.fn();
const checkTwo = vi.fn();
const applyTwo = vi.fn();

vi.mock('../lib/migrations.js', () => ({
  migrationRegistry: [
    {
      id: 'migration.one',
      introducedIn: '0.1.2',
      description: 'first migration',
      safeToAutoApply: true,
      check: checkOne,
      apply: applyOne
    },
    {
      id: 'migration.two',
      introducedIn: '0.1.3',
      description: 'second migration',
      safeToAutoApply: false,
      check: checkTwo,
      apply: applyTwo
    }
  ]
}));

describe('runUpgrade', () => {
  let repoRoot: string;

  beforeEach(() => {
    repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-upgrade-'));
    checkOne.mockReset().mockResolvedValue({ needed: false, reason: 'not needed' });
    checkTwo.mockReset().mockResolvedValue({ needed: false, reason: 'not needed' });
    applyOne.mockReset();
    applyTwo.mockReset();
  });

  afterEach(() => {
    fs.rmSync(repoRoot, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('reports up_to_date for already aligned dependency repos', async () => {
    const { runUpgrade } = await import('./upgrade.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    fs.writeFileSync(
      path.join(repoRoot, 'package.json'),
      JSON.stringify({ packageManager: 'pnpm@9.0.0', devDependencies: { '@fawxzzy/playbook': '^0.1.1' } })
    );

    const exitCode = await runUpgrade(repoRoot, {
      check: false,
      apply: false,
      dryRun: false,
      offline: false,
      ci: false,
      explain: false,
      format: 'json',
      quiet: false,
      to: '0.1.1'
    });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.kind).toBe('playbook-upgrade');
    expect(payload.status).toBe('up_to_date');
    expect(payload.currentVersion).toBe('^0.1.1');
  });

  it('reports upgrade_available for dependency repos behind target', async () => {
    const { runUpgrade } = await import('./upgrade.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    fs.writeFileSync(
      path.join(repoRoot, 'package.json'),
      JSON.stringify({ packageManager: 'pnpm@9.0.0', devDependencies: { '@fawxzzy/playbook': '^0.1.0' } })
    );

    const exitCode = await runUpgrade(repoRoot, {
      check: true,
      apply: false,
      dryRun: false,
      offline: false,
      ci: false,
      explain: false,
      format: 'json',
      quiet: false,
      to: '0.1.1'
    });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.status).toBe('upgrade_available');
    expect(payload.targetVersion).toBe('0.1.1');
    expect(payload.actions).toContain('pnpm install');
  });

  it('returns blocked status for ambiguous package manager markers on apply', async () => {
    const { runUpgrade } = await import('./upgrade.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    fs.writeFileSync(
      path.join(repoRoot, 'package.json'),
      JSON.stringify({ packageManager: 'pnpm@9.0.0', devDependencies: { '@fawxzzy/playbook': '^0.1.0' } })
    );
    fs.writeFileSync(path.join(repoRoot, 'yarn.lock'), 'lock');

    const exitCode = await runUpgrade(repoRoot, {
      check: false,
      apply: true,
      dryRun: false,
      offline: false,
      ci: false,
      explain: false,
      format: 'json',
      quiet: false,
      to: '0.1.1'
    });

    expect(exitCode).toBe(ExitCode.WarningsOnly);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.status).toBe('upgrade_blocked');
    expect(payload.packageManager.status).toBe('ambiguous');
  });

  it('applies bounded dependency mutation in apply mode', async () => {
    const { runUpgrade } = await import('./upgrade.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    fs.writeFileSync(path.join(repoRoot, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0');
    fs.writeFileSync(
      path.join(repoRoot, 'package.json'),
      JSON.stringify({ devDependencies: { '@fawxzzy/playbook': '^0.1.0', vitest: '^1.0.0' } })
    );

    const exitCode = await runUpgrade(repoRoot, {
      check: false,
      apply: true,
      dryRun: false,
      offline: false,
      ci: false,
      explain: false,
      format: 'json',
      quiet: false,
      to: '0.1.1'
    });

    expect(exitCode).toBe(ExitCode.Success);
    const updated = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as {
      devDependencies: Record<string, string>;
    };
    expect(updated.devDependencies['@fawxzzy/playbook']).toBe('^0.1.1');
    expect(updated.devDependencies.vitest).toBe('^1.0.0');

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.status).toBe('upgrade_applied');
  });
});
