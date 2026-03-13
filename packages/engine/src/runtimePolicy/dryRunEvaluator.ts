import fs from 'node:fs';
import path from 'node:path';
import type { CompiledRuntimeTaskInput, PolicyDecisionRecord } from '@zachariahredfield/playbook-core';
import { evaluatePolicyGate, type PolicyActionClass, type PolicyClassification, type PolicyEvaluatorConfig } from '../policy/evaluator.js';

export type DryRunPolicyOutcome = 'allowed' | 'denied' | 'requires_approval';

export type DryRunTaskPolicyDecision = {
  runtimeTaskId: string;
  sourcePlanTaskId: string;
  outcome: DryRunPolicyOutcome;
  decisionCode: string;
  reasons: string[];
  policyDecision: PolicyDecisionRecord;
};

export type DryRunApprovalAggregate = {
  totalTasks: number;
  allowedTaskIds: string[];
  deniedTaskIds: string[];
  approvalRequiredTaskIds: string[];
  outcomes: Record<DryRunPolicyOutcome, number>;
};

export type DryRunPolicyArtifact = {
  runId: string;
  evaluatedAt: number;
  tasks: Array<CompiledRuntimeTaskInput & { policyDecision: DryRunTaskPolicyDecision }>;
  decisions: DryRunTaskPolicyDecision[];
  approvalSummary: DryRunApprovalAggregate;
};

export type DryRunTaskEvaluationContext = {
  commandFamily: string;
  remediationScope?: string;
  approvalState?: 'approved' | 'rejected' | 'pending';
};

export type DryRunPolicyEvaluatorInput = {
  runId: string;
  compiledTasksPath: string;
  policyConfig: PolicyEvaluatorConfig;
  taskContextResolver?: (task: CompiledRuntimeTaskInput) => DryRunTaskEvaluationContext;
  now?: () => number;
};

const runtimeActionClass = (task: CompiledRuntimeTaskInput): PolicyActionClass =>
  task.mutabilityClass === 'read-only' ? 'read-only' : 'mutation';

const inferCommandFamily = (task: CompiledRuntimeTaskInput): string => {
  const action = task.action.trim();
  const commandMatch = action.match(/(?:^|\s)(?:playbook|pnpm\s+playbook)\s+(\S+)/);
  if (commandMatch?.[1]) return commandMatch[1];
  return task.taskKind === 'observe-only' ? 'query' : 'apply';
};

const defaultTaskContextResolver = (task: CompiledRuntimeTaskInput): DryRunTaskEvaluationContext => ({
  commandFamily: inferCommandFamily(task),
  remediationScope: task.ruleId.startsWith('workspace:') ? 'workspace' : undefined
});

const stableTaskSort = (tasks: CompiledRuntimeTaskInput[]): CompiledRuntimeTaskInput[] =>
  [...tasks].sort((left, right) => left.runtimeTaskId.localeCompare(right.runtimeTaskId));

export const loadCompiledRuntimeTasks = (compiledTasksPath: string): CompiledRuntimeTaskInput[] => {
  const absolutePath = path.resolve(compiledTasksPath);
  const fileEntries = fs
    .readdirSync(absolutePath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  return fileEntries.map((fileName) => {
    const parsed = JSON.parse(fs.readFileSync(path.join(absolutePath, fileName), 'utf8')) as CompiledRuntimeTaskInput;
    return parsed;
  });
};

export const evaluateDryRunRuntimePolicy = (input: DryRunPolicyEvaluatorInput): DryRunPolicyArtifact => {
  const now = input.now ?? (() => Date.now());
  const contextResolver = input.taskContextResolver ?? defaultTaskContextResolver;
  const tasks = stableTaskSort(loadCompiledRuntimeTasks(input.compiledTasksPath)).filter((task) => task.runId === input.runId);

  const decisions: DryRunTaskPolicyDecision[] = tasks.map((task) => {
    const taskContext = contextResolver(task);
    const evaluation = evaluatePolicyGate(
      {
        runId: input.runId,
        taskId: task.runtimeTaskId,
        actionClass: runtimeActionClass(task),
        commandFamily: taskContext.commandFamily,
        remediationScope: taskContext.remediationScope,
        targetPath: task.file ?? undefined,
        approval: taskContext.approvalState ? { state: taskContext.approvalState } : undefined,
        decidedAt: now()
      },
      input.policyConfig
    );

    return {
      runtimeTaskId: task.runtimeTaskId,
      sourcePlanTaskId: task.sourcePlanTaskId,
      outcome: evaluation.classification,
      decisionCode: evaluation.code,
      reasons: evaluation.reasons,
      policyDecision: evaluation.record
    };
  });

  const approvalSummary: DryRunApprovalAggregate = {
    totalTasks: decisions.length,
    allowedTaskIds: decisions.filter((decision) => decision.outcome === 'allowed').map((decision) => decision.runtimeTaskId),
    deniedTaskIds: decisions.filter((decision) => decision.outcome === 'denied').map((decision) => decision.runtimeTaskId),
    approvalRequiredTaskIds: decisions
      .filter((decision) => decision.outcome === 'requires_approval')
      .map((decision) => decision.runtimeTaskId),
    outcomes: decisions.reduce<Record<PolicyClassification, number>>(
      (counts, decision) => ({ ...counts, [decision.outcome]: counts[decision.outcome] + 1 }),
      { allowed: 0, denied: 0, requires_approval: 0 }
    )
  };

  const taskById = new Map(tasks.map((task) => [task.runtimeTaskId, task]));
  const enrichedTasks = decisions.map((decision) => ({
    ...taskById.get(decision.runtimeTaskId),
    policyDecision: decision
  })) as Array<CompiledRuntimeTaskInput & { policyDecision: DryRunTaskPolicyDecision }>;

  return {
    runId: input.runId,
    evaluatedAt: now(),
    tasks: enrichedTasks,
    decisions,
    approvalSummary
  };
};
