import type { RouteDecision, RouteTaskInput } from './types.js';

const buildBaseDecision = (input: RouteTaskInput): Omit<RouteDecision, 'route' | 'why'> => ({
  requiredInputs: [
    'task kind',
    'available artifacts',
    'confidence',
    input.requiredRepoContext ? 'repository context' : 'repository context (optional)',
    'safety constraints',
    'mutability level'
  ],
  missingPrerequisites: [],
  repoMutationAllowed: input.safetyConstraints.allowRepositoryMutation
});

export const applyRoutingRules = (input: RouteTaskInput): RouteDecision => {
  const base = buildBaseDecision(input);

  if (input.taskKind === 'artifact_read') {
    return {
      ...base,
      route: 'deterministic_local',
      why: 'Artifact read tasks are fully deterministic and should be executed locally.'
    };
  }

  if (input.taskKind === 'graph_query_report') {
    return {
      ...base,
      route: 'deterministic_local',
      why: 'Graph/query/report generation is deterministic and should stay in local execution.'
    };
  }

  if (input.taskKind === 'remediation_proposal') {
    return {
      ...base,
      route: 'model_reasoning',
      why: 'Remediation proposal synthesis benefits from bounded model reasoning over deterministic evidence.'
    };
  }

  if (input.taskKind === 'patch_execution') {
    if (input.safetyConstraints.requiresApprovedPlan && !input.hasApprovedPlan) {
      return {
        ...base,
        route: 'unsupported',
        why: 'Patch execution requires an approved remediation plan before mutation is allowed.',
        missingPrerequisites: ['approved remediation plan']
      };
    }

    return {
      ...base,
      route: 'hybrid',
      why: 'Patch execution should use model reasoning for bounded decisions and deterministic local execution for mutation.'
    };
  }

  if (input.confidence < 0.5 || input.taskKind === 'ambiguous' || (input.requiredRepoContext && input.availableArtifacts.length === 0)) {
    return {
      ...base,
      route: input.availableArtifacts.length === 0 ? 'unsupported' : 'model_reasoning',
      why:
        input.availableArtifacts.length === 0
          ? 'Request is ambiguous and missing deterministic evidence artifacts required for safe routing.'
          : 'Request is ambiguous; bounded model reasoning is allowed with the currently available artifacts.',
      missingPrerequisites:
        input.availableArtifacts.length === 0 ? ['deterministic repository artifacts (.playbook/repo-index.json or .playbook/repo-graph.json)'] : []
    };
  }

  return {
    ...base,
    route: 'unsupported',
    why: 'Task does not match a supported deterministic routing heuristic.',
    missingPrerequisites: ['explicit task intent and supporting artifacts']
  };
};
