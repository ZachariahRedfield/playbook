import { describe, expect, it } from 'vitest';
import { buildExecutionPlan } from '../src/routing/executionPlan.js';
import type { LearningStateSnapshotArtifact } from '../src/telemetry/learningState.js';

const makeLearningState = (overrides: Partial<LearningStateSnapshotArtifact>): LearningStateSnapshotArtifact => ({
  schemaVersion: '1.0',
  kind: 'learning-state-snapshot',
  generatedAt: '2026-01-01T00:00:00.000Z',
  proposalOnly: true,
  sourceArtifacts: {
    outcomeTelemetry: { available: true, recordCount: 5, artifactPath: '.playbook/outcome-telemetry.json' },
    processTelemetry: { available: true, recordCount: 5, artifactPath: '.playbook/process-telemetry.json' },
    taskExecutionProfile: { available: true, recordCount: 5, artifactPath: '.playbook/task-execution-profile.json' }
  },
  metrics: {
    sample_size: 5,
    first_pass_yield: 0.8,
    retry_pressure: { docs_only: 0.2, contracts_schema: 0.2, engine_scoring: 0.2 },
    validation_load_ratio: 1,
    route_efficiency_score: { docs_only: 0.9, contracts_schema: 0.5, engine_scoring: 0.5 },
    smallest_sufficient_route_score: 0.7,
    parallel_safety_realized: 0.9,
    router_fit_score: 0.8,
    reasoning_scope_efficiency: 0.8,
    validation_cost_pressure: 0.3,
    pattern_family_effectiveness_score: { docs_only: 0.8 },
    portability_confidence: 0.8
  },
  confidenceSummary: {
    sample_size_score: 0.8,
    coverage_score: 0.8,
    evidence_completeness_score: 0.8,
    overall_confidence: 0.85,
    open_questions: []
  },
  ...overrides
});

describe('buildExecutionPlan', () => {
  it('builds deterministic proposal-only execution plan and degrades when artifacts are missing', () => {
    const plan = buildExecutionPlan({
      task: 'update command docs',
      decision: {
        route: 'deterministic_local',
        why: 'Task family classification matched a deterministic task-execution-profile.',
        requiredInputs: ['task input'],
        missingPrerequisites: [],
        repoMutationAllowed: false,
        taskFamily: 'docs_only',
        affectedSurfaces: ['docs', 'governance'],
        estimatedChangeSurface: 'small',
        warnings: []
      },
      generatedAt: '2026-01-01T00:00:00.000Z',
      sourceArtifacts: {
        taskExecutionProfile: { available: false, artifactPath: '.playbook/task-execution-profile.json' },
        learningState: { available: false, artifactPath: '.playbook/learning-state.json' }
      }
    });

    expect(plan).toMatchObject({
      schemaVersion: '1.0',
      kind: 'execution-plan',
      proposalOnly: true,
      task_family: 'docs_only',
      route_id: 'deterministic_local:docs_only',
      mutation_allowed: false,
      learning_state_available: false,
      dependency_level: 'low',
      recommended_pr_size: 'small',
      worker_ready: true
    });
    expect(plan.expected_surfaces).toEqual(['docs', 'governance']);
    expect(plan.likely_conflict_surfaces).toEqual(['docs/CHANGELOG.md', 'docs/commands/README.md']);
    expect(plan.warnings).toEqual([
      'learning-state artifact unavailable; skipping learning-state refinement and using deterministic baseline route defaults.',
      'task-execution-profile artifact unavailable; using deterministic built-in task profile catalog.'
    ]);
  });

  it('reduces optional validation for strong docs_only efficiency evidence', () => {
    const learning = makeLearningState({});
    const plan = buildExecutionPlan({
      task: 'update command docs',
      decision: {
        route: 'deterministic_local',
        why: 'Task family classification matched a deterministic task-execution-profile.',
        requiredInputs: ['task input'],
        missingPrerequisites: [],
        repoMutationAllowed: false,
        taskFamily: 'docs_only',
        affectedSurfaces: ['docs', 'governance'],
        estimatedChangeSurface: 'small',
        warnings: []
      },
      sourceArtifacts: {
        taskExecutionProfile: { available: true, artifactPath: '.playbook/task-execution-profile.json' },
        learningState: { available: true, artifactPath: '.playbook/learning-state.json' }
      },
      learningStateSnapshot: learning
    });

    expect(plan.optional_validations).toEqual([]);
    expect(plan.required_validations).toContain('pnpm playbook docs audit --json');
    expect(plan.warnings).toContain('high route_efficiency_score for docs_only; reduced optional validation pressure where safe.');
  });

  it('increases strictness for weak contracts_schema retry pressure', () => {
    const learning = makeLearningState({
      metrics: {
        ...makeLearningState({}).metrics,
        retry_pressure: { contracts_schema: 2.2 },
        route_efficiency_score: { contracts_schema: 0.2 },
        parallel_safety_realized: 0.3,
        router_fit_score: 0.5
      }
    });

    const plan = buildExecutionPlan({
      task: 'update contracts schema registry',
      decision: {
        route: 'deterministic_local',
        why: 'Task family classification matched a deterministic task-execution-profile.',
        requiredInputs: ['task input'],
        missingPrerequisites: [],
        repoMutationAllowed: false,
        taskFamily: 'contracts_schema',
        affectedSurfaces: ['contracts', 'schemas', 'governance'],
        estimatedChangeSurface: 'medium',
        warnings: []
      },
      sourceArtifacts: {
        taskExecutionProfile: { available: true, artifactPath: '.playbook/task-execution-profile.json' },
        learningState: { available: true, artifactPath: '.playbook/learning-state.json' }
      },
      learningStateSnapshot: learning
    });

    expect(plan.optional_validations).toContain('pnpm playbook verify --ci --json');
    expect(plan.parallel_lanes).toEqual(['sequenced-validation']);
    expect(plan.warnings).toContain('high retry_pressure observed for contracts_schema; increasing validation strictness conservatively.');
    expect(plan.warnings).toContain('router_fit_score is low; preferring stricter route posture until fit improves.');
  });

  it('keeps required safety with high validation cost pressure for engine_scoring', () => {
    const learning = makeLearningState({
      metrics: {
        ...makeLearningState({}).metrics,
        validation_cost_pressure: 0.9,
        route_efficiency_score: { engine_scoring: 0.75 },
        retry_pressure: { engine_scoring: 0.4 }
      }
    });

    const plan = buildExecutionPlan({
      task: 'adjust scoring fitness thresholds',
      decision: {
        route: 'deterministic_local',
        why: 'Task family classification matched a deterministic task-execution-profile.',
        requiredInputs: ['task input'],
        missingPrerequisites: [],
        repoMutationAllowed: false,
        taskFamily: 'engine_scoring',
        affectedSurfaces: ['engine', 'governance', 'tests'],
        estimatedChangeSurface: 'medium',
        warnings: []
      },
      sourceArtifacts: {
        taskExecutionProfile: { available: true, artifactPath: '.playbook/task-execution-profile.json' },
        learningState: { available: true, artifactPath: '.playbook/learning-state.json' }
      },
      learningStateSnapshot: learning
    });

    expect(plan.required_validations).toContain('pnpm --filter @zachariahredfield/playbook-engine test');
    expect(plan.required_validations).toContain('pnpm -r build');
    expect(plan.warnings).toContain(
      'validation_cost_pressure is high; reconsidering optional validations while preserving all required validations.'
    );
  });

  it('emits warnings and open questions for low-confidence telemetry', () => {
    const learning = makeLearningState({
      confidenceSummary: {
        sample_size_score: 0.2,
        coverage_score: 0.2,
        evidence_completeness_score: 0.2,
        overall_confidence: 0.3,
        open_questions: ['Low sample size: expand telemetry window before promoting routing proposals.']
      },
      metrics: {
        ...makeLearningState({}).metrics,
        validation_cost_pressure: 0.85
      }
    });

    const plan = buildExecutionPlan({
      task: 'update command docs',
      decision: {
        route: 'deterministic_local',
        why: 'Task family classification matched a deterministic task-execution-profile.',
        requiredInputs: ['task input'],
        missingPrerequisites: [],
        repoMutationAllowed: false,
        taskFamily: 'docs_only',
        affectedSurfaces: ['docs', 'governance'],
        estimatedChangeSurface: 'small',
        warnings: []
      },
      sourceArtifacts: {
        taskExecutionProfile: { available: true, artifactPath: '.playbook/task-execution-profile.json' },
        learningState: { available: true, artifactPath: '.playbook/learning-state.json' }
      },
      learningStateSnapshot: learning
    });

    expect(plan.warnings).toContain(
      'learning-state evidence confidence is low; keeping conservative baseline-heavy route refinements only.'
    );
    expect(plan.open_questions).toContain('Low sample size: expand telemetry window before promoting routing proposals.');
    expect(plan.open_questions).toContain(
      'Validation costs are high but evidence is low-confidence; collect more telemetry before reducing optional validations.'
    );
  });
});
