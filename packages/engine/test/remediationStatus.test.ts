import { describe, expect, it } from 'vitest';
import type { TestAutofixArtifact, TestAutofixRemediationHistoryArtifact } from '@zachariahredfield/playbook-core';
import { buildRemediationStatusArtifact } from '../src/testAutofix/remediationStatus.js';

const latestResult = (overrides: Partial<TestAutofixArtifact> = {}): TestAutofixArtifact => ({
  schemaVersion: '1.0',
  kind: 'test-autofix',
  command: 'test-autofix',
  generatedAt: '2026-03-20T00:00:00.000Z',
  run_id: 'test-autofix-run-0003',
  input: 'failure.log',
  source_triage: { path: '.playbook/test-triage.json', command: 'test-triage' },
  source_fix_plan: { path: '.playbook/test-fix-plan.json', command: 'test-fix-plan' },
  source_apply: { path: '.playbook/test-autofix-apply.json', command: 'apply' },
  remediation_history_path: '.playbook/test-autofix-history.json',
  failure_signatures: ['sig-b'],
  history_summary: {
    matched_signatures: ['sig-b'],
    matching_run_ids: ['test-autofix-run-0002'],
    prior_final_statuses: ['fixed'],
    prior_applied_repair_classes: ['snapshot_refresh'],
    prior_successful_repair_classes: ['snapshot_refresh'],
    repeated_failed_repair_attempts: [],
    provenance_run_ids: ['test-autofix-run-0002']
  },
  preferred_repair_class: 'snapshot_refresh',
  retry_policy_decision: 'allow_with_preferred_repair_class',
  retry_policy_reason: 'History matched.',
  apply_result: { attempted: true, ok: true, exitCode: 0, applied: 1, skipped: 0, unsupported: 0, failed: 0, message: null },
  verification_result: { attempted: true, ok: true, total: 1, passed: 1, failed: 0 },
  executed_verification_commands: [{ command: 'pnpm -r test', exitCode: 0, ok: true }],
  applied_task_ids: ['task-1'],
  excluded_finding_summary: { total: 0, review_required: 0, by_reason: [] },
  final_status: 'fixed',
  stop_reasons: ['Verification passed.'],
  reason: 'Fixed.' ,
  ...overrides
});

const history = (): TestAutofixRemediationHistoryArtifact => ({
  schemaVersion: '1.0',
  kind: 'test-autofix-remediation-history',
  generatedAt: '2026-03-20T00:00:00.000Z',
  runs: [
    {
      run_id: 'test-autofix-run-0001',
      generatedAt: '2026-03-18T00:00:00.000Z',
      input: { path: 'failure.log' },
      failure_signatures: ['sig-a'],
      triage_classifications: [],
      admitted_findings: ['sig-a'],
      excluded_findings: [],
      applied_task_ids: ['task-a'],
      applied_repair_classes: ['snapshot_refresh'],
      files_touched: [],
      verification_commands: ['pnpm -r test'],
      verification_outcomes: [{ command: 'pnpm -r test', exitCode: 1, ok: false }],
      final_status: 'not_fixed',
      stop_reasons: ['failed'],
      provenance: { failure_log_path: 'failure.log', triage_artifact_path: 't', fix_plan_artifact_path: 'f', apply_result_path: 'a', autofix_result_path: 'r' }
    },
    {
      run_id: 'test-autofix-run-0002',
      generatedAt: '2026-03-19T00:00:00.000Z',
      input: { path: 'failure.log' },
      failure_signatures: ['sig-b'],
      triage_classifications: [],
      admitted_findings: ['sig-b'],
      excluded_findings: [],
      applied_task_ids: ['task-b'],
      applied_repair_classes: ['snapshot_refresh'],
      files_touched: [],
      verification_commands: ['pnpm -r test'],
      verification_outcomes: [{ command: 'pnpm -r test', exitCode: 0, ok: true }],
      final_status: 'fixed',
      stop_reasons: ['fixed'],
      provenance: { failure_log_path: 'failure.log', triage_artifact_path: 't', fix_plan_artifact_path: 'f', apply_result_path: 'a', autofix_result_path: 'r' }
    }
  ]
});

describe('buildRemediationStatusArtifact', () => {
  it('keeps remediation history sorted newest-first and surfaces preferred guidance', () => {
    const artifact = buildRemediationStatusArtifact({
      latestResult: latestResult(),
      history: history(),
      latestResultPath: '.playbook/test-autofix.json',
      remediationHistoryPath: '.playbook/test-autofix-history.json'
    });

    expect(artifact.remediation_history.map((entry) => entry.run_id)).toEqual(['test-autofix-run-0002', 'test-autofix-run-0001']);
    expect(artifact.preferred_repair_classes).toEqual([
      {
        repair_class: 'snapshot_refresh',
        success_count: 1,
        latest_success_run_id: 'test-autofix-run-0002',
        failure_signatures: ['sig-b']
      }
    ]);
    expect(artifact.safe_to_retry_signatures).toEqual(['sig-b']);
  });

  it('marks blocked retry outlook when latest policy blocks replay', () => {
    const blocked = buildRemediationStatusArtifact({
      latestResult: latestResult({
        failure_signatures: ['sig-a'],
        retry_policy_decision: 'blocked_repeat_failure',
        preferred_repair_class: null,
        final_status: 'blocked'
      }),
      history: history(),
      latestResultPath: '.playbook/test-autofix.json',
      remediationHistoryPath: '.playbook/test-autofix-history.json'
    });

    expect(blocked.blocked_signatures).toEqual(['sig-a']);
    expect(blocked.stable_failure_signatures.find((entry) => entry.failure_signature === 'sig-a')?.retry_outlook).toBe('blocked');
  });
});
