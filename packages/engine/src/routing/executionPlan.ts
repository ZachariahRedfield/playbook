import type { RouteDecision } from './types.js';
import { resolveDeterministicTaskRoute } from './deterministicRouter.js';

type SourceArtifactState = {
  available: boolean;
  artifactPath: string;
};

export type ExecutionPlanSourceArtifacts = {
  taskExecutionProfile: SourceArtifactState;
  learningState: SourceArtifactState;
};

export type BuildExecutionPlanInput = {
  task: string;
  decision: RouteDecision;
  generatedAt?: string;
  sourceArtifacts: ExecutionPlanSourceArtifacts;
};

export type ExecutionPlanArtifact = {
  schemaVersion: '1.0';
  kind: 'execution-plan';
  generatedAt: string;
  proposalOnly: true;
  task_family: string;
  route_id: string;
  rule_packs: string[];
  required_validations: string[];
  optional_validations: string[];
  parallel_lanes: string[];
  mutation_allowed: boolean;
  missing_prerequisites: string[];
  sourceArtifacts: ExecutionPlanSourceArtifacts;
  warnings: string[];
};

const sortUnique = (values: readonly string[]): string[] => [...new Set(values)].sort((a, b) => a.localeCompare(b));

export const buildExecutionPlan = (input: BuildExecutionPlanInput): ExecutionPlanArtifact => {
  const resolved = resolveDeterministicTaskRoute(input.task);
  const profile = resolved.profile;
  const warnings: string[] = [...input.decision.warnings];

  if (!input.sourceArtifacts.taskExecutionProfile.available) {
    warnings.push('task-execution-profile artifact unavailable; using deterministic built-in task profile catalog.');
  }
  if (!input.sourceArtifacts.learningState.available) {
    warnings.push('learning-state artifact unavailable; skipping learning-state refinement and using deterministic baseline route defaults.');
  }

  if (!resolved.supported || !profile) {
    return {
      schemaVersion: '1.0',
      kind: 'execution-plan',
      generatedAt: input.generatedAt ?? new Date(0).toISOString(),
      proposalOnly: true,
      task_family: 'unknown',
      route_id: 'unsupported:unknown',
      rule_packs: ['route-missing-prerequisites'],
      required_validations: [],
      optional_validations: ['pnpm playbook route "<task>" --json'],
      parallel_lanes: ['prerequisite-resolution'],
      mutation_allowed: false,
      missing_prerequisites: sortUnique(input.decision.missingPrerequisites),
      sourceArtifacts: input.sourceArtifacts,
      warnings: sortUnique(warnings)
    };
  }

  return {
    schemaVersion: '1.0',
    kind: 'execution-plan',
    generatedAt: input.generatedAt ?? new Date(0).toISOString(),
    proposalOnly: true,
    task_family: resolved.taskFamily,
    route_id: `${input.decision.route}:${resolved.taskFamily}`,
    rule_packs: sortUnique(profile.rule_packs),
    required_validations: sortUnique(profile.required_validations),
    optional_validations: sortUnique(profile.optional_validations),
    parallel_lanes: profile.parallel_safe ? ['parallel-safe-validation'] : ['sequenced-validation'],
    mutation_allowed: false,
    missing_prerequisites: sortUnique(input.decision.missingPrerequisites),
    sourceArtifacts: input.sourceArtifacts,
    warnings: sortUnique(warnings)
  };
};
