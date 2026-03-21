import { describe, expect, it } from 'vitest';
import type { WorksetPlanArtifact } from '../src/orchestration/worksetPlan.js';
import { applyLaneLifecycleTransition, deriveLaneState } from '../src/orchestration/laneState.js';

const lane = (lane_id: string, dependency_level: 'low' | 'medium' | 'high') => ({
  lane_id,
  task_ids: [`task-${lane_id}`],
  task_families: ['docs_only'],
  expected_surfaces: [`docs/${lane_id}.md`],
  likely_conflict_surfaces: [],
  readiness_status: 'ready' as const,
  blocking_reasons: [],
  conflict_surface_paths: [],
  shared_artifact_risk: 'low' as const,
  assignment_confidence: 0.94,
  dependency_level,
  recommended_pr_size: 'small' as const,
  worker_ready: true,
  codex_prompt: `Prompt for ${lane_id}`,
  protected_doc_consolidation: {
    has_protected_doc_work: false,
    stage: 'not_applicable' as const,
    summary: 'no protected-doc work',
    next_command: null
  }
});

const baseWorkset = (overrides?: Partial<WorksetPlanArtifact>): WorksetPlanArtifact => ({
  schemaVersion: '1.0',
  kind: 'workset-plan',
  generatedAt: '1970-01-01T00:00:00.000Z',
  proposalOnly: true,
  input_tasks: [],
  routed_tasks: [],
  lanes: [lane('lane-1', 'low')],
  blocked_tasks: [],
  dependency_edges: [],
  merge_risk_notes: [],
  sourceArtifacts: {
    tasksFile: { available: true, artifactPath: './fixtures/tasks.json' },
    taskExecutionProfile: { available: false, artifactPath: '.playbook/task-execution-profile.json' },
    learningState: { available: false, artifactPath: '.playbook/learning-state.json' }
  },
  warnings: [],
  ...overrides
});

describe('deriveLaneState lifecycle transitions', () => {
  it('transitions a ready lane to running', () => {
    const worksetPlan = baseWorkset();
    const initial = deriveLaneState(worksetPlan, '.playbook/workset-plan.json');

    const result = applyLaneLifecycleTransition(worksetPlan, '.playbook/workset-plan.json', initial, {
      action: 'start',
      lane_id: 'lane-1'
    });

    expect(result.applied).toBe(true);
    expect(result.laneState.running_lanes).toContain('lane-1');
  });

  it('keeps dependency-blocked lane blocked when prerequisites remain unresolved', () => {
    const worksetPlan = baseWorkset({
      lanes: [
        { ...lane('lane-1', 'low'), worker_ready: false },
        lane('lane-2', 'medium')
      ],
      dependency_edges: [{ from_lane_id: 'lane-1', to_lane_id: 'lane-2', reason: 'low before medium' }]
    });

    const laneState = deriveLaneState(worksetPlan, '.playbook/workset-plan.json');
    const gatedLane = laneState.lanes.find((entry) => entry.lane_id === 'lane-2');

    expect(gatedLane?.status).toBe('blocked');
    expect(gatedLane?.blocked_reasons.join(' ')).toContain('waiting on dependency lane lane-1');
  });

  it('marks completed lane as merge_ready only when safe', () => {
    const worksetPlan = baseWorkset();
    const initial = deriveLaneState(worksetPlan, '.playbook/workset-plan.json');

    const started = applyLaneLifecycleTransition(worksetPlan, '.playbook/workset-plan.json', initial, {
      action: 'start',
      lane_id: 'lane-1'
    });
    const completed = applyLaneLifecycleTransition(worksetPlan, '.playbook/workset-plan.json', started.laneState, {
      action: 'complete',
      lane_id: 'lane-1'
    });

    expect(completed.applied).toBe(true);
    expect(completed.laneState.merge_ready_lanes).toContain('lane-1');
    expect(completed.laneState.lanes.find((entry) => entry.lane_id === 'lane-1')?.status).toBe('merge_ready');
  });



  it('keeps protected-doc lanes out of merge_ready until consolidation is applied', () => {
    const worksetPlan = baseWorkset({
      lanes: [
        {
          ...lane('lane-1', 'low'),
          expected_surfaces: ['docs/CHANGELOG.md'],
          protected_doc_consolidation: {
            has_protected_doc_work: true,
            stage: 'pending',
            summary: 'pending protected-doc consolidation',
            next_command: 'pnpm playbook docs consolidate --json'
          }
        }
      ]
    });
    const initial = deriveLaneState(worksetPlan, '.playbook/workset-plan.json');
    const started = applyLaneLifecycleTransition(worksetPlan, '.playbook/workset-plan.json', initial, { action: 'start', lane_id: 'lane-1' });
    const completed = applyLaneLifecycleTransition(worksetPlan, '.playbook/workset-plan.json', started.laneState, { action: 'complete', lane_id: 'lane-1' });

    expect(completed.applied).toBe(true);
    expect(completed.laneState.merge_ready_lanes).not.toContain('lane-1');
    expect(completed.laneState.lanes.find((entry) => entry.lane_id === 'lane-1')?.status).toBe('completed');
  });

  it('supports mixed blocked + running + completed lifecycle states', () => {
    const worksetPlan = baseWorkset({
      lanes: [lane('lane-1', 'low'), lane('lane-2', 'low')],
      blocked_tasks: [
        {
          task_id: 'task-ambiguous',
          reason: 'ambiguous task family requires explicit refinement before lane assignment',
          warnings: [],
          missing_prerequisites: ['clarify scope']
        }
      ]
    });

    const base = deriveLaneState(worksetPlan, '.playbook/workset-plan.json');
    const running = applyLaneLifecycleTransition(worksetPlan, '.playbook/workset-plan.json', base, {
      action: 'start',
      lane_id: 'lane-1'
    });

    const startedSecond = applyLaneLifecycleTransition(worksetPlan, '.playbook/workset-plan.json', running.laneState, {
      action: 'start',
      lane_id: 'lane-2'
    });

    const completedSecond = applyLaneLifecycleTransition(worksetPlan, '.playbook/workset-plan.json', startedSecond.laneState, {
      action: 'complete',
      lane_id: 'lane-2'
    });

    expect(completedSecond.laneState.blocked_lanes.some((laneId) => laneId.startsWith('blocked-'))).toBe(true);
    expect(completedSecond.laneState.running_lanes).toContain('lane-1');
    expect(completedSecond.laneState.completed_lanes.length).toBeGreaterThan(0);
  });
});
