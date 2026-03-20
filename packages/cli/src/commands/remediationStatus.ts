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
