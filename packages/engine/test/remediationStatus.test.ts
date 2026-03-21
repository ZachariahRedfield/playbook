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
      mode: 'apply',
      retry_policy_decision: 'allow_repair',
      confidence_threshold: 0.7,
      autofix_confidence: 0.45,
      failure_signatures: ['sig-a'],
      triage_classifications: [{ failure_signature: 'sig-a', failure_kind: 'snapshot_drift', repair_class: 'snapshot_refresh', package: null, test_file: null, test_name: null }],
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
      mode: 'apply',
      retry_policy_decision: 'allow_with_preferred_repair_class',
      confidence_threshold: 0.7,
      autofix_confidence: 0.88,
      failure_signatures: ['sig-b'],
      triage_classifications: [{ failure_signature: 'sig-b', failure_kind: 'snapshot_drift', repair_class: 'snapshot_refresh', package: null, test_file: null, test_name: null }],
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
    expect(artifact.telemetry.confidence_buckets).toEqual([
      { key: '0.00-0.49', range: { min: 0, max: 0.49 }, total_runs: 1, fixed: 0, partially_fixed: 0, not_fixed: 1, blocked: 0, success_rate: 0 },
      { key: '0.50-0.69', range: { min: 0.5, max: 0.69 }, total_runs: 0, fixed: 0, partially_fixed: 0, not_fixed: 0, blocked: 0, success_rate: 0 },
      { key: '0.70-0.84', range: { min: 0.7, max: 0.84 }, total_runs: 0, fixed: 0, partially_fixed: 0, not_fixed: 0, blocked: 0, success_rate: 0 },
      { key: '0.85-0.95', range: { min: 0.85, max: 0.95 }, total_runs: 1, fixed: 1, partially_fixed: 0, not_fixed: 0, blocked: 0, success_rate: 1 }
    ]);
    expect(artifact.telemetry.failure_classes).toEqual([
      { failure_class: 'snapshot_drift', total_runs: 2, fixed: 1, partially_fixed: 0, not_fixed: 1, blocked: 0, success_rate: 0.5 }
    ]);
    expect(artifact.telemetry.failure_class_rollup).toEqual([
      {
        failure_class: 'snapshot_drift',
        total_runs: 2,
        fixed: 1,
        partially_fixed: 0,
        not_fixed: 1,
        blocked: 0,
        success_rate: 0.5,
        dry_run_runs: 0,
        apply_runs: 2,
        latest_run_id: 'test-autofix-run-0002',
        sample_failure_signatures: ['sig-a', 'sig-b']
      }
    ]);
    expect(artifact.telemetry.repair_class_rollup).toEqual([
      {
        repair_class: 'snapshot_refresh',
        total_runs: 2,
        successful_runs: 1,
        blocked_runs: 0,
        not_fixed_runs: 1,
        success_rate: 0.5,
        latest_run_id: 'test-autofix-run-0002',
        failure_classes: ['snapshot_drift']
      }
    ]);
    expect(artifact.telemetry.threshold_counterfactuals).toEqual([
      { threshold: 0.5, eligible_runs: 1, successful_eligible_runs: 1, blocked_low_confidence_runs: 0, blocked_runs_that_would_clear: 0, latest_run_would_clear: true, advisory_note: 'Advisory only: no blocked_low_confidence runs would have cleared this threshold.' },
      { threshold: 0.7, eligible_runs: 1, successful_eligible_runs: 1, blocked_low_confidence_runs: 0, blocked_runs_that_would_clear: 0, latest_run_would_clear: true, advisory_note: 'Advisory only: no blocked_low_confidence runs would have cleared this threshold.' },
      { threshold: 0.85, eligible_runs: 1, successful_eligible_runs: 1, blocked_low_confidence_runs: 0, blocked_runs_that_would_clear: 0, latest_run_would_clear: true, advisory_note: 'Advisory only: no blocked_low_confidence runs would have cleared this threshold.' }
    ]);
    expect(artifact.telemetry.dry_run_vs_apply_delta).toEqual({
      dry_run_runs: 0,
      apply_runs: 2,
      dry_run_success_rate: 0,
      apply_success_rate: 0.5,
      success_rate_delta: 0.5,
      blocked_delta: 0,
      advisory_note: 'Advisory only: compares read-only historical outcomes by execution mode without changing policy.'
    });
    expect(artifact.telemetry.manual_review_pressure).toEqual({
      review_required_runs: 0,
      blocked_runs: 0,
      total_manual_pressure_runs: 0,
      top_review_required_signatures: [],
      top_blocked_signatures: [],
      advisory_note: 'Advisory only: highlights where operators may need to inspect recurring failures before tuning thresholds.'
    });
  });



  it('tolerates older latest results that omit confidence fields', () => {
    const artifact = buildRemediationStatusArtifact({
      latestResult: latestResult({
        mode: undefined as never,
        would_apply: undefined as never,
        confidence_threshold: undefined as never,
        autofix_confidence: undefined as never,
        confidence_reasoning: undefined as never
      }),
      history: history(),
      latestResultPath: '.playbook/test-autofix.json',
      remediationHistoryPath: '.playbook/test-autofix-history.json'
    });

    expect(artifact.latest_run.mode).toBe('apply');
    expect(artifact.latest_run.would_apply).toBe(false);
    expect(artifact.latest_run.confidence_threshold).toBe(0);
    expect(artifact.latest_run.autofix_confidence).toBe(0);
    expect(artifact.latest_run.confidence_reasoning).toEqual([]);
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



  it('uses the newest history entry for latest_run_would_clear when the latest artifact is not yet represented in history', () => {
    const artifact = buildRemediationStatusArtifact({
      latestResult: latestResult({
        run_id: 'test-autofix-run-9999',
        generatedAt: '2026-03-21T00:00:00.000Z',
        autofix_confidence: 0,
        confidence_threshold: 0.9
      }),
      history: history(),
      latestResultPath: '.playbook/test-autofix.json',
      remediationHistoryPath: '.playbook/test-autofix-history.json'
    });

    expect(artifact.telemetry.threshold_counterfactuals).toEqual([
      { threshold: 0.5, eligible_runs: 1, successful_eligible_runs: 1, blocked_low_confidence_runs: 0, blocked_runs_that_would_clear: 0, latest_run_would_clear: true, advisory_note: 'Advisory only: no blocked_low_confidence runs would have cleared this threshold.' },
      { threshold: 0.7, eligible_runs: 1, successful_eligible_runs: 1, blocked_low_confidence_runs: 0, blocked_runs_that_would_clear: 0, latest_run_would_clear: true, advisory_note: 'Advisory only: no blocked_low_confidence runs would have cleared this threshold.' },
      { threshold: 0.85, eligible_runs: 1, successful_eligible_runs: 1, blocked_low_confidence_runs: 0, blocked_runs_that_would_clear: 0, latest_run_would_clear: true, advisory_note: 'Advisory only: no blocked_low_confidence runs would have cleared this threshold.' }
    ]);
  });

  it('keeps latest_run_would_clear tied to the latest history run when older eligible runs still clear the threshold', () => {
    const artifact = buildRemediationStatusArtifact({
      latestResult: latestResult({
        run_id: 'test-autofix-run-0004',
        generatedAt: '2026-03-20T00:00:00.000Z',
        failure_signatures: ['sig-a'],
        final_status: 'blocked_low_confidence',
        mode: 'dry_run',
        autofix_confidence: 0.42
      }),
      history: {
        ...history(),
        runs: [
          ...history().runs,
          {
            run_id: 'test-autofix-run-0004',
            generatedAt: '2026-03-20T00:00:00.000Z',
            input: { path: 'failure.log' },
            mode: 'dry_run',
            retry_policy_decision: 'allow_repair',
            confidence_threshold: 0.7,
            autofix_confidence: 0.42,
            failure_signatures: ['sig-a'],
            triage_classifications: [{ failure_signature: 'sig-a', failure_kind: 'snapshot_drift', repair_class: 'snapshot_refresh', package: null, test_file: null, test_name: null }],
            admitted_findings: ['sig-a'],
            excluded_findings: [],
            applied_task_ids: [],
            applied_repair_classes: ['snapshot_refresh'],
            files_touched: [],
            verification_commands: [],
            verification_outcomes: [],
            final_status: 'blocked_low_confidence',
            stop_reasons: ['confidence gate'],
            provenance: { failure_log_path: 'failure.log', triage_artifact_path: 't', fix_plan_artifact_path: 'f', apply_result_path: null, autofix_result_path: 'r' }
          }
        ]
      },
      latestResultPath: '.playbook/test-autofix.json',
      remediationHistoryPath: '.playbook/test-autofix-history.json'
    });

    expect(artifact.telemetry.threshold_counterfactuals).toEqual([
      { threshold: 0.5, eligible_runs: 1, successful_eligible_runs: 1, blocked_low_confidence_runs: 1, blocked_runs_that_would_clear: 0, latest_run_would_clear: false, advisory_note: 'Advisory only: no blocked_low_confidence runs would have cleared this threshold.' },
      { threshold: 0.7, eligible_runs: 1, successful_eligible_runs: 1, blocked_low_confidence_runs: 1, blocked_runs_that_would_clear: 0, latest_run_would_clear: false, advisory_note: 'Advisory only: no blocked_low_confidence runs would have cleared this threshold.' },
      { threshold: 0.85, eligible_runs: 1, successful_eligible_runs: 1, blocked_low_confidence_runs: 1, blocked_runs_that_would_clear: 0, latest_run_would_clear: false, advisory_note: 'Advisory only: no blocked_low_confidence runs would have cleared this threshold.' }
    ]);
  });

  it('reports latest_run_would_clear as false when no eligible runs exist', () => {
    const artifact = buildRemediationStatusArtifact({
      latestResult: latestResult({
        run_id: 'test-autofix-run-0004',
        generatedAt: '2026-03-20T00:00:00.000Z',
        final_status: 'blocked_low_confidence',
        autofix_confidence: 0.2
      }),
      history: {
        ...history(),
        runs: [
          {
            ...history().runs[0]!,
            autofix_confidence: 0.2,
            run_id: 'test-autofix-run-0004',
            generatedAt: '2026-03-20T00:00:00.000Z',
            final_status: 'blocked_low_confidence'
          },
          {
            ...history().runs[1]!,
            run_id: 'test-autofix-run-0003',
            generatedAt: '2026-03-19T12:00:00.000Z',
            autofix_confidence: 0.3,
            final_status: 'not_fixed'
          }
        ]
      },
      latestResultPath: '.playbook/test-autofix.json',
      remediationHistoryPath: '.playbook/test-autofix-history.json'
    });

    expect(artifact.telemetry.threshold_counterfactuals).toEqual([
      { threshold: 0.5, eligible_runs: 0, successful_eligible_runs: 0, blocked_low_confidence_runs: 1, blocked_runs_that_would_clear: 0, latest_run_would_clear: false, advisory_note: 'Advisory only: no blocked_low_confidence runs would have cleared this threshold.' },
      { threshold: 0.7, eligible_runs: 0, successful_eligible_runs: 0, blocked_low_confidence_runs: 1, blocked_runs_that_would_clear: 0, latest_run_would_clear: false, advisory_note: 'Advisory only: no blocked_low_confidence runs would have cleared this threshold.' },
      { threshold: 0.85, eligible_runs: 0, successful_eligible_runs: 0, blocked_low_confidence_runs: 1, blocked_runs_that_would_clear: 0, latest_run_would_clear: false, advisory_note: 'Advisory only: no blocked_low_confidence runs would have cleared this threshold.' }
    ]);
  });

  it('surfaces blocked_low_confidence telemetry and advisory signal from matching successful history', () => {
    const artifact = buildRemediationStatusArtifact({
      latestResult: latestResult({
        run_id: 'test-autofix-run-0004',
        failure_signatures: ['sig-b'],
        final_status: 'blocked_low_confidence',
        mode: 'dry_run',
        autofix_confidence: 0.68
      }),
      history: {
        ...history(),
        runs: [
          ...history().runs,
          {
            run_id: 'test-autofix-run-0004',
            generatedAt: '2026-03-20T00:00:00.000Z',
            input: { path: 'failure.log' },
            mode: 'dry_run',
            retry_policy_decision: 'allow_with_preferred_repair_class',
            confidence_threshold: 0.7,
            autofix_confidence: 0.68,
            failure_signatures: ['sig-b'],
            triage_classifications: [{ failure_signature: 'sig-b', failure_kind: 'snapshot_drift', repair_class: 'snapshot_refresh', package: null, test_file: null, test_name: null }],
            admitted_findings: ['sig-b'],
            excluded_findings: [],
            applied_task_ids: [],
            applied_repair_classes: ['snapshot_refresh'],
            files_touched: [],
            verification_commands: [],
            verification_outcomes: [],
            final_status: 'blocked_low_confidence',
            stop_reasons: ['confidence gate'],
            provenance: { failure_log_path: 'failure.log', triage_artifact_path: 't', fix_plan_artifact_path: 'f', apply_result_path: null, autofix_result_path: 'r' }
          }
        ]
      },
      latestResultPath: '.playbook/test-autofix.json',
      remediationHistoryPath: '.playbook/test-autofix-history.json'
    });

    expect(artifact.telemetry.blocked_low_confidence_runs).toBe(1);
    expect(artifact.telemetry.dry_run_to_apply_ratio).toBe('1:2');
    expect(artifact.telemetry.repeat_policy_block_counts).toEqual([
      { decision: 'blocked_repeat_failure', count: 0 },
      { decision: 'review_required_repeat_failure', count: 0 }
    ]);
    expect(artifact.telemetry.top_repeated_blocked_signatures).toEqual([
      {
        failure_signature: 'sig-b',
        blocked_count: 1,
        latest_run_id: 'test-autofix-run-0004',
        latest_generatedAt: '2026-03-20T00:00:00.000Z',
        historical_success_count: 1
      }
    ]);
    expect(artifact.telemetry.blocked_signature_rollup).toEqual([
      {
        failure_signature: 'sig-b',
        blocked_count: 1,
        latest_run_id: 'test-autofix-run-0004',
        latest_generatedAt: '2026-03-20T00:00:00.000Z',
        historical_success_count: 1
      }
    ]);
    expect(artifact.telemetry.threshold_counterfactuals).toEqual([
      { threshold: 0.5, eligible_runs: 2, successful_eligible_runs: 1, blocked_low_confidence_runs: 1, blocked_runs_that_would_clear: 1, latest_run_would_clear: true, advisory_note: 'Advisory only: some blocked_low_confidence runs would have cleared this threshold.' },
      { threshold: 0.7, eligible_runs: 1, successful_eligible_runs: 1, blocked_low_confidence_runs: 1, blocked_runs_that_would_clear: 0, latest_run_would_clear: false, advisory_note: 'Advisory only: no blocked_low_confidence runs would have cleared this threshold.' },
      { threshold: 0.85, eligible_runs: 1, successful_eligible_runs: 1, blocked_low_confidence_runs: 1, blocked_runs_that_would_clear: 0, latest_run_would_clear: false, advisory_note: 'Advisory only: no blocked_low_confidence runs would have cleared this threshold.' }
    ]);
    expect(artifact.telemetry.dry_run_vs_apply_delta).toEqual({
      dry_run_runs: 1,
      apply_runs: 2,
      dry_run_success_rate: 0,
      apply_success_rate: 0.5,
      success_rate_delta: 0.5,
      blocked_delta: -1,
      advisory_note: 'Advisory only: compares read-only historical outcomes by execution mode without changing policy.'
    });
    expect(artifact.telemetry.conservative_confidence_signal).toEqual({
      confidence_may_be_conservative: true,
      reasoning: 'Latest run was blocked_low_confidence, but prior history contains successful outcomes for matching signatures, so the threshold may be conservative.',
      supporting_failure_signatures: ['sig-b'],
      supporting_failure_classes: ['snapshot_drift']
    });
  });
});


it('is deterministic for identical history presented in different order and degrades safely for older partial entries', () => {
  const unorderedHistory = history();
  unorderedHistory.runs = [unorderedHistory.runs[1]!, unorderedHistory.runs[0]!];
  unorderedHistory.runs.push({
    run_id: 'test-autofix-run-0000',
    generatedAt: '2026-03-17T00:00:00.000Z',
    input: { path: 'failure.log' },
    failure_signatures: ['sig-c'],
    triage_classifications: [],
    admitted_findings: [],
    excluded_findings: [],
    applied_task_ids: [],
    applied_repair_classes: [],
    files_touched: [],
    verification_commands: [],
    verification_outcomes: [],
    final_status: 'review_required_only',
    stop_reasons: ['manual review'],
    provenance: { failure_log_path: 'failure.log', triage_artifact_path: 't', fix_plan_artifact_path: 'f', apply_result_path: null, autofix_result_path: 'r' }
  } as TestAutofixRemediationHistoryArtifact['runs'][number]);

  const artifactA = buildRemediationStatusArtifact({ latestResult: latestResult(), history: history(), latestResultPath: '.playbook/test-autofix.json', remediationHistoryPath: '.playbook/test-autofix-history.json' });
  const artifactB = buildRemediationStatusArtifact({ latestResult: latestResult(), history: unorderedHistory, latestResultPath: '.playbook/test-autofix.json', remediationHistoryPath: '.playbook/test-autofix-history.json' });

  expect(artifactA.telemetry.failure_class_rollup).toEqual([{
    failure_class: 'snapshot_drift',
    total_runs: 2,
    fixed: 1,
    partially_fixed: 0,
    not_fixed: 1,
    blocked: 0,
    success_rate: 0.5,
    dry_run_runs: 0,
    apply_runs: 2,
    latest_run_id: 'test-autofix-run-0002',
    sample_failure_signatures: ['sig-a', 'sig-b']
  }]);
  expect(artifactB.telemetry.failure_class_rollup).toEqual([
    {
      failure_class: 'snapshot_drift',
      total_runs: 2,
      fixed: 1,
      partially_fixed: 0,
      not_fixed: 1,
      blocked: 0,
      success_rate: 0.5,
      dry_run_runs: 0,
      apply_runs: 2,
      latest_run_id: 'test-autofix-run-0002',
      sample_failure_signatures: ['sig-a', 'sig-b']
    }
  ]);
  expect(artifactB.telemetry.manual_review_pressure).toEqual({
    review_required_runs: 1,
    blocked_runs: 0,
    total_manual_pressure_runs: 1,
    top_review_required_signatures: [{
      failure_signature: 'sig-c',
      blocked_count: 1,
      latest_run_id: 'test-autofix-run-0000',
      latest_generatedAt: '2026-03-17T00:00:00.000Z',
      historical_success_count: 0
    }],
    top_blocked_signatures: [],
    advisory_note: 'Advisory only: highlights where operators may need to inspect recurring failures before tuning thresholds.'
  });
  expect(artifactB.telemetry.repair_class_rollup).toEqual([
    {
      repair_class: 'snapshot_refresh',
      total_runs: 2,
      successful_runs: 1,
      blocked_runs: 0,
      not_fixed_runs: 1,
      success_rate: 0.5,
      latest_run_id: 'test-autofix-run-0002',
      failure_classes: ['snapshot_drift']
    }
  ]);
});
