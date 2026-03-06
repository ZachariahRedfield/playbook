import type { FixHandler, PlanTask } from './types.js';
import { loadConfig } from '../config/load.js';
import { getChangedFiles } from '../git/diff.js';
import { resolveDiffBase } from '../git/base.js';
import { loadPlugins } from '../plugins/loadPlugins.js';
import { getRegisteredRules, registerRule, resetPluginRegistry } from '../plugins/pluginRegistry.js';
import { getCoreRules } from '../rules/coreRules.js';
import { defaultFixHandlers } from './defaultFixHandlers.js';
import { FixExecutor } from './fixExecutor.js';
import { PlanGenerator } from './planGenerator.js';
import { RuleRunner } from './ruleRunner.js';
import type { VerifyReport } from '../report/types.js';

export type PlanContract = {
  verify: {
    ok: VerifyReport['ok'];
    summary: VerifyReport['summary'];
    failures: VerifyReport['failures'];
    warnings: VerifyReport['warnings'];
  };
  tasks: PlanTask[];
};

type SerializedPlanEnvelope = {
  schemaVersion?: string;
  command?: string;
  tasks?: unknown;
};

const collectExecutionInputs = (repoRoot: string): { changedFiles: string[] } => {
  const base = resolveDiffBase(repoRoot);
  const changedFiles = base.baseSha ? getChangedFiles(repoRoot, base.baseSha) : [];
  return { changedFiles };
};

const collectRules = (repoRoot: string) => {
  const { config } = loadConfig(repoRoot);
  resetPluginRegistry();
  getCoreRules(config).forEach(registerRule);
  loadPlugins(repoRoot);
  return getRegisteredRules();
};

export const runRuleExecution = (repoRoot: string) => {
  const rules = collectRules(repoRoot);
  const runner = new RuleRunner(rules);
  return runner.run({ repoRoot, changedFiles: collectExecutionInputs(repoRoot).changedFiles });
};

export const generateExecutionPlan = (repoRoot: string): { tasks: PlanTask[] } => {
  const findings = runRuleExecution(repoRoot);
  const planner = new PlanGenerator();
  return planner.generate(findings.failures);
};

export const generatePlanContract = (repoRoot: string): PlanContract => {
  const findings = runRuleExecution(repoRoot);
  const planner = new PlanGenerator();
  const plan = planner.generate(findings.failures);

  return {
    verify: {
      ok: findings.failures.length === 0,
      summary: {
        failures: findings.failures.length,
        warnings: 0
      },
      failures: findings.failures,
      warnings: []
    },
    tasks: plan.tasks
  };
};

export const applyExecutionPlan = async (
  repoRoot: string,
  tasks: PlanTask[],
  options: { dryRun: boolean; handlers?: Record<string, FixHandler | undefined> }
) => {
  const executor = new FixExecutor({ ...defaultFixHandlers, ...(options.handlers ?? {}) });
  return executor.apply(tasks, { repoRoot, dryRun: options.dryRun });
};

export const parsePlanArtifact = (payload: unknown): { tasks: PlanTask[] } => {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid plan payload: expected an object envelope.');
  }

  const envelope = payload as SerializedPlanEnvelope;

  if (envelope.schemaVersion !== '1.0') {
    throw new Error(`Unsupported plan schemaVersion: ${String(envelope.schemaVersion ?? 'undefined')}.`);
  }

  if (envelope.command !== 'plan') {
    throw new Error('Invalid plan payload: command must be "plan".');
  }

  if (!Array.isArray(envelope.tasks)) {
    throw new Error('Invalid plan payload: tasks must be an array.');
  }

  const tasks = envelope.tasks.map((task) => {
    if (!task || typeof task !== 'object') {
      throw new Error('Invalid plan payload: each task must be an object.');
    }

    const typedTask = task as Record<string, unknown>;
    if (
      typeof typedTask.id !== 'string' ||
      typeof typedTask.ruleId !== 'string' ||
      typeof typedTask.action !== 'string' ||
      typeof typedTask.autoFix !== 'boolean'
    ) {
      throw new Error('Invalid plan payload: each task must include id, ruleId, action, and autoFix.');
    }

    if (typedTask.file !== null && typeof typedTask.file !== 'string') {
      throw new Error('Invalid plan payload: task.file must be a string or null.');
    }

    return {
      id: typedTask.id,
      ruleId: typedTask.ruleId,
      file: typedTask.file ?? null,
      action: typedTask.action,
      autoFix: typedTask.autoFix
    } as PlanTask;
  });

  return { tasks };
};

export { RuleRunner } from './ruleRunner.js';
export { PlanGenerator } from './planGenerator.js';
export { FixExecutor } from './fixExecutor.js';
export { defaultFixHandlers } from './defaultFixHandlers.js';
export type { PlanTask, RuleFailure, Rule, FixHandler } from './types.js';
