import type {
  RemediationStatusArtifact,
  RemediationStatusLatestRun,
  RemediationStatusPolicyDecisionSummary,
  RemediationStatusPreferredRepairClassSummary,
  RemediationStatusRecentFinalStatus,
  RemediationStatusSignatureSummary,
  TestAutofixArtifact,
  TestAutofixRemediationHistoryArtifact,
  TestAutofixRemediationHistoryEntry,
  TestAutofixRetryPolicyDecision
} from '@zachariahredfield/playbook-core';
import { REMEDIATION_STATUS_ARTIFACT_KIND, REMEDIATION_STATUS_SCHEMA_VERSION } from '@zachariahredfield/playbook-core';
import { listPriorSuccessfulRepairClasses, listRepeatedFailedRepairAttempts, listRunsByFailureSignature } from './remediationHistory.js';

const compareStrings = (left: string, right: string): number => left.localeCompare(right);
const uniqueSorted = (values: Array<string | null | undefined>): string[] => [...new Set(values.filter((value): value is string => Boolean(value)).map((value) => value.trim()).filter(Boolean))].sort(compareStrings);
const compareHistoryEntriesDesc = (left: TestAutofixRemediationHistoryEntry, right: TestAutofixRemediationHistoryEntry): number => {
  const generatedOrder = right.generatedAt.localeCompare(left.generatedAt);
  if (generatedOrder !== 0) return generatedOrder;
  return right.run_id.localeCompare(left.run_id);
};

const decideRetryOutlook = (entry: TestAutofixArtifact, signature: string): RemediationStatusSignatureSummary['retry_outlook'] => {
  if (entry.failure_signatures.includes(signature)) {
    if (entry.retry_policy_decision === 'blocked_repeat_failure') return 'blocked';
    if (entry.retry_policy_decision === 'review_required_repeat_failure' || entry.final_status === 'review_required_only') return 'review_required';
  }
  return 'safe_to_retry';
};

const summarizeLatestRun = (latest: TestAutofixArtifact): RemediationStatusLatestRun => {
  const blocked = latest.retry_policy_decision === 'blocked_repeat_failure' ? [...latest.failure_signatures] : [];
  const reviewRequired = latest.retry_policy_decision === 'review_required_repeat_failure' || latest.final_status === 'review_required_only'
    ? [...latest.failure_signatures]
    : [];
  const safeToRetry = latest.failure_signatures.filter((signature) => !blocked.includes(signature) && !reviewRequired.includes(signature)).sort(compareStrings);

  return {
    run_id: latest.run_id,
    generatedAt: latest.generatedAt,
    input: latest.input,
    final_status: latest.final_status,
    retry_policy_decision: latest.retry_policy_decision,
    retry_policy_reason: latest.retry_policy_reason,
    preferred_repair_class: latest.preferred_repair_class,
    failure_signatures: [...latest.failure_signatures],
    blocked_signatures: blocked.sort(compareStrings),
    review_required_signatures: reviewRequired.sort(compareStrings),
    safe_to_retry_signatures: safeToRetry,
    stop_reasons: [...latest.stop_reasons]
  };
};

export const buildRemediationStatusArtifact = (options: {
  latestResult: TestAutofixArtifact;
  history: TestAutofixRemediationHistoryArtifact;
  latestResultPath: string;
  remediationHistoryPath: string;
}): RemediationStatusArtifact => {
  const remediationHistory = [...options.history.runs].sort(compareHistoryEntriesDesc);
  const latestRun = summarizeLatestRun(options.latestResult);
  const signatures = uniqueSorted(remediationHistory.flatMap((entry) => entry.failure_signatures));

  const stableFailureSignatures: RemediationStatusSignatureSummary[] = signatures.map((failureSignature) => {
    const entries = listRunsByFailureSignature(options.history, failureSignature).sort(compareHistoryEntriesDesc);
    const latestEntry = entries[0]!;
    const blockedRepairClasses = uniqueSorted(
      listRepeatedFailedRepairAttempts(options.history, failureSignature).flatMap((entry) => entry.applied_repair_classes)
    );
    return {
      failure_signature: failureSignature,
      occurrences: entries.length,
      latest_run_id: latestEntry.run_id,
      latest_generatedAt: latestEntry.generatedAt,
      final_statuses: uniqueSorted(entries.map((entry) => entry.final_status)),
      applied_repair_classes: uniqueSorted(entries.flatMap((entry) => entry.applied_repair_classes)),
      successful_repair_classes: listPriorSuccessfulRepairClasses(options.history, failureSignature),
      blocked_repair_classes: blockedRepairClasses,
      retry_outlook: decideRetryOutlook(options.latestResult, failureSignature)
    };
  }).sort((left, right) => compareStrings(left.failure_signature, right.failure_signature));

  const decisionRuns = remediationHistory.map((entry) => ({
    run_id: entry.run_id,
    generatedAt: entry.generatedAt,
    decision: entry.run_id === options.latestResult.run_id ? options.latestResult.retry_policy_decision : null,
    failure_signatures: entry.failure_signatures
  })).filter((entry): entry is { run_id: string; generatedAt: string; decision: TestAutofixRetryPolicyDecision; failure_signatures: string[] } => entry.decision !== null);

  const repeatPolicyDecisions: RemediationStatusPolicyDecisionSummary[] = uniqueSorted(decisionRuns.map((entry) => entry.decision))
    .map((decision) => decision as TestAutofixRetryPolicyDecision)
    .map((decision) => {
    const matches = decisionRuns.filter((entry) => entry.decision === decision).sort((left, right) => right.generatedAt.localeCompare(left.generatedAt) || right.run_id.localeCompare(left.run_id));
    return {
      decision,
      count: matches.length,
      latest_run_id: matches[0]!.run_id,
      failure_signatures: uniqueSorted(matches.flatMap((entry) => entry.failure_signatures))
    };
  });

  const preferredRepairClasses: RemediationStatusPreferredRepairClassSummary[] = uniqueSorted(
    remediationHistory
      .filter((entry) => entry.final_status === 'fixed' || entry.final_status === 'partially_fixed')
      .flatMap((entry) => entry.applied_repair_classes)
  ).map((repairClass) => {
    const successes = remediationHistory.filter((entry) =>
      (entry.final_status === 'fixed' || entry.final_status === 'partially_fixed') && entry.applied_repair_classes.includes(repairClass)
    );
    const latestSuccess = [...successes].sort(compareHistoryEntriesDesc)[0]!;
    return {
      repair_class: repairClass,
      success_count: successes.length,
      latest_success_run_id: latestSuccess.run_id,
      failure_signatures: uniqueSorted(successes.flatMap((entry) => entry.failure_signatures))
    };
  }).sort((left, right) => compareStrings(left.repair_class, right.repair_class));

  const recentFinalStatuses: RemediationStatusRecentFinalStatus[] = remediationHistory.slice(0, 5).map((entry) => ({
    run_id: entry.run_id,
    generatedAt: entry.generatedAt,
    final_status: entry.final_status,
    failure_signatures: [...entry.failure_signatures]
  }));

  return {
    schemaVersion: REMEDIATION_STATUS_SCHEMA_VERSION,
    kind: REMEDIATION_STATUS_ARTIFACT_KIND,
    command: 'remediation-status',
    generatedAt: new Date(0).toISOString(),
    source: {
      latest_result_path: options.latestResultPath,
      remediation_history_path: options.remediationHistoryPath
    },
    latest_run: latestRun,
    blocked_signatures: [...latestRun.blocked_signatures],
    review_required_signatures: [...latestRun.review_required_signatures],
    safe_to_retry_signatures: [...latestRun.safe_to_retry_signatures],
    stable_failure_signatures: stableFailureSignatures,
    repeat_policy_decisions: repeatPolicyDecisions,
    preferred_repair_classes: preferredRepairClasses,
    recent_final_statuses: recentFinalStatuses,
    remediation_history: remediationHistory,
    latest_result: options.latestResult
  };
};
