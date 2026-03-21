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
import { renderBriefReport } from '../lib/briefText.js';

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
  const latestBlockedSignature = artifact.blocked_signatures[0];
  const latestReviewSignature = artifact.review_required_signatures[0];
  const repeatedFailure = artifact.stable_failure_signatures.find((entry: RemediationStatusArtifact['stable_failure_signatures'][number]) => entry.occurrences > 1);
  const preferredRepair = artifact.preferred_repair_classes[0];
  const threshold = artifact.telemetry.threshold_counterfactuals.find((entry) => entry.latest_run_would_clear);

  return renderBriefReport({
    title: 'Remediation status',
    decision: `${artifact.latest_run.final_status} (${artifact.latest_run.retry_policy_decision})`,
    affectedSurfaces: [
      `latest run ${artifact.latest_run.run_id}`,
      artifact.latest_run.preferred_repair_class ? `preferred repair ${artifact.latest_run.preferred_repair_class}` : null,
      `${artifact.remediation_history.length} recorded run(s)`
    ],
    blockers: [
      latestBlockedSignature ? `blocked signature: ${latestBlockedSignature}` : null,
      latestReviewSignature ? `review-required signature: ${latestReviewSignature}` : null,
      repeatedFailure ? `repeated failure: ${repeatedFailure.failure_signature}` : null
    ],
    nextAction: artifact.safe_to_retry_signatures.length > 0
      ? `Retry ${artifact.safe_to_retry_signatures[0]} with ${artifact.latest_run.preferred_repair_class ?? 'reviewed repair guidance'}`
      : latestBlockedSignature
        ? `Inspect ${latestBlockedSignature} in .playbook/remediation-status.json before tuning thresholds`
        : 'Inspect .playbook/remediation-status.json for telemetry-backed follow-up',
    sections: [
      {
        heading: 'Why',
        items: [
          `Safe-to-retry signatures: ${artifact.safe_to_retry_signatures.length}`,
          `Blocked signatures: ${artifact.blocked_signatures.length}`,
          `Review-required signatures: ${artifact.review_required_signatures.length}`,
          `Dry-run/apply ratio: ${artifact.telemetry.dry_run_to_apply_ratio}`
        ]
      },
      {
        heading: 'Priority guidance',
        items: [
          preferredRepair ? `${preferredRepair.repair_class} has ${preferredRepair.success_count} prior success${preferredRepair.success_count === 1 ? '' : 'es'}` : null,
          threshold ? `latest run clears threshold ${threshold.threshold}` : artifact.telemetry.threshold_counterfactuals[0] ? `threshold advisory: ${artifact.telemetry.threshold_counterfactuals[0].advisory_note}` : null,
          artifact.telemetry.conservative_confidence_signal.reasoning
        ]
      }
    ]
  });
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
