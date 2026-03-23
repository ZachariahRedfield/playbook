import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { buildTestTriageArtifact } from '@zachariahredfield/playbook-engine';
import { ExitCode } from '../lib/cliContract.js';
import { listRegisteredCommands } from './index.js';
import { runTestFixPlan } from './testFixPlan.js';

const createRepo = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-test-fix-plan-'));

const writeJson = (filePath: string, value: unknown): void => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
};

describe('runTestFixPlan', () => {
  it('returns a stable json error when the triage input is missing', async () => {
    const repo = createRepo();
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runTestFixPlan(repo, { format: 'json', quiet: false });
    const payload = JSON.parse(String(spy.mock.calls.at(-1)?.[0])) as Record<string, unknown>;

    expect(exitCode).toBe(ExitCode.Failure);
    expect(payload.command).toBe('test-fix-plan');
    expect(String(payload.error)).toContain('--from-triage');
    spy.mockRestore();
  });

  it('rejects invalid triage artifacts', async () => {
    const repo = createRepo();
    const invalidPath = path.join(repo, 'invalid.json');
    writeJson(invalidPath, { schemaVersion: '1.0', command: 'verify', findings: [] });
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runTestFixPlan(repo, { format: 'json', quiet: false, fromTriage: 'invalid.json' });
    const payload = JSON.parse(String(spy.mock.calls.at(-1)?.[0])) as Record<string, unknown>;

    expect(exitCode).toBe(ExitCode.Failure);
    expect(String(payload.error)).toContain('invalid test-triage artifact');
    spy.mockRestore();
  });

  it('writes a valid low-risk artifact and emits deterministic json output', async () => {
    const repo = createRepo();
    const triagePath = path.join(repo, '.playbook', 'triage.json');
    const triage = buildTestTriageArtifact([
      '@fawxzzy/playbook test: FAIL  packages/cli/src/commands/schema.test.ts',
      '  × renders schema snapshot',
      '    Snapshot `renders schema snapshot 1` mismatch'
    ].join('\n'), { input: 'file', path: '.playbook/ci-failure.log' });
    writeJson(triagePath, triage);

    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const firstExit = await runTestFixPlan(repo, { format: 'json', quiet: false, fromTriage: '.playbook/triage.json' });
    const first = String(spy.mock.calls.at(-1)?.[0]);
    const secondExit = await runTestFixPlan(repo, { format: 'json', quiet: false, fromTriage: '.playbook/triage.json' });
    const second = String(spy.mock.calls.at(-1)?.[0]);

    expect(firstExit).toBe(ExitCode.Success);
    expect(secondExit).toBe(ExitCode.Success);
    expect(second).toBe(first);

    const payload = JSON.parse(first) as { tasks: Array<{ ruleId: string; file: string; task_kind: string }>; summary: { eligible_findings: number }; };
    expect(payload.summary.eligible_findings).toBe(1);
    expect(payload.tasks).toEqual([
      expect.objectContaining({
        ruleId: 'test-triage.snapshot-refresh',
        file: 'packages/cli/src/commands/schema.test.ts',
        task_kind: 'snapshot_refresh'
      })
    ]);

    const written = JSON.parse(fs.readFileSync(path.join(repo, '.playbook', 'test-fix-plan.json'), 'utf8')) as { data: { command: string; summary: { eligible_findings: number } } };
    expect(written.data.command).toBe('test-fix-plan');
    expect(written.data.summary.eligible_findings).toBe(1);
    spy.mockRestore();
  });

  it('preserves rejected risky findings as exclusions instead of executable tasks', async () => {
    const repo = createRepo();
    const triagePath = path.join(repo, '.playbook', 'triage.json');
    const triage = buildTestTriageArtifact([
      'Error: Cannot find module @esbuild/linux-x64',
      'ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL @fawxzzy/playbook test: `node ./scripts/run-tests.mjs`'
    ].join('\n'), { input: 'file', path: '.playbook/ci-failure.log' });
    writeJson(triagePath, triage);

    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runTestFixPlan(repo, { format: 'json', quiet: false, fromTriage: '.playbook/triage.json' });
    const payload = JSON.parse(String(spy.mock.calls.at(-1)?.[0])) as { tasks: unknown[]; excluded: Array<{ reason: string; failure_kind: string; repair_class: string; summary: string }>; summary: { excluded_findings: number } };

    expect(exitCode).toBe(ExitCode.Success);
    expect(payload.tasks).toEqual([]);
    expect(payload.excluded).toHaveLength(2);
    expect(payload.summary.excluded_findings).toBe(payload.excluded.length);
    expect(payload.summary.excluded_findings).toBe(2);
    expect(payload.excluded).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reason: 'risky_or_review_required',
        failure_kind: 'recursive_workspace_failure',
        repair_class: 'review_required',
        summary: 'ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL @fawxzzy/playbook test: `node ./scripts/run-tests.mjs`'
      }),
      expect.objectContaining({
        reason: 'risky_or_review_required',
        failure_kind: 'environment_limitation',
        repair_class: 'review_required',
        summary: 'Error: Cannot find module @esbuild/linux-x64'
      })
    ]));
    spy.mockRestore();
  });
});

describe('command registry', () => {
  it('registers the test-fix-plan command', () => {
    const command = listRegisteredCommands().find((entry) => entry.name === 'test-fix-plan');
    expect(command).toBeDefined();
    expect(command?.description).toBe('Generate a bounded remediation plan from a deterministic test-triage artifact');
  });
});
