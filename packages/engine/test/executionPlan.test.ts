import { describe, expect, it } from 'vitest';
import { buildExecutionPlan } from '../src/routing/executionPlan.js';

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
      mutation_allowed: false
    });
    expect(plan.rule_packs).toEqual(['docs-governance']);
    expect(plan.warnings).toEqual([
      'learning-state artifact unavailable; skipping learning-state refinement and using deterministic baseline route defaults.',
      'task-execution-profile artifact unavailable; using deterministic built-in task profile catalog.'
    ]);
  });
});
