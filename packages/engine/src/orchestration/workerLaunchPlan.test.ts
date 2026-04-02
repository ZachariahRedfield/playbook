import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { writeChangeScopeArtifact } from '../changeScope.js';
import { assignWorkersToLanes } from './workerAssignments.js';
import { buildWorkerLaunchPlan } from './workerLaunchPlan.js';
import { deriveLaneState } from './laneState.js';
import type { WorksetPlanArtifact } from './worksetPlan.js';

const createRepo = (name: string): string => fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));

const basePlan = (): WorksetPlanArtifact => ({
  schemaVersion: '1.0',
  kind: 'workset-plan',
  generatedAt: '1970-01-01T00:00:00.000Z',
  proposalOnly: true,
  input_tasks: [],
  routed_tasks: [],
  lanes: [
    {
      lane_id: 'lane-1',
      task_ids: ['task-1'],
      task_families: ['cli_command'],
      expected_surfaces: ['packages/cli/src/commands/workers.ts'],
      likely_conflict_surfaces: [],
      readiness_status: 'ready',
      blocking_reasons: [],
      conflict_surface_paths: [],
      shared_artifact_risk: 'low',
      assignment_confidence: 0.95,
      dependency_level: 'low',
      recommended_pr_size: 'small',
      worker_ready: true,
      codex_prompt: 'lane prompt',
      protected_doc_consolidation: {
        has_protected_doc_work: false,
        stage: 'not_applicable',
        summary: 'no protected-doc work',
        next_command: null
      }
    }
  ],
  blocked_tasks: [],
  dependency_edges: [],
  validation: {
    overlapping_file_domains: [],
    conflicting_artifact_ownership: [],
    blocked_lane_dependencies: []
  },
  merge_risk_notes: [],
  sourceArtifacts: {
    tasksFile: { available: true, artifactPath: './fixtures/tasks.json' },
    taskExecutionProfile: { available: false, artifactPath: '.playbook/task-execution-profile.json' },
    learningState: { available: false, artifactPath: '.playbook/learning-state.json' }
  },
  warnings: []
});

describe('buildWorkerLaunchPlan', () => {
  it('marks launchEligible true when lane has no blockers', () => {
    const repo = createRepo('launch-plan-ready');
    const worksetPlan = basePlan();
    const laneState = deriveLaneState(worksetPlan, '.playbook/workset-plan.json');
    const assignments = assignWorkersToLanes(laneState, worksetPlan);

    const plan = buildWorkerLaunchPlan(repo, { worksetPlan, laneState, workerAssignments: assignments });
    expect(plan.lanes).toHaveLength(1);
    expect(plan.lanes[0]?.launchEligible).toBe(true);
    expect(plan.summary.launchEligibleLanes).toEqual(['lane-1']);
  });

  it('fails closed for unresolved protected-doc consolidation state', () => {
    const repo = createRepo('launch-plan-protected-blocked');
    const worksetPlan = basePlan();
    worksetPlan.lanes[0] = {
      ...worksetPlan.lanes[0]!,
      expected_surfaces: ['docs/commands/workers.md'],
      protected_doc_consolidation: {
        has_protected_doc_work: true,
        stage: 'pending',
        summary: 'pending protected-doc consolidation',
        next_command: 'pnpm playbook docs consolidate --json'
      }
    };

    const laneState = deriveLaneState(worksetPlan, '.playbook/workset-plan.json');
    const assignments = assignWorkersToLanes(laneState, worksetPlan);
    const plan = buildWorkerLaunchPlan(repo, { worksetPlan, laneState, workerAssignments: assignments });

    expect(plan.lanes[0]?.launchEligible).toBe(false);
    expect(plan.lanes[0]?.blockers.some((entry) => entry.startsWith('protected-doc:pending'))).toBe(true);
  });

  it('fails closed for missing required capability', () => {
    const repo = createRepo('launch-plan-capability');
    const worksetPlan = basePlan();
    worksetPlan.lanes[0] = {
      ...worksetPlan.lanes[0]!,
      worker_ready: false,
      readiness_status: 'blocked',
      blocking_reasons: ['worker prerequisites are not satisfied']
    };

    const laneState = deriveLaneState(worksetPlan, '.playbook/workset-plan.json');
    const assignments = assignWorkersToLanes(laneState, worksetPlan);
    const plan = buildWorkerLaunchPlan(repo, { worksetPlan, laneState, workerAssignments: assignments });

    expect(plan.lanes[0]?.launchEligible).toBe(false);
    expect(plan.lanes[0]?.blockers).toContain('capability:missing-required-worker-capability');
  });

  it('is deterministic for same input artifacts', () => {
    const repo = createRepo('launch-plan-deterministic');
    const worksetPlan = basePlan();
    const laneState = deriveLaneState(worksetPlan, '.playbook/workset-plan.json');
    const assignments = assignWorkersToLanes(laneState, worksetPlan);

    fs.mkdirSync(path.join(repo, '.playbook'), { recursive: true });
    fs.writeFileSync(
      path.join(repo, '.playbook/policy-evaluation.json'),
      JSON.stringify({ schemaVersion: '1.0', kind: 'policy-evaluation', summary: { blocked: 0 }, evaluations: [] }),
      'utf8'
    );

    const first = buildWorkerLaunchPlan(repo, { worksetPlan, laneState, workerAssignments: assignments });
    const second = buildWorkerLaunchPlan(repo, { worksetPlan, laneState, workerAssignments: assignments });
    expect(second).toStrictEqual(first);
  });

  it('threads declared change-scope surfaces into per-lane launch authorization', () => {
    const repo = createRepo('launch-plan-scope');
    const worksetPlan = basePlan();
    const laneState = deriveLaneState(worksetPlan, '.playbook/workset-plan.json');
    const assignments = assignWorkersToLanes(laneState, worksetPlan);
    writeChangeScopeArtifact(repo, {
      scopeId: 'scope-test',
      source: { command: 'plan', artifactPath: '.playbook/plan.json' },
      mutationScope: {
        allowedFiles: ['packages/cli/src/commands/workers.ts'],
        patchSizeBudget: { maxFiles: 1, maxHunks: 2, maxAddedLines: 10, maxRemovedLines: 10 },
        boundaryChecks: ['no-mutation-authority-escalation', 'writes-must-stay-inside-allowedFiles']
      },
      expectedTests: [],
      docsSurfaces: [],
      rulesTouched: [],
      riskLevel: 'low',
      rationale: 'test fixture',
      provenanceRefs: ['.playbook/plan.json']
    });

    const plan = buildWorkerLaunchPlan(repo, { worksetPlan, laneState, workerAssignments: assignments });
    expect(plan.lanes[0]?.launchEligible).toBe(true);
    expect(plan.lanes[0]?.declaredChangeScope.scopeId).toBe('scope-test');
    expect(plan.lanes[0]?.declaredChangeScope.allowedWriteSurfaces).toEqual(['packages/cli/src/commands/workers.ts']);
    expect(plan.lanes[0]?.declaredChangeScope.enforced).toBe(true);
  });
});
