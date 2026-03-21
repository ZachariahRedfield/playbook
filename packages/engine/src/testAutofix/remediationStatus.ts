import type {
  RemediationStatusArtifact,
  RemediationStatusBlockedSignatureSummary,
  RemediationStatusConfidenceBucket,
  RemediationStatusConservativeConfidenceSignal,
  RemediationStatusDryRunApplyDelta,
  RemediationStatusFailureClassRollup,
  RemediationStatusFailureClassSummary,
  RemediationStatusLatestRun,
  RemediationStatusManualReviewPressure,
  RemediationStatusPolicyDecisionSummary,
  RemediationStatusPreferredRepairClassSummary,
  RemediationStatusRecentFinalStatus,
  RemediationStatusRepairClassRollup,
  RemediationStatusSignatureSummary,
  RemediationStatusThresholdCounterfactual,
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

const normalizeStringArray = (value: unknown): string[] => Array.isArray(value)
  ? [...new Set(value.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim()).filter(Boolean))].sort(compareStrings)
  : [];

const confidenceBuckets = [
  { key: '0.00-0.49', min: 0, max: 0.49 },
  { key: '0.50-0.69', min: 0.5, max: 0.69 },
  { key: '0.70-0.84', min: 0.7, max: 0.84 },
  { key: '0.85-0.95', min: 0.85, max: 0.95 }
] as const satisfies Array<{ key: RemediationStatusConfidenceBucket['key']; min: number; max: number }>;

const thresholdCandidates = [0.5, 0.7, 0.85] as const;

const isSuccessStatus = (status: string): boolean => status === 'fixed' || status === 'partially_fixed';
const isBlockedStatus = (status: string): boolean =>
  status === 'blocked' || status === 'blocked_low_confidence' || status === 'review_required_only';

const toRoundedRate = (successful: number, total: number): number => total === 0 ? 0 : Number((successful / total).toFixed(4));

const getFailureClasses = (entry: TestAutofixRemediationHistoryEntry): string[] => uniqueSorted(
  entry.triage_classifications.map((classification) => classification.failure_kind)
);

const getConfidenceForEntry = (
  latestResult: TestAutofixArtifact,
  entry: TestAutofixRemediationHistoryEntry
): number => {
  if (typeof entry.autofix_confidence === 'number') return entry.autofix_confidence;
  return entry.run_id === latestResult.run_id && typeof latestResult.autofix_confidence === 'number' ? latestResult.autofix_confidence : 0;
};

const getModeForEntry = (
  latestResult: TestAutofixArtifact,
  entry: TestAutofixRemediationHistoryEntry
): 'dry_run' | 'apply' => entry.mode === 'dry_run' || entry.mode === 'apply'
  ? entry.mode
  : (entry.run_id === latestResult.run_id ? (latestResult.mode ?? 'apply') : 'apply');

const summarizeOutcomeCounts = (entries: TestAutofixRemediationHistoryEntry[]): Pick<RemediationStatusConfidenceBucket, 'fixed' | 'partially_fixed' | 'not_fixed' | 'blocked'> => ({
  fixed: entries.filter((entry) => entry.final_status === 'fixed').length,
  partially_fixed: entries.filter((entry) => entry.final_status === 'partially_fixed').length,
  not_fixed: entries.filter((entry) => entry.final_status === 'not_fixed').length,
  blocked: entries.filter((entry) => isBlockedStatus(entry.final_status)).length
});

const summarizeConfidenceBuckets = (
  remediationHistory: TestAutofixRemediationHistoryEntry[],
  latestResult: TestAutofixArtifact
): RemediationStatusConfidenceBucket[] => confidenceBuckets.map((bucket) => {
  const entries = remediationHistory.filter((entry) => {
    const confidence = getConfidenceForEntry(latestResult, entry);
    return confidence >= bucket.min && confidence <= bucket.max;
  });
  const counts = summarizeOutcomeCounts(entries);
  return {
    key: bucket.key,
    range: { min: bucket.min, max: bucket.max },
    total_runs: entries.length,
    ...counts,
    success_rate: toRoundedRate(counts.fixed + counts.partially_fixed, entries.length)
  };
});

const summarizeFailureClasses = (remediationHistory: TestAutofixRemediationHistoryEntry[]): RemediationStatusFailureClassSummary[] => {
  const classes = uniqueSorted(remediationHistory.flatMap((entry) => getFailureClasses(entry)));
  return classes.map((failureClass) => {
    const entries = remediationHistory.filter((entry) => getFailureClasses(entry).includes(failureClass));
    const counts = summarizeOutcomeCounts(entries);
    return {
      failure_class: failureClass,
      total_runs: entries.length,
      ...counts,
      success_rate: toRoundedRate(counts.fixed + counts.partially_fixed, entries.length)
    };
  });
};

const summarizeTopRepeatedBlockedSignatures = (remediationHistory: TestAutofixRemediationHistoryEntry[]): RemediationStatusBlockedSignatureSummary[] => {
  const blockedEntries = remediationHistory.filter((entry) => entry.final_status === 'blocked_low_confidence');
  const signatures = uniqueSorted(blockedEntries.flatMap((entry) => entry.failure_signatures));
  return signatures.map((failureSignature) => {
    const signatureEntries = blockedEntries.filter((entry) => entry.failure_signatures.includes(failureSignature)).sort(compareHistoryEntriesDesc);
    const successfulCount = remediationHistory.filter((entry) => entry.failure_signatures.includes(failureSignature) && isSuccessStatus(entry.final_status)).length;
    return {
      failure_signature: failureSignature,
      blocked_count: signatureEntries.length,
      latest_run_id: signatureEntries[0]!.run_id,
      latest_generatedAt: signatureEntries[0]!.generatedAt,
      historical_success_count: successfulCount
    };
  }).sort((left, right) =>
    right.blocked_count - left.blocked_count ||
    right.historical_success_count - left.historical_success_count ||
    compareStrings(left.failure_signature, right.failure_signature)
  ).slice(0, 5);
};

const buildConservativeConfidenceSignal = (
  latestResult: TestAutofixArtifact,
  remediationHistory: TestAutofixRemediationHistoryEntry[]
): RemediationStatusConservativeConfidenceSignal => {
  if (latestResult.final_status !== 'blocked_low_confidence') {
    return {
      confidence_may_be_conservative: false,
      reasoning: 'Latest run was not blocked_low_confidence, so no conservative-confidence advisory is emitted.',
      supporting_failure_signatures: [],
      supporting_failure_classes: []
    };
  }

  const latestSignatures = normalizeStringArray(latestResult.failure_signatures);
  const latestHistoryEntry = remediationHistory.find((entry) => entry.run_id === latestResult.run_id);
  const latestFailureClasses = latestHistoryEntry ? getFailureClasses(latestHistoryEntry) : [];

  const successfulSignatureMatches = uniqueSorted(latestSignatures.filter((signature) =>
    remediationHistory.some((entry) => entry.run_id !== latestResult.run_id && entry.failure_signatures.includes(signature) && isSuccessStatus(entry.final_status))
  ));
  const successfulFailureClassMatches = uniqueSorted(latestFailureClasses.filter((failureClass) =>
    remediationHistory.some((entry) => entry.run_id !== latestResult.run_id && getFailureClasses(entry).includes(failureClass) && isSuccessStatus(entry.final_status))
  ));

  const maybeConservative = successfulSignatureMatches.length > 0 || successfulFailureClassMatches.length > 0;
  const reasoning = maybeConservative
    ? `Latest run was blocked_low_confidence, but prior history contains successful outcomes for matching ${successfulSignatureMatches.length > 0 ? 'signatures' : 'failure classes'}, so the threshold may be conservative.`
    : 'Latest run was blocked_low_confidence, but no prior successful outcomes were found for matching signatures or failure classes.';

  return {
    confidence_may_be_conservative: maybeConservative,
    reasoning,
    supporting_failure_signatures: successfulSignatureMatches,
    supporting_failure_classes: successfulFailureClassMatches
  };
};

const decideRetryOutlook = (entry: TestAutofixArtifact, signature: string): RemediationStatusSignatureSummary['retry_outlook'] => {
  if (normalizeStringArray(entry.failure_signatures).includes(signature)) {
    if (entry.retry_policy_decision === 'blocked_repeat_failure') return 'blocked';
    if (entry.retry_policy_decision === 'review_required_repeat_failure' || entry.final_status === 'review_required_only') return 'review_required';
  }
  return 'safe_to_retry';
};

const summarizeLatestRun = (latest: TestAutofixArtifact): RemediationStatusLatestRun => {
  const failureSignatures = normalizeStringArray((latest as Partial<TestAutofixArtifact>).failure_signatures);
  const stopReasons = normalizeStringArray((latest as Partial<TestAutofixArtifact>).stop_reasons);
  const confidenceReasoning = normalizeStringArray((latest as Partial<TestAutofixArtifact>).confidence_reasoning);
  const blocked = latest.retry_policy_decision === 'blocked_repeat_failure' ? [...failureSignatures] : [];
  const reviewRequired = latest.retry_policy_decision === 'review_required_repeat_failure' || latest.final_status === 'review_required_only'
    ? [...failureSignatures]
    : [];
  const safeToRetry = failureSignatures.filter((signature) => !blocked.includes(signature) && !reviewRequired.includes(signature)).sort(compareStrings);

  return {
    run_id: latest.run_id,
    generatedAt: latest.generatedAt,
    input: latest.input,
    final_status: latest.final_status,
    retry_policy_decision: latest.retry_policy_decision,
    retry_policy_reason: latest.retry_policy_reason,
    mode: latest.mode ?? 'apply',
    would_apply: latest.would_apply ?? false,
    confidence_threshold: typeof latest.confidence_threshold === 'number' ? latest.confidence_threshold : 0,
    autofix_confidence: typeof latest.autofix_confidence === 'number' ? latest.autofix_confidence : 0,
    confidence_reasoning: confidenceReasoning,
    preferred_repair_class: latest.preferred_repair_class,
    failure_signatures: failureSignatures,
    blocked_signatures: blocked.sort(compareStrings),
    review_required_signatures: reviewRequired.sort(compareStrings),
    safe_to_retry_signatures: safeToRetry,
    stop_reasons: stopReasons
  };
};

const summarizeFailureClassRollup = (remediationHistory: TestAutofixRemediationHistoryEntry[], latestResult: TestAutofixArtifact): RemediationStatusFailureClassRollup[] => {
  const classes = uniqueSorted(remediationHistory.flatMap((entry) => getFailureClasses(entry)));
  return classes.map((failureClass) => {
    const entries = remediationHistory.filter((entry) => getFailureClasses(entry).includes(failureClass));
    const counts = summarizeOutcomeCounts(entries);
    const dryRunCount = entries.filter((entry) => getModeForEntry(latestResult, entry) === 'dry_run').length;
    const latestEntry = [...entries].sort(compareHistoryEntriesDesc)[0]!;
    return {
      failure_class: failureClass,
      total_runs: entries.length,
      fixed: counts.fixed,
      partially_fixed: counts.partially_fixed,
      not_fixed: counts.not_fixed,
      blocked: counts.blocked,
      success_rate: toRoundedRate(counts.fixed + counts.partially_fixed, entries.length),
      dry_run_runs: dryRunCount,
      apply_runs: entries.length - dryRunCount,
      latest_run_id: latestEntry.run_id,
      sample_failure_signatures: uniqueSorted(entries.flatMap((entry) => entry.failure_signatures)).slice(0, 5)
    };
  }).sort((left, right) => right.total_runs - left.total_runs || compareStrings(left.failure_class, right.failure_class));
};

const summarizeRepairClassRollup = (remediationHistory: TestAutofixRemediationHistoryEntry[]): RemediationStatusRepairClassRollup[] => {
  const repairClasses = uniqueSorted(remediationHistory.flatMap((entry) => entry.applied_repair_classes));
  return repairClasses.map((repairClass) => {
    const entries = remediationHistory.filter((entry) => entry.applied_repair_classes.includes(repairClass));
    const counts = summarizeOutcomeCounts(entries);
    const latestEntry = [...entries].sort(compareHistoryEntriesDesc)[0]!;
    return {
      repair_class: repairClass,
      total_runs: entries.length,
      successful_runs: counts.fixed + counts.partially_fixed,
      blocked_runs: counts.blocked,
      not_fixed_runs: counts.not_fixed,
      success_rate: toRoundedRate(counts.fixed + counts.partially_fixed, entries.length),
      latest_run_id: latestEntry.run_id,
      failure_classes: uniqueSorted(entries.flatMap((entry) => getFailureClasses(entry))).slice(0, 5)
    };
  }).sort((left, right) => right.successful_runs - left.successful_runs || right.total_runs - left.total_runs || compareStrings(left.repair_class, right.repair_class));
};

const summarizeBlockedSignatureRollup = (remediationHistory: TestAutofixRemediationHistoryEntry[]): RemediationStatusBlockedSignatureSummary[] => {
  const blockedEntries = remediationHistory.filter((entry) => isBlockedStatus(entry.final_status));
  const signatures = uniqueSorted(blockedEntries.flatMap((entry) => entry.failure_signatures));
  return signatures.map((failureSignature) => {
    const entries = blockedEntries.filter((entry) => entry.failure_signatures.includes(failureSignature)).sort(compareHistoryEntriesDesc);
    const historicalSuccessCount = remediationHistory.filter((entry) => entry.failure_signatures.includes(failureSignature) && isSuccessStatus(entry.final_status)).length;
    return {
      failure_signature: failureSignature,
      blocked_count: entries.length,
      latest_run_id: entries[0]!.run_id,
      latest_generatedAt: entries[0]!.generatedAt,
      historical_success_count: historicalSuccessCount
    };
  }).sort((left, right) => right.blocked_count - left.blocked_count || right.historical_success_count - left.historical_success_count || compareStrings(left.failure_signature, right.failure_signature));
};

const createSyntheticHistoryEntryFromLatestResult = (latestResult: TestAutofixArtifact): TestAutofixRemediationHistoryEntry => ({
  run_id: latestResult.run_id,
  generatedAt: latestResult.generatedAt,
  input: { path: latestResult.input },
  mode: latestResult.mode ?? 'apply',
  retry_policy_decision: latestResult.retry_policy_decision,
  confidence_threshold: latestResult.confidence_threshold ?? 0,
  autofix_confidence: latestResult.autofix_confidence ?? 0,
  failure_signatures: normalizeStringArray(latestResult.failure_signatures),
  triage_classifications: [],
  admitted_findings: [],
  excluded_findings: [],
  applied_task_ids: [],
  applied_repair_classes: [],
  files_touched: [],
  verification_commands: [],
  verification_outcomes: [],
  final_status: latestResult.final_status,
  stop_reasons: normalizeStringArray(latestResult.stop_reasons),
  provenance: { failure_log_path: latestResult.input, triage_artifact_path: '', fix_plan_artifact_path: '', apply_result_path: null, autofix_result_path: '' }
});

const summarizeThresholdCounterfactuals = (
  remediationHistory: TestAutofixRemediationHistoryEntry[],
  latestResult: TestAutofixArtifact
): RemediationStatusThresholdCounterfactual[] => {
  const latestRelevantRun = remediationHistory[0] ?? createSyntheticHistoryEntryFromLatestResult(latestResult);

  return thresholdCandidates.map((threshold) => {
    const runsMeetingThreshold = remediationHistory.filter((entry) => getConfidenceForEntry(latestResult, entry) >= threshold);
    const blockedLowConfidenceRuns = remediationHistory.filter((entry) => entry.final_status === 'blocked_low_confidence');
    const wouldClear = blockedLowConfidenceRuns.filter((entry) => getConfidenceForEntry(latestResult, entry) >= threshold);
    return {
      threshold,
      eligible_runs: runsMeetingThreshold.length,
      successful_eligible_runs: runsMeetingThreshold.filter((entry) => isSuccessStatus(entry.final_status)).length,
      blocked_low_confidence_runs: blockedLowConfidenceRuns.length,
      blocked_runs_that_would_clear: wouldClear.length,
      latest_run_would_clear: getConfidenceForEntry(latestResult, latestRelevantRun) >= threshold,
      advisory_note: wouldClear.length > 0
        ? 'Advisory only: some blocked_low_confidence runs would have cleared this threshold.'
        : 'Advisory only: no blocked_low_confidence runs would have cleared this threshold.'
    };
  });
};

const summarizeDryRunVsApplyDelta = (
  remediationHistory: TestAutofixRemediationHistoryEntry[],
  latestResult: TestAutofixArtifact
): RemediationStatusDryRunApplyDelta => {
  const dryRunEntries = remediationHistory.filter((entry) => getModeForEntry(latestResult, entry) === 'dry_run');
  const applyEntries = remediationHistory.filter((entry) => getModeForEntry(latestResult, entry) === 'apply');
  const dryRunSuccesses = dryRunEntries.filter((entry) => isSuccessStatus(entry.final_status)).length;
  const applySuccesses = applyEntries.filter((entry) => isSuccessStatus(entry.final_status)).length;
  return {
    dry_run_runs: dryRunEntries.length,
    apply_runs: applyEntries.length,
    dry_run_success_rate: toRoundedRate(dryRunSuccesses, dryRunEntries.length),
    apply_success_rate: toRoundedRate(applySuccesses, applyEntries.length),
    success_rate_delta: Number((toRoundedRate(applySuccesses, applyEntries.length) - toRoundedRate(dryRunSuccesses, dryRunEntries.length)).toFixed(4)),
    blocked_delta: applyEntries.filter((entry) => isBlockedStatus(entry.final_status)).length - dryRunEntries.filter((entry) => isBlockedStatus(entry.final_status)).length,
    advisory_note: 'Advisory only: compares read-only historical outcomes by execution mode without changing policy.'
  };
};

const summarizeManualReviewPressure = (remediationHistory: TestAutofixRemediationHistoryEntry[]): RemediationStatusManualReviewPressure => {
  const reviewRequiredRuns = remediationHistory.filter((entry) =>
    entry.final_status === 'review_required_only' || entry.retry_policy_decision === 'review_required_repeat_failure'
  );
  const blockedRuns = remediationHistory.filter((entry) =>
    entry.final_status === 'blocked' || entry.final_status === 'blocked_low_confidence' || entry.retry_policy_decision === 'blocked_repeat_failure'
  );
  return {
    review_required_runs: reviewRequiredRuns.length,
    blocked_runs: blockedRuns.length,
    total_manual_pressure_runs: uniqueSorted([...reviewRequiredRuns, ...blockedRuns].map((entry) => entry.run_id)).length,
    top_review_required_signatures: summarizeBlockedSignatureRollup(reviewRequiredRuns).slice(0, 5),
    top_blocked_signatures: summarizeBlockedSignatureRollup(blockedRuns).slice(0, 5),
    advisory_note: 'Advisory only: highlights where operators may need to inspect recurring failures before tuning thresholds.'
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
    decision: typeof entry.retry_policy_decision === 'string'
      ? entry.retry_policy_decision
      : (entry.run_id === options.latestResult.run_id ? options.latestResult.retry_policy_decision : null),
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

  const dryRunRuns = remediationHistory.filter((entry) => getModeForEntry(options.latestResult, entry) === 'dry_run').length;
  const applyRuns = remediationHistory.length - dryRunRuns;
  const repeatPolicyBlockCounts = ([
    'blocked_repeat_failure',
    'review_required_repeat_failure'
  ] as const).map((decision) => ({
    decision,
    count: decisionRuns.filter((entry) => entry.decision === decision).length
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
    telemetry: {
      confidence_buckets: summarizeConfidenceBuckets(remediationHistory, options.latestResult),
      failure_classes: summarizeFailureClasses(remediationHistory),
      blocked_low_confidence_runs: remediationHistory.filter((entry) => entry.final_status === 'blocked_low_confidence').length,
      top_repeated_blocked_signatures: summarizeTopRepeatedBlockedSignatures(remediationHistory),
      dry_run_runs: dryRunRuns,
      apply_runs: applyRuns,
      dry_run_to_apply_ratio: `${dryRunRuns}:${applyRuns}`,
      repeat_policy_block_counts: repeatPolicyBlockCounts,
      conservative_confidence_signal: buildConservativeConfidenceSignal(options.latestResult, remediationHistory),
      failure_class_rollup: summarizeFailureClassRollup(remediationHistory, options.latestResult),
      repair_class_rollup: summarizeRepairClassRollup(remediationHistory),
      blocked_signature_rollup: summarizeBlockedSignatureRollup(remediationHistory),
      threshold_counterfactuals: summarizeThresholdCounterfactuals(remediationHistory, options.latestResult),
      dry_run_vs_apply_delta: summarizeDryRunVsApplyDelta(remediationHistory, options.latestResult),
      manual_review_pressure: summarizeManualReviewPressure(remediationHistory)
    },
    remediation_history: remediationHistory,
    latest_result: options.latestResult
  };
};
