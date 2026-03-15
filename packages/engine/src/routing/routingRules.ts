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
  repoMutationAllowed: false,
  taskFamily: ['docs_only','contracts_schema','cli_command','engine_scoring','pattern_learning'].includes(input.taskKind) ? (input.taskKind as RouteDecision['taskFamily']) : 'unknown',
  affectedSurfaces: [],
  estimatedChangeSurface: 'small',
  warnings: []
});

export const applyRoutingRules = (input: RouteTaskInput): RouteDecision => {
  const base = buildBaseDecision(input);

  if (input.taskKind === 'unknown' || input.taskKind === 'ambiguous') {
    return {
      ...base,
      route: 'unsupported',
      why: 'Task does not match a supported deterministic routing heuristic.',
      missingPrerequisites: ['task must specify one supported family: docs_only, contracts_schema, cli_command, engine_scoring, pattern_learning']
    };
  }

  return {
    ...base,
    route: 'deterministic_local',
    why: 'Task matched a deterministic routing family.'
  };
};
