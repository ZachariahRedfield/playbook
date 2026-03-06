import fs from 'node:fs';
import path from 'node:path';
import { applyExecutionPlan, generatePlanContract, parsePlanArtifact } from '@zachariahredfield/playbook-engine';
import { ExitCode } from '../lib/cliContract.js';
import { loadVerifyRules } from '../lib/loadVerifyRules.js';

type ApplyOptions = {
  format: 'text' | 'json';
  ci: boolean;
  quiet: boolean;
  fromPlan?: string;
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

const loadPlanFromFile = (cwd: string, fromPlan: string): { tasks: PlanTask[] } => {
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

  return parsePlanArtifact(payload);
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
  const plan = options.fromPlan ? loadPlanFromFile(cwd, options.fromPlan) : generatePlanContract(cwd);
  const verifyRules = await loadVerifyRules(cwd);

  const handlers: Record<string, NonNullable<(typeof verifyRules)[number]['fix']>> = {};
  for (const task of plan.tasks) {
    const pluginRule = verifyRules.find((rule) => rule.id === task.ruleId);
    if (pluginRule?.fix) {
      handlers[task.ruleId] = pluginRule.fix;
    }
  }

  const execution = await applyExecutionPlan(cwd, plan.tasks, { dryRun: false, handlers });

  const exitCode = execution.summary.failed > 0 ? ExitCode.Failure : ExitCode.Success;
  const payload: ApplyJsonResult = {
    schemaVersion: '1.0',
    command: 'apply',
    ok: exitCode === ExitCode.Success,
    exitCode,
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
