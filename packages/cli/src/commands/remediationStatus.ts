import path from 'node:path';
import * as engineRuntime from '@zachariahredfield/playbook-engine';
import type { TestAutofixArtifact } from '@zachariahredfield/playbook-core';

type TestAutofixRemediationHistoryArtifact = {
  runs: Array<Record<string, unknown>>;
};

type RemediationStatusArtifact = {
  latest_run: {
    run_id: string;
    final_status: string;
    retry_policy_decision: string;
    preferred_repair_class: string | null;
  };
  blocked_signatures: string[];
  review_required_signatures: string[];
  safe_to_retry_signatures: string[];
  preferred_repair_classes: Array<{ repair_class: string; success_count: number; failure_signatures: string[] }>;
  stable_failure_signatures: Array<{ failure_signature: string; occurrences: number; retry_outlook: string; latest_run_id: string }>;
  recent_final_statuses: Array<{ run_id: string; final_status: string; failure_signatures: string[] }>;
  telemetry: {
    confidence_buckets: Array<{ key: string; total_runs: number; fixed: number; partially_fixed: number; not_fixed: number; blocked: number; success_rate: number }>;
    failure_classes: Array<{ failure_class: string; total_runs: number; success_rate: number }>;
    blocked_low_confidence_runs: number;
    top_repeated_blocked_signatures: Array<{ failure_signature: string; blocked_count: number; historical_success_count: number }>;
    dry_run_runs: number;
    apply_runs: number;
    dry_run_to_apply_ratio: string;
    repeat_policy_block_counts: Array<{ decision: string; count: number }>;
    conservative_confidence_signal: { confidence_may_be_conservative: boolean; reasoning: string };
    failure_class_rollup: Array<{ failure_class: string; total_runs: number; success_rate: number; dry_run_runs: number; apply_runs: number; latest_run_id: string; sample_failure_signatures: string[] }>;
    repair_class_rollup: Array<{ repair_class: string; total_runs: number; successful_runs: number; blocked_runs: number; not_fixed_runs: number; success_rate: number; latest_run_id: string; failure_classes: string[] }>;
    blocked_signature_rollup: Array<{ failure_signature: string; blocked_count: number; historical_success_count: number; latest_run_id: string }>;
    threshold_counterfactuals: Array<{ threshold: number; eligible_runs: number; successful_eligible_runs: number; blocked_low_confidence_runs: number; blocked_runs_that_would_clear: number; latest_run_would_clear: boolean; advisory_note: string }>;
    dry_run_vs_apply_delta: { dry_run_runs: number; apply_runs: number; dry_run_success_rate: number; apply_success_rate: number; success_rate_delta: number; blocked_delta: number; advisory_note: string };
    manual_review_pressure: { review_required_runs: number; blocked_runs: number; total_manual_pressure_runs: number; top_review_required_signatures: Array<{ failure_signature: string; blocked_count: number }>; top_blocked_signatures: Array<{ failure_signature: string; blocked_count: number }>; advisory_note: string };
  };
  remediation_history: Array<{ run_id: string }>;
};
import { ExitCode } from '../lib/cliContract.js';
import { emitJsonOutput } from '../lib/jsonArtifact.js';
import { printCommandHelp } from '../lib/commandSurface.js';

type RemediationStatusOptions = {
  format: 'text' | 'json';
  quiet: boolean;
  latestResultPath?: string;
  historyPath?: string;
  help?: boolean;
};

const DEFAULT_RESULT_FILE = '.playbook/test-autofix.json' as const;
const DEFAULT_HISTORY_FILE = '.playbook/test-autofix-history.json' as const;

const engine = engineRuntime as unknown as {
  buildRemediationStatusArtifact: (options: {
    latestResult: TestAutofixArtifact;
    history: TestAutofixRemediationHistoryArtifact;
    latestResultPath: string;
    remediationHistoryPath: string;
  }) => RemediationStatusArtifact;
  readArtifactJson: <T>(artifactPath: string) => T;
};

const readRequiredArtifact = <T>(cwd: string, artifactPath: string, command: string): T => {
  const absolute = path.resolve(cwd, artifactPath);
  try {
    return engine.readArtifactJson<T>(absolute);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`playbook ${command}: required artifact is missing or invalid at ${artifactPath}. ${message}`);
  }
};

const renderText = (artifact: RemediationStatusArtifact): string => {
  const lines = [
    'Remediation status',
    '──────────────────',
    `Latest run: ${artifact.latest_run.run_id}`,
    `Latest status: ${artifact.latest_run.final_status}`,
    `Latest retry decision: ${artifact.latest_run.retry_policy_decision}`,
    `Preferred repair class: ${artifact.latest_run.preferred_repair_class ?? '(none)'}`,
    `Blocked signatures: ${artifact.blocked_signatures.length}`,
    `Review-required signatures: ${artifact.review_required_signatures.length}`,
    `Safe-to-retry signatures: ${artifact.safe_to_retry_signatures.length}`,
    `History entries: ${artifact.remediation_history.length}`
  ];

  if (artifact.blocked_signatures.length > 0) {
    lines.push('', 'Blocked signatures');
    for (const signature of artifact.blocked_signatures) lines.push(`- ${signature}`);
  }

  if (artifact.review_required_signatures.length > 0) {
    lines.push('', 'Review-required signatures');
    for (const signature of artifact.review_required_signatures) lines.push(`- ${signature}`);
  }

  if (artifact.safe_to_retry_signatures.length > 0) {
    lines.push('', 'Safe to retry');
    for (const signature of artifact.safe_to_retry_signatures) lines.push(`- ${signature}`);
  }

  if (artifact.preferred_repair_classes.length > 0) {
    lines.push('', 'Preferred repair guidance');
    for (const summary of artifact.preferred_repair_classes) {
      lines.push(`- ${summary.repair_class} (${summary.success_count} prior success${summary.success_count === 1 ? '' : 'es'})`);
      lines.push(`  Signatures: ${summary.failure_signatures.join(', ')}`);
    }
  }

  lines.push('', 'Calibration telemetry');
  lines.push(`- Dry-run/apply ratio: ${artifact.telemetry.dry_run_to_apply_ratio}`);
  lines.push(`- blocked_low_confidence runs: ${artifact.telemetry.blocked_low_confidence_runs}`);
  lines.push(`- Conservative-confidence advisory: ${artifact.telemetry.conservative_confidence_signal.confidence_may_be_conservative ? 'yes' : 'no'}`);
  lines.push(`  ${artifact.telemetry.conservative_confidence_signal.reasoning}`);

  if (artifact.telemetry.confidence_buckets.length > 0) {
    lines.push('', 'Confidence buckets');
    for (const bucket of artifact.telemetry.confidence_buckets) {
      lines.push(`- ${bucket.key}: runs=${bucket.total_runs}, fixed=${bucket.fixed}, partially_fixed=${bucket.partially_fixed}, not_fixed=${bucket.not_fixed}, blocked=${bucket.blocked}, success_rate=${bucket.success_rate}`);
    }
  }

  if (artifact.telemetry.failure_classes.length > 0) {
    lines.push('', 'Failure-class success rates');
    for (const summary of artifact.telemetry.failure_classes) {
      lines.push(`- ${summary.failure_class}: runs=${summary.total_runs}, success_rate=${summary.success_rate}`);
    }
  }

  if (artifact.telemetry.top_repeated_blocked_signatures.length > 0) {
    lines.push('', 'Top blocked_low_confidence signatures');
    for (const entry of artifact.telemetry.top_repeated_blocked_signatures) {
      lines.push(`- ${entry.failure_signature}: blocked=${entry.blocked_count}, prior_successes=${entry.historical_success_count}`);
    }
  }

  if (artifact.telemetry.failure_class_rollup.length > 0) {
    lines.push('', 'Failure-class rollup');
    for (const summary of artifact.telemetry.failure_class_rollup) {
      lines.push(`- ${summary.failure_class}: runs=${summary.total_runs}, success_rate=${summary.success_rate}, dry_run=${summary.dry_run_runs}, apply=${summary.apply_runs}, latest=${summary.latest_run_id}`);
      if (summary.sample_failure_signatures.length > 0) lines.push(`  Sample signatures: ${summary.sample_failure_signatures.join(', ')}`);
    }
  }

  if (artifact.telemetry.repair_class_rollup.length > 0) {
    lines.push('', 'Repair-class rollup');
    for (const summary of artifact.telemetry.repair_class_rollup) {
      lines.push(`- ${summary.repair_class}: runs=${summary.total_runs}, successful=${summary.successful_runs}, blocked=${summary.blocked_runs}, not_fixed=${summary.not_fixed_runs}, success_rate=${summary.success_rate}`);
      if (summary.failure_classes.length > 0) lines.push(`  Failure classes: ${summary.failure_classes.join(', ')}`);
    }
  }

  if (artifact.telemetry.blocked_signature_rollup.length > 0) {
    lines.push('', 'Blocked signature rollup');
    for (const entry of artifact.telemetry.blocked_signature_rollup.slice(0, 5)) {
      lines.push(`- ${entry.failure_signature}: blocked=${entry.blocked_count}, prior_successes=${entry.historical_success_count}, latest=${entry.latest_run_id}`);
    }
  }

  if (artifact.telemetry.threshold_counterfactuals.length > 0) {
    lines.push('', 'Threshold counterfactuals');
    for (const entry of artifact.telemetry.threshold_counterfactuals) {
      lines.push(`- threshold=${entry.threshold}: eligible=${entry.eligible_runs}, successful_eligible=${entry.successful_eligible_runs}, blocked_low_confidence=${entry.blocked_low_confidence_runs}, would_clear=${entry.blocked_runs_that_would_clear}, latest_would_clear=${entry.latest_run_would_clear ? 'yes' : 'no'}`);
    }
  }

  lines.push('', 'Dry-run vs apply delta');
  lines.push(`- dry_run_runs=${artifact.telemetry.dry_run_vs_apply_delta.dry_run_runs}, apply_runs=${artifact.telemetry.dry_run_vs_apply_delta.apply_runs}, dry_run_success_rate=${artifact.telemetry.dry_run_vs_apply_delta.dry_run_success_rate}, apply_success_rate=${artifact.telemetry.dry_run_vs_apply_delta.apply_success_rate}, success_rate_delta=${artifact.telemetry.dry_run_vs_apply_delta.success_rate_delta}, blocked_delta=${artifact.telemetry.dry_run_vs_apply_delta.blocked_delta}`);
  lines.push(`  ${artifact.telemetry.dry_run_vs_apply_delta.advisory_note}`);

  lines.push('', 'Manual review pressure');
  lines.push(`- review_required_runs=${artifact.telemetry.manual_review_pressure.review_required_runs}, blocked_runs=${artifact.telemetry.manual_review_pressure.blocked_runs}, total_manual_pressure_runs=${artifact.telemetry.manual_review_pressure.total_manual_pressure_runs}`);
  lines.push(`  ${artifact.telemetry.manual_review_pressure.advisory_note}`);
  for (const entry of artifact.telemetry.manual_review_pressure.top_review_required_signatures.slice(0, 3)) {
    lines.push(`  review-required: ${entry.failure_signature} (${entry.blocked_count})`);
  }
  for (const entry of artifact.telemetry.manual_review_pressure.top_blocked_signatures.slice(0, 3)) {
    lines.push(`  blocked: ${entry.failure_signature} (${entry.blocked_count})`);
  }

  const repeatedFailures = artifact.stable_failure_signatures.filter((entry: RemediationStatusArtifact['stable_failure_signatures'][number]) => entry.occurrences > 1);
  if (repeatedFailures.length > 0) {
    lines.push('', 'Recent repeated failures');
    for (const entry of repeatedFailures) {
      lines.push(`- ${entry.failure_signature}`);
      lines.push(`  Occurrences: ${entry.occurrences}; outlook: ${entry.retry_outlook}; latest run: ${entry.latest_run_id}`);
    }
  }

  if (artifact.recent_final_statuses.length > 0) {
    lines.push('', 'Recent final statuses');
    for (const entry of artifact.recent_final_statuses) {
      lines.push(`- ${entry.run_id} ${entry.final_status} ${entry.failure_signatures.join(', ')}`);
    }
  }

  return lines.join('\n');
};

export const runRemediationStatus = async (cwd: string, options: RemediationStatusOptions): Promise<number> => {
  if (options.help) {
    printCommandHelp({
      usage: 'playbook remediation-status [--json]',
      description: 'Inspect recent test-autofix remediation history, repeat-policy decisions, and retry guidance without mutating repo state.',
      options: [
        `--latest-result <path>    Read the latest test-autofix result artifact (default ${DEFAULT_RESULT_FILE})`,
        `--history <path>          Read the remediation history artifact (default ${DEFAULT_HISTORY_FILE})`,
        '--json                    Print the full remediation-status read model as JSON',
        '--help                    Show help'
      ],
      artifacts: [DEFAULT_RESULT_FILE, DEFAULT_HISTORY_FILE]
    });
    return ExitCode.Success;
  }

  try {
    const latestResultPath = options.latestResultPath ?? DEFAULT_RESULT_FILE;
    const historyPath = options.historyPath ?? DEFAULT_HISTORY_FILE;
    const latestResult = readRequiredArtifact<TestAutofixArtifact>(cwd, latestResultPath, 'remediation-status');
    const history = readRequiredArtifact<TestAutofixRemediationHistoryArtifact>(cwd, historyPath, 'remediation-status');
    const artifact = engine.buildRemediationStatusArtifact({
      latestResult,
      history,
      latestResultPath,
      remediationHistoryPath: historyPath
    });

    if (options.format === 'json') {
      emitJsonOutput({ cwd, command: 'remediation-status', payload: artifact });
      return ExitCode.Success;
    }

    if (!options.quiet) {
      console.log(renderText(artifact));
    }
    return ExitCode.Success;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (options.format === 'json') {
      console.log(JSON.stringify({ schemaVersion: '1.0', command: 'remediation-status', error: message }, null, 2));
    } else {
      console.error(message);
    }
    return ExitCode.Failure;
  }
};
