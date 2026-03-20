import fs from 'node:fs';
import path from 'node:path';
import type { SpawnSyncReturns } from 'node:child_process';
import * as engineRuntime from '@zachariahredfield/playbook-engine';
import {
  TEST_AUTOFIX_ARTIFACT_KIND,
  TEST_AUTOFIX_SCHEMA_VERSION,
  type TestAutofixArtifact,
  type TestAutofixApplySummary,
  type TestAutofixExcludedFindingSummary,
  type TestAutofixFinalStatus,
  type TestAutofixVerificationCommandResult,
  type TestAutofixVerificationSummary,
  type TestFixPlanArtifact,
  type TestTriageArtifact
} from '@zachariahredfield/playbook-core';
import { ExitCode } from '../lib/cliContract.js';
import { emitJsonOutput, writeJsonArtifact } from '../lib/jsonArtifact.js';
import { printCommandHelp } from '../lib/commandSurface.js';
import { runSpawnSync } from '../lib/processRunner.js';
import { runApply } from './apply.js';


type TestAutofixRetryPolicyDecision = 'allow_repair' | 'allow_with_preferred_repair_class' | 'blocked_repeat_failure' | 'review_required_repeat_failure' | 'no_history';

type TestAutofixHistorySummary = {
  matched_signatures: string[];
  matching_run_ids: string[];
  prior_final_statuses: string[];
  prior_applied_repair_classes: string[];
  prior_successful_repair_classes: string[];
  repeated_failed_repair_attempts: Array<{
    failure_signature: string;
    repair_class: string;
    count: number;
    run_ids: string[];
  }>;
  provenance_run_ids: string[];
};

type TestAutofixOptions = {
  format: 'text' | 'json';
  quiet: boolean;
  input?: string;
  outFile?: string;
  help?: boolean;
};

type RemediationHistoryClassification = {
  failure_signature: string;
  failure_kind: string;
  repair_class: string;
  package: string | null;
  test_file: string | null;
  test_name: string | null;
};

type RemediationHistoryEntry = {
  run_id: string;
  generatedAt: string;
  input: { path: string };
  failure_signatures: string[];
  triage_classifications: RemediationHistoryClassification[];
  admitted_findings: string[];
  excluded_findings: string[];
  applied_task_ids: string[];
  applied_repair_classes: string[];
  files_touched: string[];
  verification_commands: string[];
  verification_outcomes: TestAutofixVerificationCommandResult[];
  final_status: TestAutofixFinalStatus;
  stop_reasons: string[];
  provenance: {
    failure_log_path: string;
    triage_artifact_path: string;
    fix_plan_artifact_path: string;
    apply_result_path: string | null;
    autofix_result_path: string;
  };
};

type RemediationHistoryArtifact = {
  schemaVersion: '1.0';
  kind: 'test-autofix-remediation-history';
  generatedAt: string;
  runs: RemediationHistoryEntry[];
};

type ApplyJsonPayload = {
  ok: boolean;
  exitCode: number;
  message?: string;
  results: Array<{ id: string; file: string | null; ruleId: string; status: 'applied' | 'skipped' | 'unsupported' | 'failed' }>;
  summary: {
    applied: number;
    skipped: number;
    unsupported: number;
    failed: number;
  };
};

const engine = engineRuntime as unknown as {
  appendRemediationHistoryEntry: (artifact: RemediationHistoryArtifact, entry: RemediationHistoryEntry) => RemediationHistoryArtifact;
  evaluateRepeatRemediationPolicy: (triage: TestTriageArtifact, fixPlan: TestFixPlanArtifact, history: RemediationHistoryArtifact) => {
    failure_signatures: string[];
    history_summary: TestAutofixHistorySummary;
    preferred_repair_class: string | null;
    retry_policy_decision: TestAutofixRetryPolicyDecision;
    retry_policy_reason: string;
  };
  buildTestFixPlanArtifact: (triage: TestTriageArtifact) => TestFixPlanArtifact;
  buildTestTriageArtifact: (rawLog: string, source: { input: 'file' | 'stdin'; path: string | null }) => TestTriageArtifact;
  buildTriageClassifications: (entries: RemediationHistoryEntry['triage_classifications']) => RemediationHistoryEntry['triage_classifications'];
  createEmptyRemediationHistoryArtifact: () => RemediationHistoryArtifact;
  nextRemediationHistoryRunId: (artifact: RemediationHistoryArtifact) => string;
  normalizeRemediationHistoryArtifact: (value: unknown) => RemediationHistoryArtifact;
};

const DEFAULT_RESULT_FILE = '.playbook/test-autofix.json' as const;
const DEFAULT_TRIAGE_FILE = '.playbook/test-triage.json' as const;
const DEFAULT_FIX_PLAN_FILE = '.playbook/test-fix-plan.json' as const;
const DEFAULT_APPLY_FILE = '.playbook/test-autofix-apply.json' as const;
const DEFAULT_HISTORY_FILE = '.playbook/test-autofix-history.json' as const;

const readInputLog = (cwd: string, inputPath?: string): { rawLog: string; path: string } => {
  if (!inputPath) {
    throw new Error('playbook test-autofix: --input <failure-log-path> is required.');
  }

  const absolute = path.resolve(cwd, inputPath);
  return { rawLog: fs.readFileSync(absolute, 'utf8'), path: inputPath };
};

const emptyApplySummary = (message: string): TestAutofixApplySummary => ({
  attempted: false,
  ok: false,
  exitCode: ExitCode.Success,
  applied: 0,
  skipped: 0,
  unsupported: 0,
  failed: 0,
  message
});

const emptyVerificationSummary = (): TestAutofixVerificationSummary => ({
  attempted: false,
  ok: false,
  total: 0,
  passed: 0,
  failed: 0
});

const compareStrings = (left: string, right: string): number => left.localeCompare(right);
const uniqueSorted = (values: Array<string | null | undefined>): string[] => [...new Set(values.filter((value): value is string => Boolean(value)).map((value) => value.trim()).filter(Boolean))].sort(compareStrings);

const summarizeExcludedFindings = (artifact: TestFixPlanArtifact): TestAutofixExcludedFindingSummary => {
  const counts = new Map<string, number>();
  for (const entry of artifact.excluded) {
    counts.set(entry.reason, (counts.get(entry.reason) ?? 0) + 1);
  }

  return {
    total: artifact.excluded.length,
    review_required: artifact.excluded.filter((entry: TestFixPlanArtifact['excluded'][number]) => entry.repair_class === 'review_required').length,
    by_reason: [...counts.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((left, right) => left.reason.localeCompare(right.reason))
  };
};

const captureJsonConsoleOutput = async <T>(run: () => Promise<number>): Promise<{ exitCode: number; payload: T }> => {
  const logs: string[] = [];
  const originalLog = console.log;
  console.log = (...args: unknown[]) => {
    logs.push(args.map((entry) => String(entry)).join(' '));
  };

  try {
    const exitCode = await run();
    const rawPayload = logs.at(-1);
    if (!rawPayload) {
      throw new Error('Expected JSON output but command did not emit any payload.');
    }
    return {
      exitCode,
      payload: JSON.parse(rawPayload) as T
    };
  } finally {
    console.log = originalLog;
  }
};

const runVerificationCommand = (command: string, cwd: string): SpawnSyncReturns<string> =>
  runSpawnSync(command, { cwd, shell: true, encoding: 'utf8' });

const runVerificationPlan = (commands: string[], cwd: string): { results: TestAutofixVerificationCommandResult[]; summary: TestAutofixVerificationSummary } => {
  const results: TestAutofixVerificationCommandResult[] = [];

  for (const command of commands) {
    const completed = runVerificationCommand(command, cwd);
    const exitCode = completed.status ?? (typeof completed.error === 'undefined' ? ExitCode.Failure : ExitCode.EnvironmentPrereq);
    const ok = exitCode === 0;
    results.push({ command, exitCode, ok });
    if (!ok) {
      break;
    }
  }

  return {
    results,
    summary: {
      attempted: commands.length > 0,
      ok: commands.length > 0 && results.length === commands.length && results.every((entry: TestAutofixVerificationCommandResult) => entry.ok),
      total: commands.length,
      passed: results.filter((entry) => entry.ok).length,
      failed: results.filter((entry) => !entry.ok).length
    }
  };
};

const renderText = (artifact: TestAutofixArtifact, outFile: string): string => {
  const lines = [
    'Test autofix',
    '────────────',
    `Input log: ${artifact.input}`,
    `Run id: ${artifact.run_id}`,
    `Wrote artifact: ${outFile}`,
    `History artifact: ${artifact.remediation_history_path}`,
    `Final status: ${artifact.final_status}`,
    `Reason: ${artifact.reason}`,
    `Triage artifact: ${artifact.source_triage.path ?? '(none)'}`,
    `Fix-plan artifact: ${artifact.source_fix_plan.path ?? '(none)'}`,
    `Apply artifact: ${artifact.source_apply.path ?? '(none)'}`,
    `Apply attempted: ${artifact.apply_result.attempted ? 'yes' : 'no'}`,
    `Verification attempted: ${artifact.verification_result.attempted ? 'yes' : 'no'}`
  ];

  if (artifact.applied_task_ids.length > 0) {
    lines.push('', 'Applied tasks');
    for (const taskId of artifact.applied_task_ids) {
      lines.push(`- ${taskId}`);
    }
  }

  if (artifact.executed_verification_commands.length > 0) {
    lines.push('', 'Verification commands');
    for (const command of artifact.executed_verification_commands) {
      lines.push(`- [${command.ok ? 'ok' : 'fail'}] (${command.exitCode}) ${command.command}`);
    }
  }

  if (artifact.stop_reasons.length > 0) {
    lines.push('', 'Stop reasons');
    for (const reason of artifact.stop_reasons) {
      lines.push(`- ${reason}`);
    }
  }

  if (artifact.excluded_finding_summary.total > 0) {
    lines.push('', 'Excluded findings');
    for (const entry of artifact.excluded_finding_summary.by_reason) {
      lines.push(`- ${entry.reason}: ${entry.count}`);
    }
  }

  return lines.join('\n');
};

const classifyStopWithoutMutation = (triage: TestTriageArtifact, fixPlan: TestFixPlanArtifact, retryPolicy: { retry_policy_decision: TestAutofixRetryPolicyDecision; retry_policy_reason: string }): { finalStatus: TestAutofixFinalStatus; reason: string } | null => {
  if (triage.findings.length === 0) {
    return {
      finalStatus: 'blocked',
      reason: 'No test findings were parsed from the provided failure log, so test-autofix stopped before planning or mutation.'
    };
  }

  if (fixPlan.tasks.length === 0 && fixPlan.excluded.length > 0 && fixPlan.excluded.every((entry: TestFixPlanArtifact['excluded'][number]) => entry.repair_class === 'review_required')) {
    return {
      finalStatus: 'review_required_only',
      reason: 'All findings were review-required exclusions, so test-autofix preserved the trust boundary and performed no mutation.'
    };
  }

  if (retryPolicy.retry_policy_decision === 'blocked_repeat_failure') {
    return {
      finalStatus: 'blocked',
      reason: retryPolicy.retry_policy_reason
    };
  }

  if (retryPolicy.retry_policy_decision === 'review_required_repeat_failure') {
    return {
      finalStatus: 'review_required_only',
      reason: retryPolicy.retry_policy_reason
    };
  }

  if (fixPlan.tasks.length === 0) {
    return {
      finalStatus: 'blocked',
      reason: 'Test-fix-plan produced no executable low-risk tasks, so test-autofix stopped before mutation.'
    };
  }

  return null;
};

const computeExitCode = (status: TestAutofixFinalStatus): number =>
  status === 'fixed' || status === 'review_required_only' ? ExitCode.Success : ExitCode.Failure;

const readHistoryArtifact = (cwd: string): RemediationHistoryArtifact => {
  const absolute = path.resolve(cwd, DEFAULT_HISTORY_FILE);
  if (!fs.existsSync(absolute)) {
    return engine.createEmptyRemediationHistoryArtifact();
  }

  const parsed = JSON.parse(fs.readFileSync(absolute, 'utf8')) as { data?: unknown } | unknown;
  const payload = parsed && typeof parsed === 'object' && 'data' in (parsed as Record<string, unknown>)
    ? (parsed as { data?: unknown }).data
    : parsed;
  return engine.normalizeRemediationHistoryArtifact(payload);
};

const buildHistoryEntry = (params: {
  runId: string;
  inputPath: string;
  triage: TestTriageArtifact;
  fixPlan: TestFixPlanArtifact;
  artifact: TestAutofixArtifact;
  applyArtifactPath: string | null;
  outFile: string;
  filesTouched: string[];
}): RemediationHistoryEntry => {
  const { runId, inputPath, triage, fixPlan, artifact, applyArtifactPath, outFile, filesTouched } = params;
  return {
    run_id: runId,
    generatedAt: new Date(0).toISOString(),
    input: { path: inputPath },
    failure_signatures: uniqueSorted(triage.findings.map((finding: TestTriageArtifact['findings'][number]) => finding.failure_signature)),
    triage_classifications: engine.buildTriageClassifications(triage.findings.map((finding: TestTriageArtifact['findings'][number]) => ({
      failure_signature: finding.failure_signature,
      failure_kind: finding.failure_kind,
      repair_class: finding.repair_class,
      package: finding.package,
      test_file: finding.test_file,
      test_name: finding.test_name
    }))),
    admitted_findings: uniqueSorted(fixPlan.tasks.map((task: TestFixPlanArtifact['tasks'][number]) => task.provenance.failure_signature)),
    excluded_findings: uniqueSorted(fixPlan.excluded.map((entry: TestFixPlanArtifact['excluded'][number]) => entry.failure_signature)),
    applied_task_ids: [...artifact.applied_task_ids],
    applied_repair_classes: uniqueSorted(fixPlan.tasks.map((task: TestFixPlanArtifact['tasks'][number]) => task.task_kind)),
    files_touched: filesTouched,
    verification_commands: uniqueSorted(artifact.executed_verification_commands.map((entry: TestAutofixVerificationCommandResult) => entry.command)),
    verification_outcomes: [...artifact.executed_verification_commands],
    final_status: artifact.final_status,
    stop_reasons: [...artifact.stop_reasons],
    provenance: {
      failure_log_path: inputPath,
      triage_artifact_path: DEFAULT_TRIAGE_FILE,
      fix_plan_artifact_path: DEFAULT_FIX_PLAN_FILE,
      apply_result_path: applyArtifactPath,
      autofix_result_path: outFile
    }
  };
};

export const runTestAutofix = async (cwd: string, options: TestAutofixOptions): Promise<number> => {
  if (options.help) {
    printCommandHelp({
      usage: 'playbook test-autofix --input <path> [--json] [--out <path>]',
      description:
        'Orchestrate deterministic test failure diagnosis, bounded repair planning, reviewed apply execution, narrow-first verification, and remediation history capture without introducing a new mutation executor.',
      options: [
        '--input <path>           Read a captured test failure log',
        `--out <path>             Write the result artifact (default ${DEFAULT_RESULT_FILE})`,
        '--json                   Print the stable test-autofix artifact as JSON',
        '--help                   Show help'
      ],
      artifacts: [DEFAULT_TRIAGE_FILE, DEFAULT_FIX_PLAN_FILE, DEFAULT_APPLY_FILE, DEFAULT_RESULT_FILE, DEFAULT_HISTORY_FILE]
    });
    return ExitCode.Success;
  }

  try {
    const source = readInputLog(cwd, options.input);
    const historyBefore = readHistoryArtifact(cwd);
    const runId = engine.nextRemediationHistoryRunId(historyBefore);
    const triage = engine.buildTestTriageArtifact(source.rawLog, { input: 'file', path: source.path });
    writeJsonArtifact(cwd, DEFAULT_TRIAGE_FILE, triage, 'test-autofix');

    const fixPlan = engine.buildTestFixPlanArtifact(triage);
    writeJsonArtifact(cwd, DEFAULT_FIX_PLAN_FILE, fixPlan, 'test-autofix');

    const excludedSummary = summarizeExcludedFindings(fixPlan);
    const retryPolicy = engine.evaluateRepeatRemediationPolicy(triage, fixPlan, historyBefore);
    const stop = classifyStopWithoutMutation(triage, fixPlan, retryPolicy);
    const outFile = options.outFile ?? DEFAULT_RESULT_FILE;
    let applyArtifactPath: string | null = null;
    let filesTouched: string[] = [];

    if (stop) {
      const artifact: TestAutofixArtifact = {
        schemaVersion: TEST_AUTOFIX_SCHEMA_VERSION,
        kind: TEST_AUTOFIX_ARTIFACT_KIND,
        command: 'test-autofix',
        generatedAt: new Date(0).toISOString(),
        run_id: runId,
        input: source.path,
        source_triage: { path: DEFAULT_TRIAGE_FILE, command: 'test-triage' },
        source_fix_plan: { path: DEFAULT_FIX_PLAN_FILE, command: 'test-fix-plan' },
        source_apply: { path: null, command: 'apply' },
        remediation_history_path: DEFAULT_HISTORY_FILE,
        failure_signatures: retryPolicy.failure_signatures,
        history_summary: retryPolicy.history_summary,
        preferred_repair_class: retryPolicy.preferred_repair_class,
        retry_policy_decision: retryPolicy.retry_policy_decision,
        retry_policy_reason: retryPolicy.retry_policy_reason,
        apply_result: emptyApplySummary(stop.reason),
        verification_result: emptyVerificationSummary(),
        executed_verification_commands: [],
        applied_task_ids: [],
        excluded_finding_summary: excludedSummary,
        final_status: stop.finalStatus,
        stop_reasons: [stop.reason],
        reason: stop.reason
      };
      writeJsonArtifact(cwd, outFile, artifact, 'test-autofix');
      const historyEntry = buildHistoryEntry({ runId, inputPath: source.path, triage, fixPlan, artifact, applyArtifactPath, outFile, filesTouched });
      const nextHistory = engine.appendRemediationHistoryEntry(historyBefore, historyEntry);
      writeJsonArtifact(cwd, DEFAULT_HISTORY_FILE, nextHistory, 'test-autofix');
      if (options.format === 'json') {
        emitJsonOutput({ cwd, command: 'test-autofix', payload: artifact });
      } else if (!options.quiet) {
        console.log(renderText(artifact, outFile));
      }
      return computeExitCode(artifact.final_status);
    }

    const applyExecution = await captureJsonConsoleOutput<ApplyJsonPayload>(() =>
      runApply(cwd, { format: 'json', quiet: false, ci: false, fromPlan: DEFAULT_FIX_PLAN_FILE })
    );
    writeJsonArtifact(cwd, DEFAULT_APPLY_FILE, applyExecution.payload as unknown as Record<string, unknown>, 'test-autofix');
    applyArtifactPath = DEFAULT_APPLY_FILE;

    const applySummary: TestAutofixApplySummary = {
      attempted: true,
      ok: applyExecution.payload.ok,
      exitCode: applyExecution.exitCode,
      applied: applyExecution.payload.summary.applied,
      skipped: applyExecution.payload.summary.skipped,
      unsupported: applyExecution.payload.summary.unsupported,
      failed: applyExecution.payload.summary.failed,
      message: applyExecution.payload.message ?? null
    };

    const appliedTaskIds = applyExecution.payload.results
      .filter((entry) => entry.status === 'applied')
      .map((entry) => entry.id)
      .sort((left, right) => left.localeCompare(right));
    filesTouched = uniqueSorted(applyExecution.payload.results.filter((entry) => entry.status === 'applied').map((entry) => entry.file));

    let finalStatus: TestAutofixFinalStatus;
    let reason: string;
    let verificationCommands: TestAutofixVerificationCommandResult[] = [];
    let verificationSummary: TestAutofixVerificationSummary = emptyVerificationSummary();

    if (!applyExecution.payload.ok) {
      finalStatus = 'blocked';
      reason = 'Apply failed while executing the reviewed test-fix-plan artifact, so test-autofix stopped before verification.';
    } else {
      const verification = runVerificationPlan([...triage.rerun_plan.commands], cwd);
      verificationCommands = verification.results;
      verificationSummary = verification.summary;

      if (verification.summary.ok) {
        finalStatus = excludedSummary.total > 0 ? 'partially_fixed' : 'fixed';
        reason = excludedSummary.total > 0
          ? 'Verification passed after apply, but some findings remained excluded from mutation and still require review.'
          : 'Verification passed after apply for every narrow-first rerun command emitted by test-triage.';
      } else {
        finalStatus = appliedTaskIds.length > 0 ? 'partially_fixed' : 'not_fixed';
        reason = 'At least one narrow-first verification command emitted by test-triage still failed after apply.';
      }
    }

    const artifact: TestAutofixArtifact = {
      schemaVersion: TEST_AUTOFIX_SCHEMA_VERSION,
      kind: TEST_AUTOFIX_ARTIFACT_KIND,
      command: 'test-autofix',
      generatedAt: new Date(0).toISOString(),
      run_id: runId,
      input: source.path,
      source_triage: { path: DEFAULT_TRIAGE_FILE, command: 'test-triage' },
      source_fix_plan: { path: DEFAULT_FIX_PLAN_FILE, command: 'test-fix-plan' },
      source_apply: { path: applyArtifactPath, command: 'apply' },
      remediation_history_path: DEFAULT_HISTORY_FILE,
      failure_signatures: retryPolicy.failure_signatures,
      history_summary: retryPolicy.history_summary,
      preferred_repair_class: retryPolicy.preferred_repair_class,
      retry_policy_decision: retryPolicy.retry_policy_decision,
      retry_policy_reason: retryPolicy.retry_policy_reason,
      apply_result: applySummary,
      verification_result: verificationSummary,
      executed_verification_commands: verificationCommands,
      applied_task_ids: appliedTaskIds,
      excluded_finding_summary: excludedSummary,
      final_status: finalStatus,
      stop_reasons: [reason],
      reason
    };

    writeJsonArtifact(cwd, outFile, artifact, 'test-autofix');
    const historyEntry = buildHistoryEntry({ runId, inputPath: source.path, triage, fixPlan, artifact, applyArtifactPath, outFile, filesTouched });
    const nextHistory = engine.appendRemediationHistoryEntry(historyBefore, historyEntry);
    writeJsonArtifact(cwd, DEFAULT_HISTORY_FILE, nextHistory, 'test-autofix');
    if (options.format === 'json') {
      emitJsonOutput({ cwd, command: 'test-autofix', payload: artifact });
    } else if (!options.quiet) {
      console.log(renderText(artifact, outFile));
    }

    return computeExitCode(finalStatus);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (options.format === 'json') {
      console.log(JSON.stringify({ schemaVersion: '1.0', command: 'test-autofix', error: message }, null, 2));
    } else {
      console.error(message);
    }
    return ExitCode.Failure;
  }
};
