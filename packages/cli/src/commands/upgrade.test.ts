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
    checkOne.mockReset();
    checkTwo.mockReset();
    applyOne.mockReset();
    applyTwo.mockReset();
  });

  afterEach(() => {
    fs.rmSync(repoRoot, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('returns deterministic json failure when mode is unknown and --from is omitted', async () => {
    const { runUpgrade } = await import('./upgrade.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runUpgrade(repoRoot, {
      check: true,
      apply: false,
      dryRun: false,
      offline: false,
      ci: false,
      explain: false,
      format: 'json',
      quiet: false
    });

    expect(exitCode).toBe(ExitCode.Failure);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.command).toBe('upgrade');
    expect(payload.summary).toContain('Unknown integration mode');
    expect(payload.recommendedCommands).toHaveLength(2);
  });

  it('runs check/apply/check cycle and emits stable json envelope', async () => {
    const { runUpgrade } = await import('./upgrade.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    fs.writeFileSync(path.join(repoRoot, 'package.json'), JSON.stringify({ devDependencies: { '@fawxzzy/playbook': '^0.1.0' } }));

    checkOne
      .mockResolvedValueOnce({ needed: true, reason: 'needed before apply' })
      .mockResolvedValueOnce({ needed: false, reason: 'resolved' });
    checkTwo
      .mockResolvedValueOnce({ needed: true, reason: 'manual migration needed' })
      .mockResolvedValueOnce({ needed: true, reason: 'manual migration needed' });
    applyOne.mockResolvedValue({ changed: true, filesChanged: ['docs/REFERENCE/cli.md'], summary: 'Applied migration one.' });

    const exitCode = await runUpgrade(repoRoot, {
      check: false,
      apply: true,
      dryRun: false,
      offline: true,
      ci: false,
      explain: false,
      format: 'json',
      quiet: false
    });

    expect(exitCode).toBe(ExitCode.WarningsOnly);
    expect(applyOne).toHaveBeenCalledTimes(1);
    expect(applyTwo).not.toHaveBeenCalled();

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.command).toBe('upgrade');
    expect(payload.mode).toBe('dependency');
    expect(payload.dryRun).toBe(false);
    expect(payload.applied).toHaveLength(1);
    expect(payload.migrationsNeeded).toHaveLength(1);
    expect(payload.summary).toContain('additional recommended migrations remaining');
  });
});
