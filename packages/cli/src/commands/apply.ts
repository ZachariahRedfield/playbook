import fs from 'node:fs';
import path from 'node:path';
import { applyExecutionPlan, generatePlanContract, parsePlanArtifact } from '@zachariahredfield/playbook-engine';
import { ExitCode } from '../lib/cliContract.js';
import { loadVerifyRules } from '../lib/loadVerifyRules.js';
import {
  buildPlanRemediation,
  parsePlanRemediation,
  remediationToApplyPrecondition,
  type PlanRemediation
} from '../lib/remediationContract.js';

type ApplyOptions = {
  format: 'text' | 'json';
  ci: boolean;
  quiet: boolean;
  fromPlan?: string;
  tasks?: string[];
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

const loadPlanFromFile = (cwd: string, fromPlan: string): PlanSelection => {
  const resolvedPath = path.resolve(cwd, fromPlan);

  let rawPayload = '';
  try {
    rawPayload = fs.readFileSync(resolvedPath, 'utf8');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to read plan file at ${resolvedPath}: ${message}`);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawPayload);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid plan JSON in ${resolvedPath}: ${message}`);
  }

  const parsedPlan = parsePlanArtifact(payload);

  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid plan payload: expected an object envelope.');
  }

  const remediation = parsePlanRemediation((payload as Record<string, unknown>).remediation);

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

export const runApply = async (cwd: string, options: ApplyOptions): Promise<number> => {
  if ((options.tasks?.length ?? 0) > 0 && !options.fromPlan) {
    throw new Error('The --task flag requires --from-plan so task selection is tied to a reviewed artifact.');
  }

  const plan = options.fromPlan
    ? loadPlanFromFile(cwd, options.fromPlan)
    : (() => {
        const generatedPlan = generatePlanContract(cwd);
        const structuredFindingCount =
          (Array.isArray(generatedPlan.verify.failures) ? generatedPlan.verify.failures.length : 0) +
          (Array.isArray(generatedPlan.verify.warnings) ? generatedPlan.verify.warnings.length : 0);
        const findingCount =
          structuredFindingCount > 0
            ? structuredFindingCount
            : generatedPlan.verify.summary.failures + generatedPlan.verify.summary.warnings;
        return {
          tasks: generatedPlan.tasks,
          remediation: buildPlanRemediation({ findingCount, stepCount: generatedPlan.tasks.length })
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
  const verifyRules = await loadVerifyRules(cwd);

  const handlers: Record<string, NonNullable<(typeof verifyRules)[number]['fix']>> = {};
  for (const task of selectedTasks) {
    const pluginRule = verifyRules.find((rule) => rule.id === task.ruleId);
    if (pluginRule?.fix) {
      handlers[task.ruleId] = pluginRule.fix;
    }
  }

  const execution = await applyExecutionPlan(cwd, selectedTasks, { dryRun: false, handlers });

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

  if (options.format === 'json') {
    console.log(JSON.stringify(payload, null, 2));
    return exitCode;
  }

  if (!options.quiet) {
    renderTextApply(payload);
  }

  return exitCode;
};
