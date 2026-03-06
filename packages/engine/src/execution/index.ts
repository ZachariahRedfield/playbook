import type { FixHandler, PlanTask } from './types.js';
import { loadConfig } from '../config/load.js';
import { getChangedFiles } from '../git/diff.js';
import { resolveDiffBase } from '../git/base.js';
import { loadPlugins } from '../plugins/loadPlugins.js';
import { getRegisteredRules, registerRule, resetPluginRegistry } from '../plugins/pluginRegistry.js';
import { getCoreRules } from '../rules/coreRules.js';
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
  handlers: Record<string, FixHandler | undefined>,
  options: { dryRun: boolean }
) => {
  const executor = new FixExecutor(handlers);
  return executor.apply(tasks, { repoRoot, dryRun: options.dryRun });
};

export { RuleRunner } from './ruleRunner.js';
export { PlanGenerator } from './planGenerator.js';
export { FixExecutor } from './fixExecutor.js';
export type { PlanTask, RuleFailure, Rule, FixHandler } from './types.js';
