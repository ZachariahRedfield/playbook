import fs from 'node:fs';
import path from 'node:path';
import * as engine from '@zachariahredfield/playbook-engine';
import { ExitCode } from '../lib/cliContract.js';
import { loadVerifyRules } from '../lib/loadVerifyRules.js';
import {
  buildPlanRemediation,
  deriveVerifyFailureFacts,
  parsePlanRemediation,
  remediationToApplyPrecondition,
  type PlanRemediation
} from '../lib/remediationContract.js';

type ApplyOptions = {
  format: 'text' | 'json';
  ci: boolean;
  quiet: boolean;
  help?: boolean;
  fromPlan?: string;
  tasks?: string[];
  runId?: string;
};

type ApplyResult = {
  id: string;
  ruleId: string;
  file: string | null;
  action: string;
  autoFix: boolean;
  status: 'applied' | 'skipped' | 'unsupported' | 'failed';
  message?: string;
};

type ApplyJsonResult = {
  schemaVersion: '1.0';
  command: 'apply';
  ok: boolean;
  exitCode: number;
  remediation: PlanRemediation;
  message?: string;
  results: ApplyResult[];
  summary: {
    applied: number;
    skipped: number;
    unsupported: number;
    failed: number;
  };
};

type PlanTask = {
  id: string;
  ruleId: string;
  file: string | null;
  action: string;
  autoFix: boolean;
};

type PlanSelection = {
  tasks: PlanTask[];
  remediation: PlanRemediation;
};

type DecodedPlanPayload = {
  text: string;
  likelyShellEncodingIssue: boolean;
};

const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);
const UTF16LE_BOM = Buffer.from([0xff, 0xfe]);
const UTF16BE_BOM = Buffer.from([0xfe, 0xff]);

const stripLeadingBom = (text: string): string => (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);

const inferUtf16WithoutBom = (buffer: Buffer): 'utf16le' | 'utf16be' | null => {
  if (buffer.length < 4 || buffer.length % 2 !== 0) {
    return null;
  }

  let evenNulls = 0;
  let oddNulls = 0;
  const pairCount = Math.floor(buffer.length / 2);
  for (let index = 0; index < buffer.length; index += 2) {
    if (buffer[index] === 0x00) {
      evenNulls += 1;
    }
    if (buffer[index + 1] === 0x00) {
      oddNulls += 1;
    }
  }

  const threshold = Math.max(2, Math.floor(pairCount * 0.6));
  if (oddNulls >= threshold && evenNulls === 0) {
    return 'utf16le';
  }

  if (evenNulls >= threshold && oddNulls === 0) {
    return 'utf16be';
  }

  return null;
};

const decodePlanPayload = (buffer: Buffer): DecodedPlanPayload => {
  if (buffer.subarray(0, UTF8_BOM.length).equals(UTF8_BOM)) {
    return { text: stripLeadingBom(buffer.toString('utf8')), likelyShellEncodingIssue: false };
  }

  if (buffer.subarray(0, UTF16LE_BOM.length).equals(UTF16LE_BOM)) {
    return { text: stripLeadingBom(buffer.subarray(UTF16LE_BOM.length).toString('utf16le')), likelyShellEncodingIssue: true };
  }

  if (buffer.subarray(0, UTF16BE_BOM.length).equals(UTF16BE_BOM)) {
    const littleEndianBuffer = Buffer.from(buffer.subarray(UTF16BE_BOM.length));
    littleEndianBuffer.swap16();
    return { text: stripLeadingBom(littleEndianBuffer.toString('utf16le')), likelyShellEncodingIssue: true };
  }

  const inferredUtf16 = inferUtf16WithoutBom(buffer);
  if (inferredUtf16 === 'utf16le') {
    return { text: stripLeadingBom(buffer.toString('utf16le')), likelyShellEncodingIssue: true };
  }

  if (inferredUtf16 === 'utf16be') {
    const littleEndianBuffer = Buffer.from(buffer);
    littleEndianBuffer.swap16();
    return { text: stripLeadingBom(littleEndianBuffer.toString('utf16le')), likelyShellEncodingIssue: true };
  }

  return { text: stripLeadingBom(buffer.toString('utf8')), likelyShellEncodingIssue: false };
};

const loadPlanFromFile = (cwd: string, fromPlan: string): PlanSelection => {
  const resolvedPath = path.resolve(cwd, fromPlan);

  let rawPayload = '';
  let likelyShellEncodingIssue = false;
  try {
    const rawBytes = fs.readFileSync(resolvedPath);
    const decodedPayload = decodePlanPayload(rawBytes);
    rawPayload = decodedPayload.text;
    likelyShellEncodingIssue = decodedPayload.likelyShellEncodingIssue;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to read plan file at ${resolvedPath}: ${message}`);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawPayload);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const encodingHint = likelyShellEncodingIssue
      ? ' The file appears to use a shell-specific encoding (for example UTF-16/BOM from PowerShell redirection). Re-write the plan file as UTF-8 and retry.'
      : '';
    throw new Error(`Invalid plan JSON in ${resolvedPath}: ${message}.${encodingHint}`);
  }

  const parsedPlan = engine.parsePlanArtifact(payload);

  const normalizedPayload =
    payload && typeof payload === 'object' && !Array.isArray(payload) && 'data' in payload
      ? ((payload as Record<string, unknown>).data as Record<string, unknown>)
      : (payload as Record<string, unknown>);

  if (!normalizedPayload || typeof normalizedPayload !== 'object') {
    throw new Error('Invalid plan payload: expected an object envelope.');
  }

  const remediation = parsePlanRemediation(normalizedPayload.remediation);

  return {
    tasks: parsedPlan.tasks,
    remediation
  };
};


const selectPlanTasks = (tasks: PlanTask[], selectedTaskIds: string[] | undefined): PlanTask[] => {
  if (!selectedTaskIds) {
    return tasks;
  }

  const normalizedIds = selectedTaskIds.filter((id) => id.trim().length > 0);
  const uniqueIds = [...new Set(normalizedIds)];

  if (uniqueIds.length === 0) {
    throw new Error('No task ids were provided. Supply at least one --task <task-id>.');
  }

  const availableTaskIds = new Set(tasks.map((task) => task.id));
  const unknownTaskIds = uniqueIds.filter((id) => !availableTaskIds.has(id));
  if (unknownTaskIds.length > 0) {
    throw new Error(`Unknown task id(s): ${unknownTaskIds.join(', ')}.`);
  }

  const selectedTaskIdsSet = new Set(uniqueIds);
  return tasks.filter((task) => selectedTaskIdsSet.has(task.id));
};

const renderTextApply = (result: ApplyJsonResult): void => {
  console.log('Apply');
  console.log('────────');
  console.log('');
  console.log(`Applied: ${result.summary.applied}`);
  console.log(`Skipped: ${result.summary.skipped}`);
  console.log(`Unsupported: ${result.summary.unsupported}`);
  console.log(`Failed: ${result.summary.failed}`);
  console.log('');

  if (result.results.length === 0) {
    console.log('(none)');
    return;
  }

  for (const entry of result.results) {
    const target = entry.file ?? '(no file)';
    console.log(`${entry.id} ${entry.ruleId} ${entry.status} ${target}`);
  }
};

const printApplyHelp = (): void => {
  console.log('Usage: playbook apply [options]');
  console.log('');
  console.log('Execute deterministic auto-fixable plan tasks from generated or saved plan artifacts.');
  console.log('');
  console.log('Options:');
  console.log('  --from-plan <path>         Apply tasks from a previously saved `playbook plan --json` artifact');
  console.log('  --task <id>                Apply only selected task ID (repeatable; requires --from-plan)');
  console.log('  --json                     Alias for --format=json');
  console.log('  --format <text|json>       Output format');
  console.log('  --quiet                    Suppress success output in text mode');
  console.log('  --help                     Show help');
};


const resolveRunId = (cwd: string, requestedRunId: string | undefined): string => {
  if (requestedRunId) {
    return requestedRunId;
  }

  const latest = engine.getLatestMutableRun ? engine.getLatestMutableRun(cwd) : null;
  if (latest) {
    return latest.id;
  }

  const intent = engine.createExecutionIntent('apply deterministic remediation plan', ['plan', 'apply', 'verify'], ['approved-plan-required'], 'user');
  return engine.createExecutionRun(cwd, intent).id;
};

export const runApply = async (cwd: string, options: ApplyOptions): Promise<number> => {
  if (options.help) {
    printApplyHelp();
    return ExitCode.Success;
  }

  const routeDecision = engine.routeTask(cwd, 'apply approved remediation plan', {
    taskKind: 'patch_execution',
    hasApprovedPlan: true,
    safetyConstraints: { allowRepositoryMutation: true, requiresApprovedPlan: true }
  });

  if (routeDecision.route === 'unsupported') {
    throw new Error(`Cannot execute apply flow: ${routeDecision.why}`);
  }

  const runId = resolveRunId(cwd, options.runId);

  if ((options.tasks?.length ?? 0) > 0 && !options.fromPlan) {
    throw new Error('The --task flag requires --from-plan so task selection is tied to a reviewed artifact.');
  }

  const plan = options.fromPlan
    ? loadPlanFromFile(cwd, options.fromPlan)
    : (() => {
        const generatedPlan = engine.generatePlanContract(cwd);
        const failureFacts = deriveVerifyFailureFacts(generatedPlan.verify);
        return {
          tasks: generatedPlan.tasks,
          remediation: buildPlanRemediation({ failureCount: failureFacts.failureCount, stepCount: generatedPlan.tasks.length })
        };
      })();
  const applyPrecondition = remediationToApplyPrecondition(plan.remediation);

  if (applyPrecondition.action === 'fail') {
    throw new Error(`Cannot apply remediation: ${applyPrecondition.message}`);
  }

  if (applyPrecondition.action === 'no_op') {
    const payload: ApplyJsonResult = {
      schemaVersion: '1.0',
      command: 'apply',
        ok: true,
      exitCode: ExitCode.Success,
      remediation: plan.remediation,
      message: applyPrecondition.message,
      results: [],
      summary: { applied: 0, skipped: 0, unsupported: 0, failed: 0 }
    };

    engine.appendExecutionStep(cwd, runId, {
      kind: 'apply',
      status: 'skipped',
      inputs: { fromPlan: options.fromPlan ?? null, selectedTaskCount: 0 },
      outputs: payload.summary,
      evidence: options.fromPlan ? [{ id: 'evidence-plan-artifact', kind: 'artifact', ref: options.fromPlan }] : []
    });

    const runArtifactPath = engine.executionRunPath(cwd, runId);
    engine.attachSessionRunState(cwd, {
      step: 'apply',
      runId,
      goal: 'apply deterministic remediation plan',
      artifacts: [
        { artifact: runArtifactPath, kind: 'run' },
        ...(options.fromPlan ? [{ artifact: options.fromPlan, kind: 'plan' as const }] : [])
      ]
    });

    if (options.format === 'json') {
      console.log(JSON.stringify(payload, null, 2));
      return ExitCode.Success;
    }

    if (!options.quiet) {
      console.log(applyPrecondition.message);
    }

    return ExitCode.Success;
  }

  const selectedTasks = selectPlanTasks(plan.tasks, options.tasks);
  engine.validateRemediationPlan(cwd, selectedTasks);
  const verifyRules = await loadVerifyRules(cwd);

  const handlers: Record<string, NonNullable<(typeof verifyRules)[number]['fix']>> = {};
  for (const task of selectedTasks) {
    const pluginRule = verifyRules.find((rule) => rule.id === task.ruleId);
    if (pluginRule?.fix) {
      handlers[task.ruleId] = pluginRule.fix;
    }
  }

  const execution = await engine.applyExecutionPlan(cwd, selectedTasks, { dryRun: false, handlers });

  const exitCode = execution.summary.failed > 0 ? ExitCode.Failure : ExitCode.Success;
  const payload: ApplyJsonResult = {
    schemaVersion: '1.0',
    command: 'apply',
    ok: exitCode === ExitCode.Success,
    exitCode,
    remediation: plan.remediation,
    message: applyPrecondition.message,
    results: execution.results,
    summary: execution.summary
  };

  engine.appendExecutionStep(cwd, runId, {
    kind: 'apply',
    status: exitCode === ExitCode.Success ? 'passed' : 'failed',
    inputs: {
      fromPlan: options.fromPlan ?? null,
      selectedTaskCount: selectedTasks.length
    },
    outputs: payload.summary,
    evidence: [
      ...(options.fromPlan ? [{ id: 'evidence-plan-artifact', kind: 'artifact' as const, ref: options.fromPlan }] : []),
      ...execution.results.map((result: ApplyResult, index: number) => ({
        id: `evidence-apply-${String(index + 1).padStart(3, '0')}`,
        kind: 'log' as const,
        ref: `${result.ruleId}:${result.status}`,
        note: result.message
      }))
    ]
  });


  const runArtifactPath = engine.executionRunPath(cwd, runId);
  engine.attachSessionRunState(cwd, {
    step: 'apply',
    runId,
    goal: 'apply deterministic remediation plan',
    artifacts: [
      { artifact: runArtifactPath, kind: 'run' },
      ...(options.fromPlan ? [{ artifact: options.fromPlan, kind: 'plan' as const }] : [])
    ]
  });
  if (options.format === 'json') {
    console.log(JSON.stringify(payload, null, 2));
    return exitCode;
  }

  if (!options.quiet) {
    renderTextApply(payload);
  }

  return exitCode;
};
