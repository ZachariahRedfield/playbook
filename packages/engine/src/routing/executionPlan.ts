import type { RouteDecision } from './types.js';
import { resolveDeterministicTaskRoute } from './deterministicRouter.js';
import type { LearningStateSnapshotArtifact } from '../telemetry/learningState.js';
import type { StoryPlanningReference } from '../story/stories.js';

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
  learningStateSnapshot?: LearningStateSnapshotArtifact;
  story?: StoryPlanningReference;
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
  learning_state_available: boolean;
  route_confidence: number;
  expected_surfaces: string[];
  likely_conflict_surfaces: string[];
  dependency_level: 'low' | 'medium' | 'high';
  recommended_pr_size: 'small' | 'medium' | 'large';
  worker_ready: boolean;
  open_questions: string[];
  warnings: string[];
  story_reference?: StoryPlanningReference;
};

const sortUnique = (values: readonly string[]): string[] => [...new Set(values)].sort((a, b) => a.localeCompare(b));
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const STRICT_OPTIONAL_VALIDATIONS = ['pnpm playbook verify --ci --json'];
const HIGH_COST_OPTIONAL_VALIDATIONS = ['pnpm -r build', 'pnpm playbook verify --ci --json'];

const round4 = (value: number): number => Number(value.toFixed(4));

const DEPENDENCY_LEVEL_BY_FAMILY: Record<string, 'low' | 'medium' | 'high'> = {
  docs_only: 'low',
  contracts_schema: 'high',
  cli_command: 'medium',
  engine_scoring: 'medium',
  pattern_learning: 'high'
};

const LIKELY_CONFLICT_SURFACES_BY_FAMILY: Record<string, string[]> = {
  docs_only: ['docs/commands/README.md', 'docs/CHANGELOG.md'],
  contracts_schema: ['packages/contracts/src', 'packages/core/src/contracts/schemaRegistry.ts', 'docs/contracts'],
  cli_command: ['packages/cli/src/commands', 'packages/cli/src/lib/commandMetadata.ts', 'docs/commands'],
  engine_scoring: ['packages/engine/src/scoring', 'packages/engine/test'],
  pattern_learning: ['packages/engine/src/learning', 'packages/engine/src/extract', 'packages/engine/test']
};

export const buildExecutionPlan = (input: BuildExecutionPlanInput): ExecutionPlanArtifact => {
  const resolved = resolveDeterministicTaskRoute(input.task);
  const profile = resolved.profile;
  const warnings: string[] = [...input.decision.warnings];
  const openQuestions = new Set<string>();

  const learningStateAvailable = input.sourceArtifacts.learningState.available && Boolean(input.learningStateSnapshot);
  const learningStateConfidence = learningStateAvailable ? input.learningStateSnapshot?.confidenceSummary.overall_confidence ?? 0 : 0;
  const evidenceHighConfidence = learningStateAvailable && learningStateConfidence >= 0.7;

  if (!input.sourceArtifacts.taskExecutionProfile.available) {
    warnings.push('task-execution-profile artifact unavailable; using deterministic built-in task profile catalog.');
  }
  if (!learningStateAvailable) {
    warnings.push('learning-state artifact unavailable; skipping learning-state refinement and using deterministic baseline route defaults.');
    openQuestions.add('No learning-state snapshot loaded; should optional validations stay baseline for this task family?');
  }

  if (learningStateAvailable && !evidenceHighConfidence) {
    warnings.push('learning-state evidence confidence is low; keeping conservative baseline-heavy route refinements only.');
    for (const question of input.learningStateSnapshot?.confidenceSummary.open_questions ?? []) {
      openQuestions.add(question);
    }
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
      learning_state_available: learningStateAvailable,
      route_confidence: round4(clamp01(learningStateConfidence * 0.3 + 0.2)),
      expected_surfaces: [],
      likely_conflict_surfaces: ['.playbook/execution-plan.json'],
      dependency_level: 'high',
      recommended_pr_size: 'small',
      worker_ready: false,
      open_questions: [...openQuestions].sort((a, b) => a.localeCompare(b)),
      warnings: sortUnique(warnings),
      ...(input.story ? { story_reference: input.story } : {})
    };
  }

  const requiredValidations = new Set(profile.required_validations);
  const optionalValidations = new Set(profile.optional_validations);
  let parallelLanes = profile.parallel_safe ? ['parallel-safe-validation'] : ['sequenced-validation'];

  if (learningStateAvailable && input.learningStateSnapshot) {
    const taskFamily = resolved.taskFamily;
    const retryPressure = input.learningStateSnapshot.metrics.retry_pressure[taskFamily] ?? 0;
    const routeEfficiencyScore = input.learningStateSnapshot.metrics.route_efficiency_score[taskFamily] ?? 0;
    const parallelSafetyRealized = input.learningStateSnapshot.metrics.parallel_safety_realized;
    const routerFitScore = input.learningStateSnapshot.metrics.router_fit_score;
    const validationCostPressure = input.learningStateSnapshot.metrics.validation_cost_pressure;

    if (retryPressure >= 1.5) {
      warnings.push(`high retry_pressure observed for ${taskFamily}; increasing validation strictness conservatively.`);
      requiredValidations.add('pnpm -r build');
      for (const validation of STRICT_OPTIONAL_VALIDATIONS) {
        if (!requiredValidations.has(validation)) {
          optionalValidations.add(validation);
        }
      }
    }

    if (parallelSafetyRealized < 0.5) {
      warnings.push('parallel_safety_realized is low; reducing route to sequenced validation lane.');
      parallelLanes = ['sequenced-validation'];
    }

    if (routerFitScore < 0.55) {
      warnings.push('router_fit_score is low; preferring stricter route posture until fit improves.');
      requiredValidations.add('pnpm -r build');
      optionalValidations.add('pnpm playbook verify --ci --json');
      openQuestions.add('Router fit is weak for this task family; should the baseline profile be rebalanced before optimization?');
    }

    if (evidenceHighConfidence && routeEfficiencyScore >= 0.85 && retryPressure <= 0.5 && routerFitScore >= 0.7) {
      for (const candidate of HIGH_COST_OPTIONAL_VALIDATIONS) {
        if (optionalValidations.has(candidate)) {
          optionalValidations.delete(candidate);
          warnings.push(`high route_efficiency_score for ${taskFamily}; reduced optional validation pressure where safe.`);
          break;
        }
      }
    }

    if (validationCostPressure >= 0.75) {
      warnings.push('validation_cost_pressure is high; reconsidering optional validations while preserving all required validations.');
      if (evidenceHighConfidence) {
        for (const candidate of HIGH_COST_OPTIONAL_VALIDATIONS) {
          if (optionalValidations.has(candidate) && !requiredValidations.has(candidate)) {
            optionalValidations.delete(candidate);
          }
        }
      } else {
        openQuestions.add('Validation costs are high but evidence is low-confidence; collect more telemetry before reducing optional validations.');
      }
    }
  }

  const routeConfidence = learningStateAvailable
    ? round4(
        clamp01(
          (input.learningStateSnapshot?.confidenceSummary.overall_confidence ?? 0) * 0.65 +
            (input.learningStateSnapshot?.metrics.router_fit_score ?? 0) * 0.35
        )
      )
    : 0.6;

  return {
    schemaVersion: '1.0',
    kind: 'execution-plan',
    generatedAt: input.generatedAt ?? new Date(0).toISOString(),
    proposalOnly: true,
    task_family: resolved.taskFamily,
    route_id: `${input.decision.route}:${resolved.taskFamily}`,
    rule_packs: sortUnique(profile.rule_packs),
    required_validations: sortUnique([...requiredValidations]),
    optional_validations: sortUnique([...optionalValidations]),
    parallel_lanes: sortUnique(parallelLanes),
    mutation_allowed: false,
    missing_prerequisites: sortUnique(input.decision.missingPrerequisites),
    sourceArtifacts: input.sourceArtifacts,
    learning_state_available: learningStateAvailable,
    route_confidence: routeConfidence,
    expected_surfaces: sortUnique(input.decision.affectedSurfaces),
    likely_conflict_surfaces: sortUnique(LIKELY_CONFLICT_SURFACES_BY_FAMILY[resolved.taskFamily] ?? []),
    dependency_level: DEPENDENCY_LEVEL_BY_FAMILY[resolved.taskFamily] ?? 'high',
    recommended_pr_size: input.decision.estimatedChangeSurface,
    worker_ready: input.decision.route === 'deterministic_local' && input.decision.missingPrerequisites.length === 0,
    open_questions: [...openQuestions].sort((a, b) => a.localeCompare(b)),
    warnings: sortUnique(warnings),
    ...(input.story ? { story_reference: input.story } : {})
  };
};
