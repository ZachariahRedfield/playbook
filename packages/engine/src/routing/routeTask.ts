import fs from 'node:fs';
import path from 'node:path';
import type { RouteDecision, RouteTaskInput, RouteTaskKind } from './types.js';
import { resolveDeterministicTaskRoute } from './deterministicRouter.js';

const LEGACY_KIND_TO_FAMILY: Partial<Record<RouteTaskKind, RouteDecision['taskFamily']>> = {
  artifact_read: 'docs_only',
  graph_query_report: 'docs_only',
  remediation_proposal: 'cli_command',
  patch_execution: 'cli_command'
};

const classifyTaskKind = (task: string): RouteTaskKind => {
  const resolved = resolveDeterministicTaskRoute(task);
  return resolved.taskFamily;
};

const getAvailableArtifacts = (cwd: string): string[] => {
  const artifacts = ['.playbook/repo-index.json', '.playbook/repo-graph.json', '.playbook/findings.json', '.playbook/plan.json'];
  return artifacts.filter((artifact) => fs.existsSync(path.join(cwd, artifact)));
};

const inferConfidence = (taskKind: RouteTaskKind): number => {
  if (taskKind === 'unknown') {
    return 0.4;
  }

  return 0.9;
};

export const routeTask = (cwd: string, task: string, overrides: Partial<RouteTaskInput> = {}): RouteDecision => {
  const taskKind = overrides.taskKind ?? classifyTaskKind(task);
  const availableArtifacts = overrides.availableArtifacts ?? getAvailableArtifacts(cwd);
  const resolved = resolveDeterministicTaskRoute(task);

  const input: RouteTaskInput = {
    task,
    taskKind,
    availableArtifacts,
    confidence: overrides.confidence ?? inferConfidence(taskKind),
    requiredRepoContext: overrides.requiredRepoContext ?? true,
    safetyConstraints: overrides.safetyConstraints ?? {
      allowRepositoryMutation: false,
      requiresApprovedPlan: false
    },
    mutabilityLevel: overrides.mutabilityLevel ?? 'proposal_only',
    hasApprovedPlan: overrides.hasApprovedPlan ?? false
  };

  const requiredInputs = [
    'task input',
    'deterministic task-family classification',
    'affected surfaces',
    'estimated change surface',
    'task-execution-profile catalog'
  ];

  const legacyFamily = LEGACY_KIND_TO_FAMILY[input.taskKind];
  if (legacyFamily) {
    return {
      route: 'deterministic_local',
      why: `Legacy task kind ${input.taskKind} maps to deterministic routing for backward compatibility.`,
      requiredInputs,
      missingPrerequisites: [],
      repoMutationAllowed: false,
      taskFamily: legacyFamily,
      affectedSurfaces: [],
      estimatedChangeSurface: 'small',
      warnings: ['legacy task-kind override detected; using conservative deterministic mapping.']
    };
  }

  if (!resolved.supported) {
    return {
      route: 'unsupported',
      why: 'No matching deterministic task-execution-profile could be resolved for this task.',
      requiredInputs,
      missingPrerequisites: resolved.missingPrerequisites,
      repoMutationAllowed: false,
      taskFamily: 'unknown',
      affectedSurfaces: [],
      estimatedChangeSurface: 'small',
      warnings: resolved.warnings
    };
  }

  const why =
    resolved.warnings.length > 0
      ? 'Task family classification was ambiguous; conservative deterministic route selected with warning.'
      : 'Task family classification matched a deterministic task-execution-profile.';

  return {
    route: 'deterministic_local',
    why,
    requiredInputs,
    missingPrerequisites: [],
    repoMutationAllowed: false,
    taskFamily: resolved.taskFamily,
    affectedSurfaces: resolved.affectedSurfaces,
    estimatedChangeSurface: resolved.estimatedChangeSurface,
    warnings: resolved.warnings
  };
};
