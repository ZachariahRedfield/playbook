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

type TestAutofixOptions = {
  format: 'text' | 'json';
  quiet: boolean;
  input?: string;
  outFile?: string;
  help?: boolean;
};

type ApplyJsonPayload = {
  ok: boolean;
  exitCode: number;
  message?: string;
  results: Array<{ id: string; status: 'applied' | 'skipped' | 'unsupported' | 'failed' }>;
  summary: {
    applied: number;
    skipped: number;
    unsupported: number;
    failed: number;
  };
};

const engine = engineRuntime as unknown as {
  buildTestTriageArtifact: (rawLog: string, source: { input: 'file' | 'stdin'; path: string | null }) => TestTriageArtifact;
  buildTestFixPlanArtifact: (triage: TestTriageArtifact) => TestFixPlanArtifact;
};

const DEFAULT_RESULT_FILE = '.playbook/test-autofix.json' as const;
const DEFAULT_TRIAGE_FILE = '.playbook/test-triage.json' as const;
const DEFAULT_FIX_PLAN_FILE = '.playbook/test-fix-plan.json' as const;

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

const summarizeExcludedFindings = (artifact: TestFixPlanArtifact): TestAutofixExcludedFindingSummary => {
  const counts = new Map<string, number>();
  for (const entry of artifact.excluded) {
    counts.set(entry.reason, (counts.get(entry.reason) ?? 0) + 1);
  }

  return {
    total: artifact.excluded.length,
    review_required: artifact.excluded.filter((entry: any) => entry.repair_class === 'review_required').length,
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
      ok: commands.length > 0 && results.length === commands.length && results.every((entry) => entry.ok),
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
    `Wrote artifact: ${outFile}`,
    `Final status: ${artifact.final_status}`,
    `Reason: ${artifact.reason}`,
    `Triage artifact: ${artifact.source_triage.path ?? '(none)'}`,
    `Fix-plan artifact: ${artifact.source_fix_plan.path ?? '(none)'}`,
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

  if (artifact.excluded_finding_summary.total > 0) {
    lines.push('', 'Excluded findings');
    for (const entry of artifact.excluded_finding_summary.by_reason) {
      lines.push(`- ${entry.reason}: ${entry.count}`);
    }
  }

  return lines.join('\n');
};

const classifyStopWithoutMutation = (triage: TestTriageArtifact, fixPlan: TestFixPlanArtifact): { finalStatus: TestAutofixFinalStatus; reason: string } | null => {
  if (triage.findings.length === 0) {
    return {
      finalStatus: 'blocked',
      reason: 'No test findings were parsed from the provided failure log, so test-autofix stopped before planning or mutation.'
    };
  }

  if (fixPlan.tasks.length === 0 && fixPlan.excluded.length > 0 && fixPlan.excluded.every((entry: any) => entry.repair_class === 'review_required')) {
    return {
      finalStatus: 'review_required_only',
      reason: 'All findings were review-required exclusions, so test-autofix preserved the trust boundary and performed no mutation.'
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

export const runTestAutofix = async (cwd: string, options: TestAutofixOptions): Promise<number> => {
  if (options.help) {
    printCommandHelp({
      usage: 'playbook test-autofix --input <path> [--json] [--out <path>]',
      description:
        'Orchestrate deterministic test failure diagnosis, bounded repair planning, reviewed apply execution, and narrow-first verification without introducing a new mutation executor.',
      options: [
        '--input <path>           Read a captured test failure log',
        `--out <path>             Write the result artifact (default ${DEFAULT_RESULT_FILE})`,
        '--json                   Print the stable test-autofix artifact as JSON',
        '--help                   Show help'
      ],
      artifacts: [DEFAULT_TRIAGE_FILE, DEFAULT_FIX_PLAN_FILE, DEFAULT_RESULT_FILE]
    });
    return ExitCode.Success;
  }

  try {
    const source = readInputLog(cwd, options.input);
    const triage = engine.buildTestTriageArtifact(source.rawLog, { input: 'file', path: source.path });
    writeJsonArtifact(cwd, DEFAULT_TRIAGE_FILE, triage, 'test-autofix');

    const fixPlan = engine.buildTestFixPlanArtifact(triage);
    writeJsonArtifact(cwd, DEFAULT_FIX_PLAN_FILE, fixPlan, 'test-autofix');

    const excludedSummary = summarizeExcludedFindings(fixPlan);
    const stop = classifyStopWithoutMutation(triage, fixPlan);
    const outFile = options.outFile ?? DEFAULT_RESULT_FILE;

    if (stop) {
      const artifact: TestAutofixArtifact = {
        schemaVersion: TEST_AUTOFIX_SCHEMA_VERSION,
        kind: TEST_AUTOFIX_ARTIFACT_KIND,
        command: 'test-autofix',
        generatedAt: new Date(0).toISOString(),
        input: source.path,
        source_triage: { path: DEFAULT_TRIAGE_FILE, command: 'test-triage' },
        source_fix_plan: { path: DEFAULT_FIX_PLAN_FILE, command: 'test-fix-plan' },
        apply_result: emptyApplySummary(stop.reason),
        verification_result: emptyVerificationSummary(),
        executed_verification_commands: [],
        applied_task_ids: [],
        excluded_finding_summary: excludedSummary,
        final_status: stop.finalStatus,
        reason: stop.reason
      };
      writeJsonArtifact(cwd, outFile, artifact, 'test-autofix');
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
      input: source.path,
      source_triage: { path: DEFAULT_TRIAGE_FILE, command: 'test-triage' },
      source_fix_plan: { path: DEFAULT_FIX_PLAN_FILE, command: 'test-fix-plan' },
      apply_result: applySummary,
      verification_result: verificationSummary,
      executed_verification_commands: verificationCommands,
      applied_task_ids: appliedTaskIds,
      excluded_finding_summary: excludedSummary,
      final_status: finalStatus,
      reason
    };

    writeJsonArtifact(cwd, outFile, artifact, 'test-autofix');
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
