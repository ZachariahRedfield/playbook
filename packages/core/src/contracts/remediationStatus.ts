import type { TestAutofixArtifact, TestAutofixFinalStatus, TestAutofixRetryPolicyDecision } from './testAutofix.js';
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
  remediation_history: TestAutofixRemediationHistoryEntry[];
  latest_result: TestAutofixArtifact;
};
