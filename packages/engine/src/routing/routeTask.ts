import fs from 'node:fs';
import path from 'node:path';
import type { RouteDecision, RouteTaskInput, RouteTaskKind } from './types.js';
import { applyRoutingRules } from './routingRules.js';

const classifyTaskKind = (task: string): RouteTaskKind => {
  const normalized = task.toLowerCase();

  if (/\b(read|show|print|summarize|summary|describe)\b/.test(normalized) && /\b(repo|repository|state|artifact|index|graph|context)\b/.test(normalized)) {
    return 'artifact_read';
  }

  if (/\b(graph|query|report|dependency|dependencies|index)\b/.test(normalized)) {
    return 'graph_query_report';
  }

  if (/\b(apply|execute|run|patch|implement)\b/.test(normalized) && /\b(plan|approved|remediation|fix)\b/.test(normalized)) {
    return 'patch_execution';
  }

  if (/\b(propose|suggest|recommend|fix)\b/.test(normalized) && /\b(plan|tests?|failure|failing|issue|problem|remediation)\b/.test(normalized)) {
    return 'remediation_proposal';
  }

  return normalized.trim().length < 8 ? 'ambiguous' : 'unknown';
};

const getAvailableArtifacts = (cwd: string): string[] => {
  const artifacts = ['.playbook/repo-index.json', '.playbook/repo-graph.json', '.playbook/findings.json', '.playbook/plan.json'];
  return artifacts.filter((artifact) => fs.existsSync(path.join(cwd, artifact)));
};

const inferConfidence = (taskKind: RouteTaskKind): number => {
  if (taskKind === 'artifact_read' || taskKind === 'graph_query_report') {
    return 0.95;
  }

  if (taskKind === 'remediation_proposal' || taskKind === 'patch_execution') {
    return 0.8;
  }

  if (taskKind === 'ambiguous') {
    return 0.35;
  }

  return 0.45;
};

export const routeTask = (cwd: string, task: string, overrides: Partial<RouteTaskInput> = {}): RouteDecision => {
  const taskKind = overrides.taskKind ?? classifyTaskKind(task);
  const availableArtifacts = overrides.availableArtifacts ?? getAvailableArtifacts(cwd);

  const input: RouteTaskInput = {
    task,
    taskKind,
    availableArtifacts,
    confidence: overrides.confidence ?? inferConfidence(taskKind),
    requiredRepoContext: overrides.requiredRepoContext ?? true,
    safetyConstraints: overrides.safetyConstraints ?? {
      allowRepositoryMutation: taskKind === 'patch_execution',
      requiresApprovedPlan: taskKind === 'patch_execution'
    },
    mutabilityLevel:
      overrides.mutabilityLevel ??
      (taskKind === 'patch_execution' ? 'approved_plan_patch' : taskKind === 'remediation_proposal' ? 'proposal_only' : 'read_only'),
    hasApprovedPlan: overrides.hasApprovedPlan ?? /\bapproved\b/.test(task.toLowerCase())
  };

  return applyRoutingRules(input);
};
