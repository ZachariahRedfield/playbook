import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildTestTriageArtifact, mergeRemediationHistoryArtifacts } from '@zachariahredfield/playbook-engine';
import type { TestAutofixArtifact, TestAutofixRemediationHistoryArtifact } from '@zachariahredfield/playbook-core';
import * as applyCommand from './apply.js';
import { ExitCode } from '../lib/cliContract.js';
import { listRegisteredCommands } from './index.js';
import { runTestAutofix } from './testAutofix.js';
import { runSpawnSync } from '../lib/processRunner.js';

vi.mock('../lib/processRunner.js', () => ({
  runSpawnSync: vi.fn(),
}));

const mockedRunSpawnSync = vi.mocked(runSpawnSync);

const createRepo = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-test-autofix-'));

const writeFailureLog = (repo: string, lines: string[]): void => {
  fs.writeFileSync(path.join(repo, 'failure.log'), lines.join('\n'));
};

const readLoggedArtifact = (spy: ReturnType<typeof vi.spyOn>): TestAutofixArtifact => JSON.parse(String(spy.mock.calls.at(-1)?.[0])) as TestAutofixArtifact;

const readWrittenArtifact = (repo: string): TestAutofixArtifact => {
  const written = JSON.parse(fs.readFileSync(path.join(repo, '.playbook', 'test-autofix.json'), 'utf8')) as { data: TestAutofixArtifact };
  return written.data;
};

const readHistoryArtifact = (repo: string): TestAutofixRemediationHistoryArtifact => {
  const written = JSON.parse(fs.readFileSync(path.join(repo, '.playbook', 'test-autofix-history.json'), 'utf8')) as { data: TestAutofixRemediationHistoryArtifact };
  return written.data;
};

beforeEach(() => {
  mockedRunSpawnSync.mockReset();
  delete process.env.PLAYBOOK_AUTOFIX_CONFIDENCE_THRESHOLD;
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.PLAYBOOK_AUTOFIX_CONFIDENCE_THRESHOLD;
});

describe('runTestAutofix', () => {
  it('orchestrates triage -> fix-plan -> apply -> verification -> fixed and records remediation history', async () => {
    const repo = createRepo();
    writeFailureLog(repo, [
      '@fawxzzy/playbook test: FAIL  packages/cli/src/commands/schema.test.ts',
      '  × renders schema snapshot',
      '    Snapshot `renders schema snapshot 1` mismatch'
    ]);

    vi.spyOn(applyCommand, 'runApply').mockImplementation(async () => {
      console.log(JSON.stringify({
        schemaVersion: '1.0',
        command: 'apply',
        ok: true,
        exitCode: 0,
        results: [{ id: 'task-123', file: 'packages/cli/src/commands/schema.test.ts', ruleId: 'test-triage.snapshot-refresh', status: 'applied' }],
        summary: { applied: 1, skipped: 0, unsupported: 0, failed: 0 }
      }));
      return ExitCode.Success;
    });
    mockedRunSpawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '', pid: 1, output: ['', '', ''], signal: null } as never);

    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runTestAutofix(repo, { format: 'json', quiet: false, input: 'failure.log' });
    const payload = readLoggedArtifact(spy);

    expect(exitCode).toBe(ExitCode.Success);
    expect(payload.final_status).toBe('fixed');
    expect(payload.mode).toBe('apply');
    expect(payload.would_apply).toBe(true);
    expect(payload.autofix_confidence).toBe(0.75);
    expect(payload.run_id).toBe('test-autofix-run-0001');
    expect(payload.applied_task_ids).toEqual(['task-123']);
    expect(payload.retry_policy_decision).toBe('no_history');
    expect(payload.history_summary.matching_run_ids).toEqual([]);
    expect(payload.source_apply.path).toBe('.playbook/test-autofix-apply.json');
    expect(payload.executed_verification_commands.map((entry) => entry.command)).toEqual([
      'pnpm --filter @fawxzzy/playbook exec vitest run packages/cli/src/commands/schema.test.ts',
      'pnpm --filter @fawxzzy/playbook test',
      'pnpm -r test'
    ]);
    expect(mockedRunSpawnSync).toHaveBeenCalledTimes(3);

    const written = readWrittenArtifact(repo);
    expect(written.final_status).toBe('fixed');
    expect(written.source_triage.path).toBe('.playbook/test-triage.json');

    const history = readHistoryArtifact(repo);
    expect(history.runs).toHaveLength(1);
    expect(history.runs[0]?.files_touched).toEqual(['packages/cli/src/commands/schema.test.ts']);
    expect(history.runs[0]?.failure_signatures).toHaveLength(1);
    expect(history.runs[0]?.run_id).toBe('test-autofix-run-0001');
  });

  it('reuses prior successful guidance for the same stable signature', async () => {
    const repo = createRepo();
    writeFailureLog(repo, [
      '@fawxzzy/playbook test: FAIL  packages/cli/src/commands/schema.test.ts',
      '  × renders schema snapshot',
      '    Snapshot `renders schema snapshot 1` mismatch'
    ]);

    vi.spyOn(applyCommand, 'runApply').mockImplementation(async () => {
      console.log(JSON.stringify({
        schemaVersion: '1.0',
        command: 'apply',
        ok: true,
        exitCode: 0,
        results: [{ id: 'task-123', file: 'packages/cli/src/commands/schema.test.ts', ruleId: 'test-triage.snapshot-refresh', status: 'applied' }],
        summary: { applied: 1, skipped: 0, unsupported: 0, failed: 0 }
      }));
      return ExitCode.Success;
    });
    mockedRunSpawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '', pid: 1, output: ['', '', ''], signal: null } as never);

    await runTestAutofix(repo, { format: 'json', quiet: false, input: 'failure.log' });
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runTestAutofix(repo, { format: 'json', quiet: false, input: 'failure.log' });
    const payload = readLoggedArtifact(spy);

    expect(exitCode).toBe(ExitCode.Success);
    expect(payload.retry_policy_decision).toBe('allow_with_preferred_repair_class');
    expect(payload.preferred_repair_class).toBe('snapshot_refresh');
    expect(payload.autofix_confidence).toBe(0.95);
  });


  it('hydrates merged prior CI history so run 2 sees repeat evidence from run 1', async () => {
    const repo = createRepo();
    const failureLog = [
      '@fawxzzy/playbook test: FAIL  packages/cli/src/commands/schema.test.ts',
      '  × renders schema snapshot',
      '    Snapshot `renders schema snapshot 1` mismatch'
    ];
    writeFailureLog(repo, failureLog);

    const signature = buildTestTriageArtifact(failureLog.join('\n'), { input: 'file', path: 'failure.log' }).findings[0]!.failure_signature;
    fs.mkdirSync(path.join(repo, '.playbook'), { recursive: true });
    const hydratedHistory = mergeRemediationHistoryArtifacts([
      {
        sourceId: 'ci-run-1',
        artifactPath: '.playbook/prior/run-1.json',
        artifact: {
          schemaVersion: '1.0',
          kind: 'test-autofix-remediation-history',
          generatedAt: new Date(0).toISOString(),
          runs: [{
            run_id: 'test-autofix-run-0001',
            generatedAt: '2026-03-20T00:00:00.000Z',
            input: { path: 'failure.log' },
            failure_signatures: [signature],
            triage_classifications: [],
            admitted_findings: [],
            excluded_findings: [],
            applied_task_ids: ['task-1'],
            applied_repair_classes: ['snapshot_refresh'],
            files_touched: [],
            verification_commands: ['pnpm -r test'],
            verification_outcomes: [{ command: 'pnpm -r test', exitCode: 0, ok: true }],
            final_status: 'fixed',
            stop_reasons: ['Verification passed after apply.'],
            provenance: { failure_log_path: 'failure.log', triage_artifact_path: '.playbook/test-triage.json', fix_plan_artifact_path: '.playbook/test-fix-plan.json', apply_result_path: '.playbook/test-autofix-apply.json', autofix_result_path: '.playbook/test-autofix.json' }
          }]
        }
      }
    ]);
    fs.writeFileSync(path.join(repo, '.playbook', 'test-autofix-history.json'), JSON.stringify({ data: hydratedHistory }));

    vi.spyOn(applyCommand, 'runApply').mockImplementation(async () => {
      console.log(JSON.stringify({
        schemaVersion: '1.0',
        command: 'apply',
        ok: true,
        exitCode: 0,
        results: [{ id: 'task-123', file: 'packages/cli/src/commands/schema.test.ts', ruleId: 'test-triage.snapshot-refresh', status: 'applied' }],
        summary: { applied: 1, skipped: 0, unsupported: 0, failed: 0 }
      }));
      return ExitCode.Success;
    });
    mockedRunSpawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '', pid: 1, output: ['', '', ''], signal: null } as never);

    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runTestAutofix(repo, { format: 'json', quiet: false, input: 'failure.log' });
    const payload = readLoggedArtifact(spy);

    expect(exitCode).toBe(ExitCode.Success);
    expect(payload.run_id).toBe('test-autofix-run-0002');
    expect(payload.retry_policy_decision).toBe('allow_with_preferred_repair_class');
    expect(payload.history_summary.matching_run_ids).toEqual(['test-autofix-run-0001']);
    expect(payload.history_summary.provenance_run_ids).toEqual(['test-autofix-run-0001']);

    const history = readHistoryArtifact(repo);
    expect(history.runs.map((entry) => entry.run_id)).toEqual(['test-autofix-run-0001', 'test-autofix-run-0002']);
    expect(history.runs[0]?.source_provenance).toEqual({ source_id: 'ci-run-1', artifact_path: '.playbook/prior/run-1.json', original_run_id: 'test-autofix-run-0001' });
    expect(history.runs[1]?.source_provenance?.original_run_id).toBe('test-autofix-run-0002');
  });

  it('blocks repeat mutation when the same repair class already failed twice', async () => {
    const repo = createRepo();
    const failureLog = [
      '@fawxzzy/playbook test: FAIL  packages/cli/src/commands/schema.test.ts',
      '  × renders schema snapshot',
      '    Snapshot `renders schema snapshot 1` mismatch'
    ];
    writeFailureLog(repo, failureLog);

    const signature = buildTestTriageArtifact(failureLog.join('\n'), { input: 'file', path: 'failure.log' }).findings[0]?.failure_signature;
    expect(signature).toBeTruthy();

    fs.mkdirSync(path.join(repo, '.playbook'), { recursive: true });
    const seededHistory: TestAutofixRemediationHistoryArtifact = {
      schemaVersion: '1.0',
      kind: 'test-autofix-remediation-history',
      generatedAt: new Date(0).toISOString(),
      runs: [
        {
          run_id: 'test-autofix-run-0001',
          generatedAt: new Date(0).toISOString(),
          input: { path: 'failure.log' },
          failure_signatures: [signature!],
          triage_classifications: [],
          admitted_findings: [],
          excluded_findings: [],
          applied_task_ids: ['task-1'],
          applied_repair_classes: ['snapshot_refresh'],
          files_touched: [],
          verification_commands: ['pnpm -r test'],
          verification_outcomes: [{ command: 'pnpm -r test', exitCode: 1, ok: false }],
          final_status: 'not_fixed',
          stop_reasons: ['Verification still failed.'],
          provenance: { failure_log_path: 'failure.log', triage_artifact_path: '.playbook/test-triage.json', fix_plan_artifact_path: '.playbook/test-fix-plan.json', apply_result_path: '.playbook/test-autofix-apply.json', autofix_result_path: '.playbook/test-autofix.json' }
        },
        {
          run_id: 'test-autofix-run-0002',
          generatedAt: new Date(0).toISOString(),
          input: { path: 'failure.log' },
          failure_signatures: [signature!],
          triage_classifications: [],
          admitted_findings: [],
          excluded_findings: [],
          applied_task_ids: ['task-1'],
          applied_repair_classes: ['snapshot_refresh'],
          files_touched: [],
          verification_commands: ['pnpm -r test'],
          verification_outcomes: [{ command: 'pnpm -r test', exitCode: 1, ok: false }],
          final_status: 'blocked',
          stop_reasons: ['Verification still failed.'],
          provenance: { failure_log_path: 'failure.log', triage_artifact_path: '.playbook/test-triage.json', fix_plan_artifact_path: '.playbook/test-fix-plan.json', apply_result_path: '.playbook/test-autofix-apply.json', autofix_result_path: '.playbook/test-autofix.json' }
        }
      ]
    };
    fs.writeFileSync(path.join(repo, '.playbook', 'test-autofix-history.json'), JSON.stringify({ data: seededHistory }));

    const applySpy = vi.spyOn(applyCommand, 'runApply');
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runTestAutofix(repo, { format: 'json', quiet: false, input: 'failure.log' });
    const payload = readLoggedArtifact(spy);

    expect(exitCode).toBe(ExitCode.Failure);
    expect(payload.retry_policy_decision).toBe('blocked_repeat_failure');
    expect(payload.final_status).toBe('blocked');
    expect(payload.autofix_confidence).toBe(0);
    expect(payload.apply_result.attempted).toBe(false);
    expect(payload.verification_result.attempted).toBe(false);
    expect(payload.source_apply.path).toBeNull();
    expect(applySpy).not.toHaveBeenCalled();
    expect(mockedRunSpawnSync).not.toHaveBeenCalled();

    const history = readHistoryArtifact(repo);
    expect(history.runs).toHaveLength(3);
    expect(history.runs[2]?.final_status).toBe('blocked');
    expect(history.runs[2]?.provenance.apply_result_path).toBeNull();
  });

  it('supports dry-run mode without calling apply or verification while still surfacing whether mutation would have been allowed', async () => {
    const repo = createRepo();
    writeFailureLog(repo, [
      '@fawxzzy/playbook test: FAIL  packages/cli/src/commands/schema.test.ts',
      '  × renders schema snapshot',
      '    Snapshot `renders schema snapshot 1` mismatch'
    ]);

    const applySpy = vi.spyOn(applyCommand, 'runApply');
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runTestAutofix(repo, { format: 'json', quiet: false, input: 'failure.log', dryRun: true });
    const payload = readLoggedArtifact(spy);

    expect(exitCode).toBe(ExitCode.Failure);
    expect(payload.mode).toBe('dry_run');
    expect(payload.would_apply).toBe(true);
    expect(payload.apply_result.attempted).toBe(false);
    expect(payload.verification_result.attempted).toBe(false);
    expect(payload.source_apply.path).toBeNull();
    expect(applySpy).not.toHaveBeenCalled();
    expect(mockedRunSpawnSync).not.toHaveBeenCalled();
  });

  it('skips mutation when confidence is below threshold', async () => {
    const repo = createRepo();
    writeFailureLog(repo, [
      '@fawxzzy/playbook test: FAIL  packages/cli/src/commands/schema.test.ts',
      '  × renders schema snapshot',
      '    Snapshot `renders schema snapshot 1` mismatch'
    ]);

    const applySpy = vi.spyOn(applyCommand, 'runApply');
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runTestAutofix(repo, { format: 'json', quiet: false, input: 'failure.log', confidenceThreshold: 0.8 });
    const payload = readLoggedArtifact(spy);

    expect(exitCode).toBe(ExitCode.Failure);
    expect(payload.final_status).toBe('blocked_low_confidence');
    expect(payload.autofix_confidence).toBe(0.75);
    expect(payload.would_apply).toBe(false);
    expect(payload.retry_policy_reason).toContain('below threshold 0.80');
    expect(applySpy).not.toHaveBeenCalled();
    expect(mockedRunSpawnSync).not.toHaveBeenCalled();
  });

  it('accepts threshold from PLAYBOOK_AUTOFIX_CONFIDENCE_THRESHOLD and proceeds above threshold', async () => {
    const repo = createRepo();
    writeFailureLog(repo, [
      '@fawxzzy/playbook test: FAIL  packages/cli/src/commands/schema.test.ts',
      '  × renders schema snapshot',
      '    Snapshot `renders schema snapshot 1` mismatch'
    ]);
    process.env.PLAYBOOK_AUTOFIX_CONFIDENCE_THRESHOLD = '0.7';

    vi.spyOn(applyCommand, 'runApply').mockImplementation(async () => {
      console.log(JSON.stringify({
        schemaVersion: '1.0',
        command: 'apply',
        ok: true,
        exitCode: 0,
        results: [{ id: 'task-123', file: 'packages/cli/src/commands/schema.test.ts', ruleId: 'test-triage.snapshot-refresh', status: 'applied' }],
        summary: { applied: 1, skipped: 0, unsupported: 0, failed: 0 }
      }));
      return ExitCode.Success;
    });
    mockedRunSpawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '', pid: 1, output: ['', '', ''], signal: null } as never);

    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runTestAutofix(repo, { format: 'json', quiet: false, input: 'failure.log' });
    const payload = readLoggedArtifact(spy);

    expect(exitCode).toBe(ExitCode.Success);
    expect(payload.confidence_threshold).toBe(0.7);
    expect(payload.would_apply).toBe(true);
    expect(payload.apply_result.attempted).toBe(true);
  });

  it('maps repeated equivalent runs to the same failure signature in history', async () => {
    const repo = createRepo();
    vi.spyOn(applyCommand, 'runApply').mockImplementation(async () => {
      console.log(JSON.stringify({
        schemaVersion: '1.0',
        command: 'apply',
        ok: true,
        exitCode: 0,
        results: [{ id: 'task-123', file: 'packages/cli/src/commands/schema.test.ts', ruleId: 'test-triage.snapshot-refresh', status: 'applied' }],
        summary: { applied: 1, skipped: 0, unsupported: 0, failed: 0 }
      }));
      return ExitCode.Success;
    });
    mockedRunSpawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '', pid: 1, output: ['', '', ''], signal: null } as never);

    writeFailureLog(repo, [
      '@fawxzzy/playbook test: FAIL  packages/cli/src/commands/schema.test.ts',
      '  × renders schema snapshot',
      '    Snapshot `renders schema snapshot 1` mismatch'
    ]);
    await runTestAutofix(repo, { format: 'json', quiet: false, input: 'failure.log' });

    writeFailureLog(repo, [
      '@fawxzzy/playbook test: FAIL  packages/cli/src/commands/schema.test.ts',
      '  × renders schema snapshot ',
      '    Snapshot `renders schema snapshot 2` mismatch'
    ]);
    await runTestAutofix(repo, { format: 'json', quiet: false, input: 'failure.log' });

    const history = readHistoryArtifact(repo);
    expect(history.runs).toHaveLength(2);
    expect(history.runs[0]?.failure_signatures).toEqual(history.runs[1]?.failure_signatures);
  });

  it('stops without mutation for review-required-only findings and records the failed remediation run', async () => {
    const repo = createRepo();
    writeFailureLog(repo, [
      'Error: Cannot find module @esbuild/linux-x64',
      'ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL @fawxzzy/playbook test: `node ./scripts/run-tests.mjs`'
    ]);

    const applySpy = vi.spyOn(applyCommand, 'runApply');
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runTestAutofix(repo, { format: 'json', quiet: false, input: 'failure.log' });
    const payload = readLoggedArtifact(spy);

    expect(exitCode).toBe(ExitCode.Success);
    expect(payload.final_status).toBe('review_required_only');
    expect(payload.apply_result.attempted).toBe(false);
    expect(applySpy).not.toHaveBeenCalled();
    expect(mockedRunSpawnSync).not.toHaveBeenCalled();

    const history = readHistoryArtifact(repo);
    expect(history.runs[0]?.final_status).toBe('review_required_only');
    expect(history.runs[0]?.provenance.apply_result_path).toBeNull();
  });

  it('classifies apply failures as blocked', async () => {
    const repo = createRepo();
    writeFailureLog(repo, [
      '@fawxzzy/playbook test: FAIL  packages/cli/src/commands/schema.test.ts',
      '  × renders schema snapshot',
      '    Snapshot `renders schema snapshot 1` mismatch'
    ]);

    vi.spyOn(applyCommand, 'runApply').mockImplementation(async () => {
      console.log(JSON.stringify({
        schemaVersion: '1.0',
        command: 'apply',
        ok: false,
        exitCode: 1,
        message: 'handler failed',
        results: [{ id: 'task-123', file: 'packages/cli/src/commands/schema.test.ts', ruleId: 'test-triage.snapshot-refresh', status: 'failed' }],
        summary: { applied: 0, skipped: 0, unsupported: 0, failed: 1 }
      }));
      return ExitCode.Failure;
    });

    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runTestAutofix(repo, { format: 'json', quiet: false, input: 'failure.log' });
    const payload = readLoggedArtifact(spy);

    expect(exitCode).toBe(ExitCode.Failure);
    expect(payload.final_status).toBe('blocked');
    expect(payload.verification_result.attempted).toBe(false);
    expect(mockedRunSpawnSync).not.toHaveBeenCalled();
  });

  it('classifies verification failures after apply as partially_fixed', async () => {
    const repo = createRepo();
    writeFailureLog(repo, [
      '@fawxzzy/playbook test: FAIL  packages/cli/src/commands/schema.test.ts',
      '  × renders schema snapshot',
      '    Snapshot `renders schema snapshot 1` mismatch'
    ]);

    vi.spyOn(applyCommand, 'runApply').mockImplementation(async () => {
      console.log(JSON.stringify({
        schemaVersion: '1.0',
        command: 'apply',
        ok: true,
        exitCode: 0,
        results: [{ id: 'task-123', file: 'packages/cli/src/commands/schema.test.ts', ruleId: 'test-triage.snapshot-refresh', status: 'applied' }],
        summary: { applied: 1, skipped: 0, unsupported: 0, failed: 0 }
      }));
      return ExitCode.Success;
    });
    mockedRunSpawnSync
      .mockReturnValueOnce({ status: 0, stdout: '', stderr: '', pid: 1, output: ['', '', ''], signal: null } as never)
      .mockReturnValueOnce({ status: 1, stdout: '', stderr: '', pid: 1, output: ['', '', ''], signal: null } as never);

    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runTestAutofix(repo, { format: 'json', quiet: false, input: 'failure.log' });
    const payload = readLoggedArtifact(spy);

    expect(exitCode).toBe(ExitCode.Failure);
    expect(payload.final_status).toBe('partially_fixed');
    expect(payload.executed_verification_commands).toHaveLength(2);
    expect(payload.executed_verification_commands[1].ok).toBe(false);
    expect(mockedRunSpawnSync).toHaveBeenCalledTimes(2);
  });
});

describe('command registry', () => {
  it('registers the test-autofix command', () => {
    const command = listRegisteredCommands().find((entry) => entry.name === 'test-autofix');
    expect(command).toBeDefined();
    expect(command?.description).toBe('Orchestrate deterministic test diagnosis, bounded repair, apply, and narrow-first verification');
  });
});
