import { describe, expect, it } from 'vitest';
import { buildTestFixPlanArtifact } from '../src/testFixPlan.js';
import { buildTestTriageArtifact } from '../src/testTriage.js';
import {
  appendRemediationHistoryEntry,
  createEmptyRemediationHistoryArtifact,
  computeAutofixConfidence,
  evaluateRepeatRemediationPolicy,
  listPriorSuccessfulRepairClasses,
  listRepeatedFailedRepairAttempts,
  listRunsByFailureSignature,
  mergeRemediationHistoryArtifacts,
  nextRemediationHistoryRunId
} from '../src/testAutofix/remediationHistory.js';

const buildSnapshotTriage = (snapshotIndex: number): ReturnType<typeof buildTestTriageArtifact> => buildTestTriageArtifact([
  '@fawxzzy/playbook test: FAIL  packages/cli/src/commands/schema.test.ts',
  '  × renders schema snapshot',
  `    Snapshot \`renders schema snapshot ${snapshotIndex}\` mismatch`
].join('\n'), { input: 'file', path: 'failure.log' });

const appendHistoryRun = (base: ReturnType<typeof createEmptyRemediationHistoryArtifact>, options: { signature: string; runId: string; finalStatus: 'fixed' | 'partially_fixed' | 'blocked' | 'not_fixed'; repairClasses: string[]; verificationOk: boolean }) => appendRemediationHistoryEntry(base, {
  run_id: options.runId,
  generatedAt: new Date(0).toISOString(),
  input: { path: 'failure.log' },
  failure_signatures: [options.signature],
  triage_classifications: [{
    failure_signature: options.signature,
    failure_kind: 'snapshot_drift',
    repair_class: 'autofix_plan_only',
    package: '@fawxzzy/playbook',
    test_file: 'packages/cli/src/commands/schema.test.ts',
    test_name: 'renders schema snapshot'
  }],
  admitted_findings: [options.signature],
  excluded_findings: [],
  applied_task_ids: ['task-1'],
  applied_repair_classes: options.repairClasses,
  files_touched: ['packages/cli/src/commands/schema.test.ts'],
  verification_commands: ['pnpm -r test'],
  verification_outcomes: [{ command: 'pnpm -r test', exitCode: options.verificationOk ? 0 : 1, ok: options.verificationOk }],
  final_status: options.finalStatus,
  stop_reasons: [options.verificationOk ? 'Verification passed after apply.' : 'Verification still failed.'],
  provenance: { failure_log_path: 'failure.log', triage_artifact_path: '.playbook/test-triage.json', fix_plan_artifact_path: '.playbook/test-fix-plan.json', apply_result_path: '.playbook/test-autofix-apply.json', autofix_result_path: '.playbook/test-autofix.json' }
});

describe('test-autofix remediation history helpers', () => {
  it('derives the same failure signature for equivalent reruns with line noise differences', () => {
    const first = buildTestTriageArtifact([
      '@fawxzzy/playbook test: FAIL  packages/cli/src/commands/schema.test.ts',
      '  × renders schema snapshot',
      '    Snapshot `renders schema snapshot 1` mismatch',
      '    Expected: "alpha beta"',
      '    Received: "alpha   beta"'
    ].join('\n'), { input: 'file', path: 'failure.log' });

    const second = buildTestTriageArtifact([
      '@fawxzzy/playbook test: FAIL  packages/cli/src/commands/schema.test.ts',
      '  × renders schema snapshot ',
      '    Snapshot `renders schema snapshot 2` mismatch',
      '    Expected: "alpha beta"',
      '    Received: "alpha beta"'
    ].join('\n'), { input: 'file', path: 'failure.log' });

    expect(first.findings[0]?.failure_signature).toBe(second.findings[0]?.failure_signature);
  });


  it('merges multiple history artifacts deterministically and preserves source provenance', () => {
    const signature = buildSnapshotTriage(1).findings[0]!.failure_signature;
    const firstArtifact = appendHistoryRun(createEmptyRemediationHistoryArtifact(), { signature, runId: 'test-autofix-run-0001', finalStatus: 'fixed', repairClasses: ['snapshot_refresh'], verificationOk: true });
    const secondArtifact = appendHistoryRun(createEmptyRemediationHistoryArtifact(), { signature, runId: 'test-autofix-run-0001', finalStatus: 'not_fixed', repairClasses: ['snapshot_refresh'], verificationOk: false });

    const merged = mergeRemediationHistoryArtifacts([
      { artifact: secondArtifact, artifactPath: '.playbook/history/run-2.json', sourceId: 'ci-run-2' },
      { artifact: firstArtifact, artifactPath: '.playbook/history/run-1.json', sourceId: 'ci-run-1' }
    ]);

    expect(merged.runs.map((entry) => entry.run_id)).toEqual(['test-autofix-run-0001', 'test-autofix-run-0002']);
    expect(merged.runs.map((entry) => entry.source_provenance)).toEqual([
      { source_id: 'ci-run-1', artifact_path: '.playbook/history/run-1.json', original_run_id: 'test-autofix-run-0001' },
      { source_id: 'ci-run-2', artifact_path: '.playbook/history/run-2.json', original_run_id: 'test-autofix-run-0001' }
    ]);
  });

  it('records history and supports repeated-failure lookup', () => {
    const triage = buildSnapshotTriage(1);
    const signature = triage.findings[0]?.failure_signature;
    expect(signature).toBeTruthy();

    const base = createEmptyRemediationHistoryArtifact();
    expect(nextRemediationHistoryRunId(base)).toBe('test-autofix-run-0001');

    const success = appendHistoryRun(base, { signature: signature!, runId: 'test-autofix-run-0001', finalStatus: 'fixed', repairClasses: ['snapshot_refresh'], verificationOk: true });
    const failed = appendHistoryRun(success, { signature: signature!, runId: 'test-autofix-run-0002', finalStatus: 'not_fixed', repairClasses: ['snapshot_refresh'], verificationOk: false });

    expect(listRunsByFailureSignature(failed, signature!)).toHaveLength(2);
    expect(listPriorSuccessfulRepairClasses(failed, signature!)).toEqual(['snapshot_refresh']);
    expect(listRepeatedFailedRepairAttempts(failed, signature!)).toHaveLength(1);
  });

  it('allows one bounded repair attempt when no history matches', () => {
    const triage = buildSnapshotTriage(1);
    const fixPlan = buildTestFixPlanArtifact(triage);

    const policy = evaluateRepeatRemediationPolicy(triage, fixPlan, createEmptyRemediationHistoryArtifact());
    expect(policy.retry_policy_decision).toBe('no_history');
    expect(policy.preferred_repair_class).toBeNull();
    expect(policy.history_summary.matching_run_ids).toEqual([]);
  });

  it('surfaces a preferred repair class when prior success exists for the same signature', () => {
    const triage = buildSnapshotTriage(1);
    const fixPlan = buildTestFixPlanArtifact(triage);
    const signature = triage.findings[0]!.failure_signature;
    const history = appendHistoryRun(createEmptyRemediationHistoryArtifact(), {
      signature,
      runId: 'test-autofix-run-0001',
      finalStatus: 'fixed',
      repairClasses: ['snapshot_refresh'],
      verificationOk: true
    });

    const policy = evaluateRepeatRemediationPolicy(triage, fixPlan, history);
    expect(policy.retry_policy_decision).toBe('allow_with_preferred_repair_class');
    expect(policy.preferred_repair_class).toBe('snapshot_refresh');
    expect(policy.history_summary.prior_successful_repair_classes).toEqual(['snapshot_refresh']);
  });

  it('blocks mutation when the same repair class already failed twice for the same signature', () => {
    const triage = buildSnapshotTriage(1);
    const fixPlan = buildTestFixPlanArtifact(triage);
    const signature = triage.findings[0]!.failure_signature;
    let history = createEmptyRemediationHistoryArtifact();
    history = appendHistoryRun(history, { signature, runId: 'test-autofix-run-0001', finalStatus: 'not_fixed', repairClasses: ['snapshot_refresh'], verificationOk: false });
    history = appendHistoryRun(history, { signature, runId: 'test-autofix-run-0002', finalStatus: 'blocked', repairClasses: ['snapshot_refresh'], verificationOk: false });

    const policy = evaluateRepeatRemediationPolicy(triage, fixPlan, history);
    expect(policy.retry_policy_decision).toBe('blocked_repeat_failure');
    expect(policy.history_summary.repeated_failed_repair_attempts).toEqual([
      {
        failure_signature: signature,
        repair_class: 'snapshot_refresh',
        count: 2,
        run_ids: ['test-autofix-run-0001', 'test-autofix-run-0002']
      }
    ]);
  });


  it('computes deterministic confidence from failure class, history, exclusions, and retry policy', () => {
    const triage = buildSnapshotTriage(1);
    const fixPlan = buildTestFixPlanArtifact(triage);
    const signature = triage.findings[0]!.failure_signature;
    const history = appendHistoryRun(createEmptyRemediationHistoryArtifact(), {
      signature,
      runId: 'test-autofix-run-0001',
      finalStatus: 'fixed',
      repairClasses: ['snapshot_refresh'],
      verificationOk: true
    });
    const retryPolicy = evaluateRepeatRemediationPolicy(triage, fixPlan, history);

    const confidence = computeAutofixConfidence({ triage, fixPlan, history, retryPolicy });
    expect(confidence.autofix_confidence).toBe(0.95);
    expect(confidence.confidence_reasoning).toEqual([
      'excluded finding ratio was 0/1, so fewer exclusions raise confidence.',
      'failure kinds stayed in preferred deterministic classes (snapshot_drift), boosting confidence.',
      'history contains prior successful repair classes (snapshot_refresh), boosting confidence.',
      'repeat policy identified a preferred repair class, adding a bounded confidence boost.'
    ]);
  });

  it('forces confidence to zero when repeat policy blocks mutation', () => {
    const triage = buildSnapshotTriage(1);
    const fixPlan = buildTestFixPlanArtifact(triage);
    const signature = triage.findings[0]!.failure_signature;
    let history = createEmptyRemediationHistoryArtifact();
    history = appendHistoryRun(history, { signature, runId: 'test-autofix-run-0001', finalStatus: 'not_fixed', repairClasses: ['snapshot_refresh'], verificationOk: false });
    history = appendHistoryRun(history, { signature, runId: 'test-autofix-run-0002', finalStatus: 'blocked', repairClasses: ['snapshot_refresh'], verificationOk: false });
    const retryPolicy = evaluateRepeatRemediationPolicy(triage, fixPlan, history);

    const confidence = computeAutofixConfidence({ triage, fixPlan, history, retryPolicy });
    expect(confidence.autofix_confidence).toBe(0);
    expect(confidence.confidence_reasoning).toEqual(['repeat policy blocked mutation, so deterministic confidence is forced to 0.00']);
  });

  it('keeps mixed repeat history deterministic when prior successful repair evidence exists', () => {
    const triage = buildTestTriageArtifact([
      '@fawxzzy/playbook test: FAIL  packages/cli/src/commands/schema.test.ts',
      '  × renders schema snapshot',
      '    Snapshot `renders schema snapshot 1` mismatch',
      '@fawxzzy/playbook test: FAIL  packages/engine/test/testFixPlan.test.ts',
      '  × sorts stable entries',
      '    AssertionError: expected [2,1] to equal [1,2]'
    ].join('\n'), { input: 'file', path: 'failure.log' });
    const fixPlan = buildTestFixPlanArtifact(triage);
    const [firstSignature, secondSignature] = triage.findings.map((finding) => finding.failure_signature);
    let history = createEmptyRemediationHistoryArtifact();
    history = appendHistoryRun(history, { signature: firstSignature!, runId: 'test-autofix-run-0001', finalStatus: 'fixed', repairClasses: ['snapshot_refresh'], verificationOk: true });
    history = appendHistoryRun(history, { signature: secondSignature!, runId: 'test-autofix-run-0002', finalStatus: 'not_fixed', repairClasses: ['stale_assertion_update'], verificationOk: false });

    const policy = evaluateRepeatRemediationPolicy(triage, fixPlan, history);
    expect(policy.retry_policy_decision).toBe('allow_with_preferred_repair_class');
    expect(policy.preferred_repair_class).toBe('snapshot_refresh');
    expect(policy.history_summary.matched_signatures).toEqual([firstSignature, secondSignature].sort());
    expect(policy.history_summary.prior_successful_repair_classes).toEqual(['snapshot_refresh']);
  });
});
