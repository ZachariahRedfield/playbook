import fs from 'node:fs';
import path from 'node:path';
import { applyExecutionPlan, generatePlanContract } from '@zachariahredfield/playbook-engine';
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

type SerializedPlanTask = {
  id: string;
  ruleId: string;
  file: string | null;
  action: string;
  autoFix: boolean;
};

type SerializedPlanPayload = {
  schemaVersion?: string;
  command?: string;
  tasks?: SerializedPlanTask[];
};

const loadPlanFromFile = (cwd: string, fromPlan: string): { tasks: SerializedPlanTask[] } => {
  const resolvedPath = path.resolve(cwd, fromPlan);
  const rawPayload = fs.readFileSync(resolvedPath, 'utf8');
  const payload = JSON.parse(rawPayload) as SerializedPlanPayload;

  if (payload.schemaVersion !== '1.0') {
    throw new Error(`Unsupported plan schemaVersion: ${String(payload.schemaVersion ?? 'undefined')}.`);
  }

  if (payload.command !== 'plan') {
    throw new Error('Invalid plan payload: command must be "plan".');
  }

  if (!Array.isArray(payload.tasks)) {
    throw new Error('Invalid plan payload: tasks must be an array.');
  }

  for (const task of payload.tasks) {
    if (!task || typeof task.id !== 'string' || typeof task.ruleId !== 'string' || typeof task.action !== 'string' || typeof task.autoFix !== 'boolean') {
      throw new Error('Invalid plan payload: each task must include id, ruleId, action, and autoFix.');
    }

    if (task.file !== null && typeof task.file !== 'string') {
      throw new Error('Invalid plan payload: task.file must be a string or null.');
    }
  }

  return { tasks: payload.tasks };
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

  const handlers = Object.fromEntries(
    plan.tasks.map((task: { ruleId: string }) => {
      const pluginRule = verifyRules.find((rule) => rule.id === task.ruleId);
      return [task.ruleId, pluginRule?.fix];
    })
  );

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
