import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { TestAutofixArtifact, TestAutofixRemediationHistoryArtifact } from '@zachariahredfield/playbook-core';
import { ExitCode } from '../lib/cliContract.js';
import { listRegisteredCommands } from './index.js';
import { runRemediationStatus } from './remediationStatus.js';

const createRepo = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-remediation-status-'));

const writeArtifact = (repo: string, relativePath: string, payload: unknown): void => {
  const absolute = path.join(repo, relativePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, JSON.stringify(payload));
};

const baseLatest = (overrides: Partial<TestAutofixArtifact> = {}): TestAutofixArtifact => ({
  schemaVersion: '1.0', kind: 'test-autofix', command: 'test-autofix', generatedAt: '2026-03-20T00:00:00.000Z', run_id: 'test-autofix-run-0003', input: 'failure.log',
  source_triage: { path: '.playbook/test-triage.json', command: 'test-triage' },
  source_fix_plan: { path: '.playbook/test-fix-plan.json', command: 'test-fix-plan' },
  source_apply: { path: '.playbook/test-autofix-apply.json', command: 'apply' },
  remediation_history_path: '.playbook/test-autofix-history.json', mode: 'apply', would_apply: true, confidence_threshold: 0.7, failure_signatures: ['sig-b'],
  history_summary: { matched_signatures: ['sig-b'], matching_run_ids: ['test-autofix-run-0002'], prior_final_statuses: ['fixed'], prior_applied_repair_classes: ['snapshot_refresh'], prior_successful_repair_classes: ['snapshot_refresh'], repeated_failed_repair_attempts: [], provenance_run_ids: ['test-autofix-run-0002'] },
  preferred_repair_class: 'snapshot_refresh', autofix_confidence: 0.95, confidence_reasoning: ['reason-a'], retry_policy_decision: 'allow_with_preferred_repair_class', retry_policy_reason: 'History matched.',
  apply_result: { attempted: true, ok: true, exitCode: 0, applied: 1, skipped: 0, unsupported: 0, failed: 0, message: null },
  verification_result: { attempted: true, ok: true, total: 1, passed: 1, failed: 0 }, executed_verification_commands: [{ command: 'pnpm -r test', exitCode: 0, ok: true }], applied_task_ids: ['task-1'],
  excluded_finding_summary: { total: 0, review_required: 0, by_reason: [] }, final_status: 'fixed', stop_reasons: ['done'], reason: 'done',
  ...overrides
});

const baseHistory = (runs: TestAutofixRemediationHistoryArtifact['runs']): TestAutofixRemediationHistoryArtifact => ({
  schemaVersion: '1.0', kind: 'test-autofix-remediation-history', generatedAt: '2026-03-20T00:00:00.000Z', runs
});

describe('runRemediationStatus', () => {
  it('fails clearly when required artifacts are missing', async () => {
    const repo = createRepo();
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runRemediationStatus(repo, { format: 'json', quiet: false });
    const payload = JSON.parse(String(spy.mock.calls.at(-1)?.[0]));

    expect(exitCode).toBe(ExitCode.Failure);
    expect(payload.error).toContain('required artifact is missing or invalid');
  });

  it('surfaces latest successful autofix guidance in JSON mode', async () => {
    const repo = createRepo();
    writeArtifact(repo, '.playbook/test-autofix.json', baseLatest());
    writeArtifact(repo, '.playbook/test-autofix-history.json', baseHistory([
      {
        run_id: 'test-autofix-run-0002', generatedAt: '2026-03-19T00:00:00.000Z', input: { path: 'failure.log' }, mode: 'apply', retry_policy_decision: 'allow_with_preferred_repair_class', confidence_threshold: 0.7, autofix_confidence: 0.95, failure_signatures: ['sig-b'], triage_classifications: [{ failure_signature: 'sig-b', failure_kind: 'snapshot_drift', repair_class: 'snapshot_refresh', package: null, test_file: null, test_name: null }], admitted_findings: ['sig-b'], excluded_findings: [], applied_task_ids: ['task-b'], applied_repair_classes: ['snapshot_refresh'], files_touched: [], verification_commands: ['pnpm -r test'], verification_outcomes: [{ command: 'pnpm -r test', exitCode: 0, ok: true }], final_status: 'fixed', stop_reasons: ['fixed'], provenance: { failure_log_path: 'failure.log', triage_artifact_path: 't', fix_plan_artifact_path: 'f', apply_result_path: 'a', autofix_result_path: 'r' }
      }
    ]));

    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runRemediationStatus(repo, { format: 'json', quiet: false });
    const payload = JSON.parse(String(spy.mock.calls.at(-1)?.[0]));
    expect(exitCode).toBe(ExitCode.Success);
    expect(payload.latest_run.final_status).toBe('fixed');
    expect(payload.latest_run.preferred_repair_class).toBe('snapshot_refresh');
    expect(payload.latest_run.mode).toBe('apply');
    expect(payload.latest_run.autofix_confidence).toBe(0.95);
    expect(payload.safe_to_retry_signatures).toEqual(['sig-b']);
    expect(payload.telemetry.confidence_buckets.at(-1)).toMatchObject({ key: '0.85-0.95', total_runs: 1, success_rate: 1 });
    expect(payload.telemetry.failure_classes).toEqual([{ failure_class: 'snapshot_drift', total_runs: 1, fixed: 1, partially_fixed: 0, not_fixed: 0, blocked: 0, success_rate: 1 }]);
    expect(payload.telemetry.failure_class_rollup).toEqual([{ failure_class: 'snapshot_drift', total_runs: 1, fixed: 1, partially_fixed: 0, not_fixed: 0, blocked: 0, success_rate: 1, dry_run_runs: 0, apply_runs: 1, latest_run_id: 'test-autofix-run-0002', sample_failure_signatures: ['sig-b'] }]);
    expect(payload.telemetry.threshold_counterfactuals).toEqual([
      { threshold: 0.5, eligible_runs: 1, successful_eligible_runs: 1, blocked_low_confidence_runs: 0, blocked_runs_that_would_clear: 0, latest_run_would_clear: true, advisory_note: 'Advisory only: no blocked_low_confidence runs would have cleared this threshold.' },
      { threshold: 0.7, eligible_runs: 1, successful_eligible_runs: 1, blocked_low_confidence_runs: 0, blocked_runs_that_would_clear: 0, latest_run_would_clear: true, advisory_note: 'Advisory only: no blocked_low_confidence runs would have cleared this threshold.' },
      { threshold: 0.85, eligible_runs: 1, successful_eligible_runs: 1, blocked_low_confidence_runs: 0, blocked_runs_that_would_clear: 0, latest_run_would_clear: true, advisory_note: 'Advisory only: no blocked_low_confidence runs would have cleared this threshold.' }
    ]);
  });

  it('surfaces blocked repeat-failure status and deterministic history ordering in text mode', async () => {
    const repo = createRepo();
    writeArtifact(repo, '.playbook/test-autofix.json', baseLatest({ failure_signatures: ['sig-a'], retry_policy_decision: 'blocked_repeat_failure', preferred_repair_class: null, final_status: 'blocked' }));
    writeArtifact(repo, '.playbook/test-autofix-history.json', baseHistory([
      {
        run_id: 'test-autofix-run-0001', generatedAt: '2026-03-18T00:00:00.000Z', input: { path: 'failure.log' }, mode: 'apply', retry_policy_decision: 'allow_repair', confidence_threshold: 0.7, autofix_confidence: 0.45, failure_signatures: ['sig-a'], triage_classifications: [{ failure_signature: 'sig-a', failure_kind: 'snapshot_drift', repair_class: 'snapshot_refresh', package: null, test_file: null, test_name: null }], admitted_findings: ['sig-a'], excluded_findings: [], applied_task_ids: ['task-a'], applied_repair_classes: ['snapshot_refresh'], files_touched: [], verification_commands: ['pnpm -r test'], verification_outcomes: [{ command: 'pnpm -r test', exitCode: 1, ok: false }], final_status: 'not_fixed', stop_reasons: ['failed'], provenance: { failure_log_path: 'failure.log', triage_artifact_path: 't', fix_plan_artifact_path: 'f', apply_result_path: 'a', autofix_result_path: 'r' }
      },
      {
        run_id: 'test-autofix-run-0002', generatedAt: '2026-03-19T00:00:00.000Z', input: { path: 'failure.log' }, mode: 'apply', retry_policy_decision: 'blocked_repeat_failure', confidence_threshold: 0.7, autofix_confidence: 0, failure_signatures: ['sig-a'], triage_classifications: [{ failure_signature: 'sig-a', failure_kind: 'snapshot_drift', repair_class: 'snapshot_refresh', package: null, test_file: null, test_name: null }], admitted_findings: ['sig-a'], excluded_findings: [], applied_task_ids: ['task-a'], applied_repair_classes: ['snapshot_refresh'], files_touched: [], verification_commands: ['pnpm -r test'], verification_outcomes: [{ command: 'pnpm -r test', exitCode: 1, ok: false }], final_status: 'blocked', stop_reasons: ['blocked'], provenance: { failure_log_path: 'failure.log', triage_artifact_path: 't', fix_plan_artifact_path: 'f', apply_result_path: 'a', autofix_result_path: 'r' }
      }
    ]));

    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runRemediationStatus(repo, { format: 'text', quiet: false });
    const output = String(spy.mock.calls.at(-1)?.[0]);
    expect(exitCode).toBe(ExitCode.Success);
    expect(output).toContain('Blocked signatures');
    expect(output).toContain('sig-a');
    expect(output).toContain('Recent repeated failures');
    expect(output).toContain('Calibration telemetry');
    expect(output).toContain('Confidence buckets');
    expect(output).toContain('Failure-class rollup');
    expect(output).toContain('Repair-class rollup');
    expect(output).toContain('Threshold counterfactuals');
    expect(output).toContain('Dry-run vs apply delta');
    expect(output).toContain('Manual review pressure');
  });

  it('degrades safely with partial history records in JSON mode', async () => {
    const repo = createRepo();
    writeArtifact(repo, '.playbook/test-autofix.json', baseLatest({ run_id: 'test-autofix-run-0004', failure_signatures: ['sig-c'], final_status: 'review_required_only', retry_policy_decision: 'review_required_repeat_failure', preferred_repair_class: null, would_apply: false }));
    writeArtifact(repo, '.playbook/test-autofix-history.json', baseHistory([
      {
        run_id: 'test-autofix-run-0004', generatedAt: '2026-03-20T00:00:00.000Z', input: { path: 'failure.log' }, failure_signatures: ['sig-c'], triage_classifications: [], admitted_findings: [], excluded_findings: [], applied_task_ids: [], applied_repair_classes: [], files_touched: [], verification_commands: [], verification_outcomes: [], final_status: 'review_required_only', stop_reasons: ['manual review'], provenance: { failure_log_path: 'failure.log', triage_artifact_path: 't', fix_plan_artifact_path: 'f', apply_result_path: null, autofix_result_path: 'r' }
      }
    ]));

    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runRemediationStatus(repo, { format: 'json', quiet: false });
    const payload = JSON.parse(String(spy.mock.calls.at(-1)?.[0]));

    expect(exitCode).toBe(ExitCode.Success);
    expect(payload.telemetry.manual_review_pressure).toEqual({
      review_required_runs: 1,
      blocked_runs: 0,
      total_manual_pressure_runs: 1,
      top_review_required_signatures: [{ failure_signature: 'sig-c', blocked_count: 1, latest_run_id: 'test-autofix-run-0004', latest_generatedAt: '2026-03-20T00:00:00.000Z', historical_success_count: 0 }],
      top_blocked_signatures: [],
      advisory_note: 'Advisory only: highlights where operators may need to inspect recurring failures before tuning thresholds.'
    });
  });

  it('registers the remediation-status command', () => {
    const command = listRegisteredCommands().find((entry) => entry.name === 'remediation-status');
    expect(command).toBeDefined();
    expect(command?.description).toBe('Inspect recent test-autofix remediation history, repeat-policy decisions, and retry guidance');
  });
});
