import type { FixHandler, PlanTask } from './types.js';
import { loadConfig } from '../config/load.js';
import { getChangedFiles } from '../git/diff.js';
import { resolveDiffBase } from '../git/base.js';
import { loadPlugins } from '../plugins/loadPlugins.js';
import { getRegisteredRules, registerRule, resetPluginRegistry } from '../plugins/pluginRegistry.js';
import { getCoreRules } from '../rules/coreRules.js';
import { defaultFixHandlers } from './defaultFixHandlers.js';
import { FixExecutor, HandlerResolver } from './fixExecutor.js';
import { PlanGenerator } from './planGenerator.js';
import { RuleRunner } from './ruleRunner.js';
import type { VerifyReport } from '../report/types.js';
import { verifyRepo } from '../verify/index.js';
import { generateRepositoryHealth } from '../doctor/index.js';
import { captureMemoryEventSafe } from '../memory/index.js';

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

type ArtifactEnvelope = {
  artifact?: string;
  version?: number;
  generated_at?: string;
  checksum?: string;
  data?: unknown;
};

const buildArtifactHygieneTasks = (repoRoot: string): PlanTask[] => {
  const hygiene = generateRepositoryHealth(repoRoot).artifactHygiene;
  return hygiene.suggestions.map((suggestion) => ({
    id: `task-artifact-${suggestion.id.toLowerCase()}`,
    ruleId: suggestion.id,
    file: suggestion.id === 'PB013' ? '.gitignore' : suggestion.id === 'PB012' ? '.playbookignore' : null,
    action: suggestion.title,
    autoFix: true
  }));
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
  const plan = planner.generate(findings.failures);

  captureMemoryEventSafe(repoRoot, {
    kind: 'plan_run',
    sources: [
      { type: 'command', reference: 'plan' },
      { type: 'artifact', reference: '.playbook/plan.json' }
    ],
    subjectModules: [],
    ruleIds: findings.failures.map((failure) => failure.id),
    riskSummary: {
      level: findings.failures.length > 0 ? 'high' : 'low',
      signals: findings.failures.map((failure) => failure.id)
    },
    outcome: {
      status: 'success',
      summary: 'execution plan generated',
      metrics: {
        failureCount: findings.failures.length,
        taskCount: plan.tasks.length
      }
    },
    salienceInputs: {
      command: 'plan',
      taskCount: plan.tasks.length
    }
  });

  return plan;
};

export const generatePlanContract = (repoRoot: string): PlanContract => {
  const verify = verifyRepo(repoRoot);
  const planner = new PlanGenerator();
  const plan = planner.generate(verify.failures);
  const tasks = [...plan.tasks, ...buildArtifactHygieneTasks(repoRoot)];

  captureMemoryEventSafe(repoRoot, {
    kind: 'plan_run',
    sources: [
      { type: 'command', reference: 'plan' },
      { type: 'artifact', reference: '.playbook/plan.json' }
    ],
    subjectModules: [],
    ruleIds: verify.failures.map((failure) => failure.id),
    riskSummary: {
      level: verify.failures.length > 0 ? 'high' : verify.warnings.length > 0 ? 'medium' : 'low',
      signals: verify.failures.map((failure) => failure.id)
    },
    outcome: {
      status: 'success',
      summary: 'plan contract generated',
      metrics: {
        failureCount: verify.failures.length,
        taskCount: tasks.length
      }
    },
    salienceInputs: {
      command: 'plan',
      verifyOk: verify.ok,
      taskCount: tasks.length
    }
  });

  return {
    verify: {
      ok: verify.ok,
      summary: verify.summary,
      failures: verify.failures,
      warnings: verify.warnings
    },
    tasks
  };
};

export const applyExecutionPlan = async (
  repoRoot: string,
  tasks: PlanTask[],
  options: { dryRun: boolean; handlers?: Record<string, FixHandler | undefined> }
) => {
  const resolver = new HandlerResolver({ builtIn: defaultFixHandlers, plugin: options.handlers });
  const executor = new FixExecutor(resolver);
  const result = await executor.apply(tasks, { repoRoot, dryRun: options.dryRun });

  captureMemoryEventSafe(repoRoot, {
    kind: 'apply_run',
    sources: [
      { type: 'command', reference: 'apply' },
      { type: 'artifact', reference: '.playbook/plan.json' }
    ],
    subjectModules: [],
    ruleIds: tasks.map((task) => task.ruleId),
    riskSummary: {
      level: result.summary.failed > 0 ? 'high' : result.summary.skipped > 0 ? 'medium' : 'low',
      signals: tasks.map((task) => task.ruleId)
    },
    outcome: {
      status: result.summary.failed > 0 ? 'partial' : 'success',
      summary: 'execution plan applied',
      metrics: {
        applied: result.summary.applied,
        skipped: result.summary.skipped,
        failed: result.summary.failed,
        unsupported: result.summary.unsupported
      }
    },
    salienceInputs: {
      command: 'apply',
      dryRun: options.dryRun,
      taskCount: tasks.length
    }
  });

  return result;
};

export const selectPlanTasks = (tasks: PlanTask[], selectedTaskIds: string[] | undefined): PlanTask[] => {
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

  const selectedIdSet = new Set(uniqueIds);
  const selectedTasks = tasks.filter((task) => selectedIdSet.has(task.id));
  if (selectedTasks.length === 0) {
    throw new Error('No matching tasks were selected from the plan artifact.');
  }

  return selectedTasks;
};

export const parsePlanArtifact = (payload: unknown): { tasks: PlanTask[] } => {
  const normalizedPayload =
    payload && typeof payload === 'object' && !Array.isArray(payload) && 'data' in payload
      ? (payload as ArtifactEnvelope).data
      : payload;

  if (!normalizedPayload || typeof normalizedPayload !== 'object') {
    throw new Error('Invalid plan payload: expected an object envelope.');
  }

  const envelope = normalizedPayload as SerializedPlanEnvelope;

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
export { FixExecutor, HandlerResolver } from './fixExecutor.js';
export { defaultFixHandlers } from './defaultFixHandlers.js';
export type { PlanTask, RuleFailure, Rule, FixHandler } from './types.js';
