import type { TestAutofixArtifact, TestAutofixFinalStatus, TestAutofixMode, TestAutofixRetryPolicyDecision } from './testAutofix.js';
import type { TestAutofixRemediationHistoryEntry } from './testAutofixRemediationHistory.js';

export const REMEDIATION_STATUS_SCHEMA_VERSION = '1.0' as const;
export const REMEDIATION_STATUS_ARTIFACT_KIND = 'remediation-status' as const;

export type RemediationStatusLatestRun = {
  run_id: string;
  generatedAt: string;
  input: string;
  final_status: TestAutofixFinalStatus;
  retry_policy_decision: TestAutofixRetryPolicyDecision;
  retry_policy_reason: string;
  mode: TestAutofixMode;
  would_apply: boolean;
  confidence_threshold: number;
  autofix_confidence: number;
  confidence_reasoning: string[];
  preferred_repair_class: string | null;
  failure_signatures: string[];
  blocked_signatures: string[];
  review_required_signatures: string[];
  safe_to_retry_signatures: string[];
  stop_reasons: string[];
};

export type RemediationStatusSignatureSummary = {
  failure_signature: string;
  occurrences: number;
  latest_run_id: string;
  latest_generatedAt: string;
  final_statuses: string[];
  applied_repair_classes: string[];
  successful_repair_classes: string[];
  blocked_repair_classes: string[];
  retry_outlook: 'blocked' | 'review_required' | 'safe_to_retry';
};

export type RemediationStatusPolicyDecisionSummary = {
  decision: TestAutofixRetryPolicyDecision;
  count: number;
  latest_run_id: string;
  failure_signatures: string[];
};

export type RemediationStatusPreferredRepairClassSummary = {
  repair_class: string;
  success_count: number;
  latest_success_run_id: string;
  failure_signatures: string[];
};

export type RemediationStatusRecentFinalStatus = {
  run_id: string;
  generatedAt: string;
  final_status: string;
  failure_signatures: string[];
};

export type RemediationStatusConfidenceBucket = {
  key: '0.00-0.49' | '0.50-0.69' | '0.70-0.84' | '0.85-0.95';
  range: {
    min: number;
    max: number;
  };
  total_runs: number;
  fixed: number;
  partially_fixed: number;
  not_fixed: number;
  blocked: number;
  success_rate: number;
};

export type RemediationStatusFailureClassSummary = {
  failure_class: string;
  total_runs: number;
  fixed: number;
  partially_fixed: number;
  not_fixed: number;
  blocked: number;
  success_rate: number;
};

export type RemediationStatusBlockedSignatureSummary = {
  failure_signature: string;
  blocked_count: number;
  latest_run_id: string;
  latest_generatedAt: string;
  historical_success_count: number;
};


export type RemediationStatusFailureClassRollup = {
  failure_class: string;
  total_runs: number;
  fixed: number;
  partially_fixed: number;
  not_fixed: number;
  blocked: number;
  success_rate: number;
  dry_run_runs: number;
  apply_runs: number;
  latest_run_id: string;
  sample_failure_signatures: string[];
};

export type RemediationStatusRepairClassRollup = {
  repair_class: string;
  total_runs: number;
  successful_runs: number;
  blocked_runs: number;
  not_fixed_runs: number;
  success_rate: number;
  latest_run_id: string;
  failure_classes: string[];
};

export type RemediationStatusThresholdCounterfactual = {
  threshold: number;
  eligible_runs: number;
  successful_eligible_runs: number;
  blocked_low_confidence_runs: number;
  blocked_runs_that_would_clear: number;
  latest_run_would_clear: boolean;
  advisory_note: string;
};

export type RemediationStatusDryRunApplyDelta = {
  dry_run_runs: number;
  apply_runs: number;
  dry_run_success_rate: number;
  apply_success_rate: number;
  success_rate_delta: number;
  blocked_delta: number;
  advisory_note: string;
};

export type RemediationStatusManualReviewPressure = {
  review_required_runs: number;
  blocked_runs: number;
  total_manual_pressure_runs: number;
  top_review_required_signatures: RemediationStatusBlockedSignatureSummary[];
  top_blocked_signatures: RemediationStatusBlockedSignatureSummary[];
  advisory_note: string;
};

export type RemediationStatusConservativeConfidenceSignal = {
  confidence_may_be_conservative: boolean;
  reasoning: string;
  supporting_failure_signatures: string[];
  supporting_failure_classes: string[];
};

export type RemediationStatusTelemetry = {
  confidence_buckets: RemediationStatusConfidenceBucket[];
  failure_classes: RemediationStatusFailureClassSummary[];
  blocked_low_confidence_runs: number;
  top_repeated_blocked_signatures: RemediationStatusBlockedSignatureSummary[];
  dry_run_runs: number;
  apply_runs: number;
  dry_run_to_apply_ratio: string;
  repeat_policy_block_counts: Array<{
    decision: Extract<TestAutofixRetryPolicyDecision, 'blocked_repeat_failure' | 'review_required_repeat_failure'>;
    count: number;
  }>;
  conservative_confidence_signal: RemediationStatusConservativeConfidenceSignal;
  failure_class_rollup: RemediationStatusFailureClassRollup[];
  repair_class_rollup: RemediationStatusRepairClassRollup[];
  blocked_signature_rollup: RemediationStatusBlockedSignatureSummary[];
  threshold_counterfactuals: RemediationStatusThresholdCounterfactual[];
  dry_run_vs_apply_delta: RemediationStatusDryRunApplyDelta;
  manual_review_pressure: RemediationStatusManualReviewPressure;
};

export type RemediationStatusArtifact = {
  schemaVersion: typeof REMEDIATION_STATUS_SCHEMA_VERSION;
  kind: typeof REMEDIATION_STATUS_ARTIFACT_KIND;
  command: 'remediation-status';
  generatedAt: string;
  source: {
    latest_result_path: string;
    remediation_history_path: string;
  };
  latest_run: RemediationStatusLatestRun;
  blocked_signatures: string[];
  review_required_signatures: string[];
  safe_to_retry_signatures: string[];
  stable_failure_signatures: RemediationStatusSignatureSummary[];
  repeat_policy_decisions: RemediationStatusPolicyDecisionSummary[];
  preferred_repair_classes: RemediationStatusPreferredRepairClassSummary[];
  recent_final_statuses: RemediationStatusRecentFinalStatus[];
  telemetry: RemediationStatusTelemetry;
  remediation_history: TestAutofixRemediationHistoryEntry[];
  latest_result: TestAutofixArtifact;
};
