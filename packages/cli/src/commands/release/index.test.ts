import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../../lib/cliContract.js';
import { runRelease } from './index.js';

const applySpy = vi.fn(async () => ExitCode.Success);
const buildReleasePlanSpy = vi.fn();
const assessReleaseSyncSpy = vi.fn();

vi.mock('../apply.js', () => ({
  runApply: (...args: unknown[]) => applySpy(...args)
}));

vi.mock('@zachariahredfield/playbook-engine', () => ({
  buildReleasePlan: (...args: unknown[]) => buildReleasePlanSpy(...args),
  assessReleaseSync: (...args: unknown[]) => assessReleaseSyncSpy(...args)
}));

const createRepo = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-release-command-'));

describe('runRelease', () => {
  beforeEach(() => {
    buildReleasePlanSpy.mockReset();
    assessReleaseSyncSpy.mockReset();
    applySpy.mockReset();
    applySpy.mockResolvedValue(ExitCode.Success);
  });

  it('supports release sync --check and fails with actionable drift output', async () => {
    const repoRoot = createRepo();
    assessReleaseSyncSpy.mockReturnValue({
      schemaVersion: '1.0',
      kind: 'playbook-release-sync',
      hasDrift: true,
      plan: { summary: { recommendedBump: 'patch', reasons: [] }, tasks: [] },
      governanceFailures: [{ id: 'release.requiredVersionBump.missing', message: 'missing bump' }],
      actionableTasks: [{ id: 'task-release-alpha', file: 'packages/alpha/package.json', action: 'Update version', task_kind: 'release-package-version' }],
      drift: [],
      generatedAt: '2026-03-27T00:00:00.000Z',
      mode: 'check'
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runRelease(repoRoot, ['sync', '--check', '--json'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Failure);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.kind).toBe('playbook-release-sync');
    expect(payload.hasDrift).toBe(true);
    expect(applySpy).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it('runs release sync apply path and re-checks for aligned state', async () => {
    const repoRoot = createRepo();
    assessReleaseSyncSpy
      .mockReturnValueOnce({
        schemaVersion: '1.0',
        kind: 'playbook-release-sync',
        hasDrift: true,
        plan: { summary: { recommendedBump: 'patch', reasons: [] }, tasks: [{ id: 'task-release-alpha', file: 'packages/alpha/package.json', action: 'Update version', task_kind: 'release-package-version' }] },
        governanceFailures: [{ id: 'release.requiredVersionBump.missing', message: 'missing bump' }],
        actionableTasks: [{ id: 'task-release-alpha', file: 'packages/alpha/package.json', action: 'Update version', task_kind: 'release-package-version' }],
        drift: [],
        generatedAt: '2026-03-27T00:00:00.000Z',
        mode: 'apply'
      })
      .mockReturnValueOnce({
        schemaVersion: '1.0',
        kind: 'playbook-release-sync',
        hasDrift: false,
        plan: { summary: { recommendedBump: 'patch', reasons: [] }, tasks: [] },
        governanceFailures: [],
        actionableTasks: [],
        drift: [],
        generatedAt: '2026-03-27T00:00:00.000Z',
        mode: 'check'
      });

    const exitCode = await runRelease(repoRoot, ['sync', '--json'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);
    expect(applySpy).toHaveBeenCalledTimes(1);
    expect(assessReleaseSyncSpy).toHaveBeenCalledTimes(2);
  });

  it('suppresses actionable-task text output when sync is already aligned', async () => {
    const repoRoot = createRepo();
    assessReleaseSyncSpy.mockReturnValue({
      schemaVersion: '1.0',
      kind: 'playbook-release-sync',
      hasDrift: false,
      plan: { summary: { recommendedBump: 'minor', reasons: [] }, tasks: [] },
      governanceFailures: [],
      actionableTasks: [],
      drift: [],
      generatedAt: '2026-03-27T00:00:00.000Z',
      mode: 'check'
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runRelease(repoRoot, ['sync', '--check'], { format: 'text', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);
    const output = logSpy.mock.calls.map((call) => String(call[0])).join('\n');
    expect(output).toContain('playbook release sync: aligned');
    expect(output).not.toContain('Actionable tasks:');
    logSpy.mockRestore();
  });
});
