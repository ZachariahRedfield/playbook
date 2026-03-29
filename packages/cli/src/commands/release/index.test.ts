import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../../lib/cliContract.js';
import { runRelease } from './index.js';

const applySpy = vi.fn(async () => ExitCode.Success);
const buildReleasePlanSpy = vi.fn();
const assessReleaseSyncSpy = vi.fn();
const summarizePlannedReleaseVersionsSpy = vi.fn();
const classifyReleaseSyncReconciliationSpy = vi.fn();

vi.mock('../apply.js', () => ({
  runApply: (...args: unknown[]) => applySpy(...args)
}));

vi.mock('@zachariahredfield/playbook-engine', () => ({
  buildReleasePlan: (...args: unknown[]) => buildReleasePlanSpy(...args),
  assessReleaseSync: (...args: unknown[]) => assessReleaseSyncSpy(...args),
  summarizePlannedReleaseVersions: (...args: unknown[]) => summarizePlannedReleaseVersionsSpy(...args),
  classifyReleaseSyncReconciliation: (...args: unknown[]) => classifyReleaseSyncReconciliationSpy(...args)
}));

const createRepo = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-release-command-'));

describe('runRelease', () => {
  beforeEach(() => {
    buildReleasePlanSpy.mockReset();
    assessReleaseSyncSpy.mockReset();
    summarizePlannedReleaseVersionsSpy.mockReset();
    classifyReleaseSyncReconciliationSpy.mockReset();
    applySpy.mockReset();
    applySpy.mockResolvedValue(ExitCode.Success);
    summarizePlannedReleaseVersionsSpy.mockReturnValue([]);
    classifyReleaseSyncReconciliationSpy.mockReturnValue({
      status: 'no_drift',
      taskCount: 0,
      plannedVersions: [],
      reason: 'release-governed state is already aligned'
    });
  });

  it('auto-applies release sync in --check when drift is auto-fixable', async () => {
    const repoRoot = createRepo();
    assessReleaseSyncSpy
      .mockReturnValueOnce({
        schemaVersion: '1.0',
        kind: 'playbook-release-sync',
        hasDrift: true,
        plan: {
          summary: { recommendedBump: 'patch', reasons: [] },
          tasks: [
            {
              id: 'task-release-alpha',
              file: 'packages/alpha/package.json',
              action: 'Update version',
              task_kind: 'release-package-version',
              provenance: { next_version: '0.41.0' }
            }
          ]
        },
        governanceFailures: [{ id: 'release.requiredVersionBump.missing', message: 'missing bump' }],
        actionableTasks: [{ id: 'task-release-alpha', file: 'packages/alpha/package.json', action: 'Update version', task_kind: 'release-package-version' }],
        drift: [],
        generatedAt: '2026-03-27T00:00:00.000Z',
        mode: 'check'
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
    classifyReleaseSyncReconciliationSpy.mockReturnValue({
      status: 'auto_fixable_drift',
      taskCount: 1,
      plannedVersions: ['0.41.0'],
      reason: 'release drift is auto-fixable via release sync'
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runRelease(repoRoot, ['sync', '--check', '--json'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.kind).toBe('playbook-release-sync');
    expect(payload.hasDrift).toBe(false);
    expect(applySpy).toHaveBeenCalledTimes(1);
    expect(assessReleaseSyncSpy).toHaveBeenCalledTimes(2);
    logSpy.mockRestore();
  });

  it('fails in --check mode when drift is blocked', async () => {
    const repoRoot = createRepo();
    assessReleaseSyncSpy.mockReturnValue({
      schemaVersion: '1.0',
      kind: 'playbook-release-sync',
      hasDrift: true,
      plan: { summary: { recommendedBump: 'minor', reasons: [] }, tasks: [] },
      governanceFailures: [{ id: 'release.versionGroup.inconsistent', message: 'lockstep mismatch' }],
      actionableTasks: [],
      drift: [],
      generatedAt: '2026-03-27T00:00:00.000Z',
      mode: 'check'
    });
    classifyReleaseSyncReconciliationSpy.mockReturnValue({
      status: 'blocked_drift',
      taskCount: 0,
      plannedVersions: [],
      reason: 'lockstep mismatch'
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runRelease(repoRoot, ['sync', '--check', '--json'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Failure);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
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

  it('prints deterministic release drift guidance in check mode', async () => {
    const repoRoot = createRepo();
    assessReleaseSyncSpy.mockReturnValue({
      schemaVersion: '1.0',
      kind: 'playbook-release-sync',
      hasDrift: true,
      plan: {
        summary: { recommendedBump: 'minor', reasons: [] },
        tasks: [
          {
            id: 'task-release-alpha',
            file: 'packages/alpha/package.json',
            action: 'Update version',
            task_kind: 'release-package-version',
            provenance: { next_version: '0.41.0' }
          }
        ]
      },
      governanceFailures: [{ id: 'release.requiredVersionBump.missing', message: 'missing bump' }],
      actionableTasks: [{ id: 'task-release-alpha', file: 'packages/alpha/package.json', action: 'Update version', task_kind: 'release-package-version' }],
      drift: [],
      generatedAt: '2026-03-27T00:00:00.000Z',
      mode: 'check'
    });
    summarizePlannedReleaseVersionsSpy.mockReturnValue(['0.41.0']);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runRelease(repoRoot, ['sync', '--check'], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Failure);
    const output = logSpy.mock.calls.map((call) => String(call[0])).join('\n');
    expect(output).toContain('Release drift detected.');
    expect(output).toContain('Planned release version(s): 0.41.0');
    expect(output).toContain('Actionable tasks: 1');
    expect(output).toContain('pnpm playbook release sync');
    expect(output).toContain('git add .');
    expect(output).toContain('chore(release): apply release plan 0.41.0');

    logSpy.mockRestore();
  });

  it('runs explicit --fix mode through apply and exits aligned', async () => {
    const repoRoot = createRepo();
    assessReleaseSyncSpy
      .mockReturnValueOnce({
        schemaVersion: '1.0',
        kind: 'playbook-release-sync',
        hasDrift: true,
        plan: {
          summary: { recommendedBump: 'minor', reasons: [] },
          tasks: [
            {
              id: 'task-release-alpha',
              file: 'packages/alpha/package.json',
              action: 'Update version',
              task_kind: 'release-package-version',
              provenance: { next_version: '0.41.0' }
            }
          ]
        },
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
        plan: { summary: { recommendedBump: 'minor', reasons: [] }, tasks: [] },
        governanceFailures: [],
        actionableTasks: [],
        drift: [],
        generatedAt: '2026-03-27T00:00:00.000Z',
        mode: 'check'
      });

    const exitCode = await runRelease(repoRoot, ['sync', '--fix', '--json'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);
    expect(applySpy).toHaveBeenCalledTimes(1);
    expect(assessReleaseSyncSpy).toHaveBeenCalledTimes(2);
  });

  it('fails when --check and --fix are both provided', async () => {
    const repoRoot = createRepo();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const exitCode = await runRelease(repoRoot, ['sync', '--check', '--fix'], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Failure);
    expect(String(errorSpy.mock.calls[0]?.[0])).toContain('--check and --fix cannot be used together');
    expect(applySpy).not.toHaveBeenCalled();

    errorSpy.mockRestore();
  });
});
