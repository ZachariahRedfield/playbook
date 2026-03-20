import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';
import { listRegisteredCommands } from './index.js';
import { runTestFixPlan } from './testFixPlan.js';

const createRepo = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-test-fix-plan-'));

const writeJson = (repo: string, relativePath: string, value: unknown): void => {
  const absolute = path.join(repo, relativePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const lowRiskArtifact = {
  schemaVersion: '1.0',
  kind: 'test-triage',
  command: 'test-triage',
  generatedAt: '1970-01-01T00:00:00.000Z',
  source: { input: 'file', path: '.playbook/ci-failure.log' },
  findings: [
    {
      failure_kind: 'snapshot_drift',
      confidence: 0.95,
      package: '@fawxzzy/playbook',
      test_file: 'src/commands/testFixPlan.test.ts',
      test_name: 'accepts low-risk triage artifacts',
      likely_files_to_modify: ['src/commands/testFixPlan.test.ts', 'src/commands/testFixPlan.test.ts.snap'],
      suggested_fix_strategy: 'Update the narrow test-only fixture after validating output.',
      verification_commands: ['pnpm --filter @fawxzzy/playbook test -- src/commands/testFixPlan.test.ts'],
      docs_update_recommendation: 'No docs update needed unless operator text changes.',
      rule_pattern_failure_mode: {
        rule: 'diagnosis first',
        pattern: 'low-risk triage before repair planning',
        failure_mode: 'blind fix planning drifts from evidence'
      },
      repair_class: 'autofix_plan_only',
      summary: 'Snapshot mismatch in testFixPlan output.',
      evidence: ['Snapshot mismatch in testFixPlan output.']
    }
  ],
  rerun_plan: {
    strategy: 'file_first_then_package_then_workspace',
    commands: ['pnpm --filter @fawxzzy/playbook test -- src/commands/testFixPlan.test.ts']
  },
  repair_plan: {
    summary: '1 low-risk finding can be planned.',
    codex_prompt: 'Only plan low-risk test-only repairs.',
    suggested_actions: ['Plan a narrow test-only fix.']
  }
};

describe('runTestFixPlan', () => {
  it('returns a stable json error when input is missing', async () => {
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
    writeJson(repo, 'broken-triage.json', { kind: 'not-triage' });
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runTestFixPlan(repo, { format: 'json', quiet: false, fromTriage: 'broken-triage.json' });
    const payload = JSON.parse(String(spy.mock.calls.at(-1)?.[0])) as Record<string, unknown>;

    expect(exitCode).toBe(ExitCode.Failure);
    expect(String(payload.error)).toContain('test-triage artifact');
    spy.mockRestore();
  });

  it('writes a valid low-risk artifact', async () => {
    const repo = createRepo();
    writeJson(repo, 'triage.json', lowRiskArtifact);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runTestFixPlan(repo, { format: 'json', quiet: false, fromTriage: 'triage.json', outFile: '.playbook/custom-fix-plan.json' });
    const payload = JSON.parse(String(spy.mock.calls.at(-1)?.[0])) as Record<string, unknown>;
    const written = JSON.parse(fs.readFileSync(path.join(repo, '.playbook/custom-fix-plan.json'), 'utf8')) as Record<string, unknown>;

    expect(exitCode).toBe(ExitCode.Success);
    expect(payload.status).toBe('ready');
    expect(payload.artifact_path).toBe('.playbook/custom-fix-plan.json');
    expect(Array.isArray(payload.actions)).toBe(true);
    expect(written).toEqual(payload);
    spy.mockRestore();
  });

  it('rejects risky findings while still emitting deterministic json', async () => {
    const repo = createRepo();
    writeJson(repo, 'triage.json', {
      ...lowRiskArtifact,
      findings: [
        ...lowRiskArtifact.findings,
        {
          ...lowRiskArtifact.findings[0],
          failure_kind: 'likely_regression',
          repair_class: 'review_required',
          summary: 'Potential production regression requires review.'
        }
      ]
    });
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runTestFixPlan(repo, { format: 'json', quiet: false, fromTriage: 'triage.json' });
    const payload = JSON.parse(String(spy.mock.calls.at(-1)?.[0])) as Record<string, unknown>;

    expect(exitCode).toBe(ExitCode.Failure);
    expect(payload.status).toBe('rejected');
    expect((payload.blocked_findings as Array<unknown>).length).toBe(1);
    spy.mockRestore();
  });

  it('emits deterministic output for the same triage artifact', async () => {
    const repo = createRepo();
    writeJson(repo, 'triage.json', lowRiskArtifact);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const firstExit = await runTestFixPlan(repo, { format: 'json', quiet: false, fromTriage: 'triage.json' });
    const first = String(spy.mock.calls.at(-1)?.[0]);
    const secondExit = await runTestFixPlan(repo, { format: 'json', quiet: false, fromTriage: 'triage.json' });
    const second = String(spy.mock.calls.at(-1)?.[0]);

    expect(firstExit).toBe(ExitCode.Success);
    expect(secondExit).toBe(ExitCode.Success);
    expect(second).toBe(first);
    spy.mockRestore();
  });
});

describe('command registry', () => {
  it('registers the test-fix-plan command', () => {
    const command = listRegisteredCommands().find((entry) => entry.name === 'test-fix-plan');
    expect(command).toBeDefined();
    expect(command?.description).toBe('Build deterministic test-only fix planning from a test-triage artifact');
  });
});
