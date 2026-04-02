import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { deriveLaneState } from './laneState.js';
import { createWorkerResultsArtifact, mergeWorkerResult, validateWorkerResultInput } from './workerResults.js';
import type { WorksetPlanArtifact } from './worksetPlan.js';

const createRepo = (name: string): string => fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));

const worksetPlan = (): WorksetPlanArtifact => ({
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
      task_families: ['docs_only'],
      expected_surfaces: ['docs/commands/workers.md'],
      likely_conflict_surfaces: [],
      readiness_status: 'ready',
      blocking_reasons: [],
      conflict_surface_paths: [],
      shared_artifact_risk: 'low',
      assignment_confidence: 0.91,
      dependency_level: 'low',
      recommended_pr_size: 'small',
      worker_ready: true,
      codex_prompt: 'prompt',
      protected_doc_consolidation: {
        has_protected_doc_work: true,
        stage: 'pending',
        summary: 'pending protected-doc consolidation',
        next_command: 'pnpm playbook docs consolidate --json'
      }
    }
  ],
  blocked_tasks: [],
  dependency_edges: [],
  validation: { overlapping_file_domains: [], conflicting_artifact_ownership: [], blocked_lane_dependencies: [] },
  merge_risk_notes: [],
  sourceArtifacts: {
    tasksFile: { available: true, artifactPath: './fixtures/tasks.json' },
    taskExecutionProfile: { available: false, artifactPath: '.playbook/task-execution-profile.json' },
    learningState: { available: false, artifactPath: '.playbook/learning-state.json' }
  },
  warnings: []
});

describe('worker results', () => {
  it('keeps submitted worker results in deterministic canonical order', () => {
    const base = createWorkerResultsArtifact();
    const mergedB = mergeWorkerResult(base, {
      lane_id: 'lane-2',
      task_ids: ['task-2'],
      worker_type: 'codex-general',
      completion_status: 'completed',
      summary: 'done',
      blockers: [],
      unresolved_items: [],
      fragment_refs: [],
      proof_refs: [{ path: '.playbook/proofs/b.json', kind: 'proof' }],
      artifact_refs: []
    });
    const mergedA = mergeWorkerResult(mergedB.artifact, {
      lane_id: 'lane-1',
      task_ids: ['task-1'],
      worker_type: 'codex-docs',
      completion_status: 'completed',
      summary: 'done',
      blockers: [],
      unresolved_items: [],
      fragment_refs: [{ target_path: 'docs/commands/workers.md', fragment_path: '.playbook/orchestrator/workers/lane-1/worker-fragment.json' }],
      proof_refs: [{ path: '.playbook/proofs/a.json', kind: 'proof' }],
      artifact_refs: []
    });

    expect(mergedA.artifact.results.map((entry) => entry.lane_id)).toEqual(['lane-1', 'lane-2']);
  });

  it('fails clearly for missing lane ids and invalid fragment refs', () => {
    const plan = worksetPlan();
    expect(validateWorkerResultInput(plan, {
      lane_id: 'missing-lane',
      task_ids: ['task-1'],
      worker_type: 'codex-docs',
      completion_status: 'completed',
      summary: 'done',
      blockers: [],
      unresolved_items: [],
      fragment_refs: [],
      proof_refs: [],
      artifact_refs: []
    })).toEqual(['lane_id missing-lane was not found in .playbook/workset-plan.json']);

    const invalidTargetErrors = validateWorkerResultInput(plan, {
      lane_id: 'lane-1',
      task_ids: ['task-1'],
      worker_type: 'codex-docs',
      completion_status: 'completed',
      summary: 'done',
      blockers: [],
      unresolved_items: [],
      fragment_refs: [{ target_path: 'docs/README.md', fragment_path: 'docs/README.md' }],
      proof_refs: [],
      artifact_refs: []
    });
    expect(invalidTargetErrors).toContain('fragment ref target docs/README.md is not a protected singleton doc');

    const invalidPathErrors = validateWorkerResultInput(plan, {
      lane_id: 'lane-1',
      task_ids: ['task-1'],
      worker_type: 'codex-docs',
      completion_status: 'completed',
      summary: 'done',
      blockers: [],
      unresolved_items: [],
      fragment_refs: [{ target_path: 'docs/commands/workers.md', fragment_path: 'docs/README.md' }],
      proof_refs: [],
      artifact_refs: []
    });
    expect(invalidPathErrors.some((entry) => entry.includes('must point to a .playbook artifact'))).toBe(true);
  });

  it('allows worker results to advance lane state while unresolved protected-doc work still blocks merge readiness', () => {
    const repo = createRepo('playbook-worker-results');
    fs.mkdirSync(path.join(repo, '.playbook'), { recursive: true });
    const plan = worksetPlan();
    const merged = mergeWorkerResult(createWorkerResultsArtifact(), {
      lane_id: 'lane-1',
      task_ids: ['task-1'],
      worker_type: 'codex-docs',
      completion_status: 'completed',
      summary: 'worker finished bounded docs changes',
      blockers: [],
      unresolved_items: ['await docs consolidation'],
      fragment_refs: [{ target_path: 'docs/commands/workers.md', fragment_path: '.playbook/orchestrator/workers/lane-1/worker-fragment.json' }],
      proof_refs: [{ path: '.playbook/proofs/lane-1.json', kind: 'proof' }],
      artifact_refs: [{ path: '.playbook/worker-assignments.json', kind: 'artifact' }]
    });

    const laneState = deriveLaneState(plan, '.playbook/workset-plan.json', { workerResults: merged.artifact });
    const lane = laneState.lanes.find((entry) => entry.lane_id === 'lane-1');
    expect(lane?.status).toBe('completed');
    expect(lane?.merge_ready).toBe(false);
    expect(laneState.merge_ready_lanes).toEqual([]);
    expect(laneState.merge_readiness.not_merge_ready_lanes[0]?.reasons).toContain('pending protected-doc consolidation');
  });

  it('rejects out-of-scope worker output paths when change-scope is declared', () => {
    const plan = worksetPlan();
    const errors = validateWorkerResultInput(plan, {
      lane_id: 'lane-1',
      task_ids: ['task-1'],
      worker_type: 'codex-docs',
      completion_status: 'completed',
      summary: 'attempted out-of-scope emission',
      blockers: [],
      unresolved_items: [],
      fragment_refs: [{ target_path: 'docs/commands/workers.md', fragment_path: '.playbook/orchestrator/workers/lane-1/worker-fragment.json' }],
      proof_refs: [{ path: '.playbook/proofs/out-of-scope.json', kind: 'proof' }],
      artifact_refs: []
    }, {
      changeScope: {
        schemaVersion: '1.0',
        kind: 'change-scope',
        generatedAt: '1970-01-01T00:00:00.000Z',
        bundles: [{
          scopeId: 'scope-lane-1',
          source: { command: 'workers launch-plan', artifactPath: '.playbook/worker-launch-plan.json' },
          mutationScope: {
            allowedFiles: ['.playbook/orchestrator/workers/lane-1/'],
            patchSizeBudget: { maxFiles: 1, maxHunks: 2, maxAddedLines: 120, maxRemovedLines: 90 },
            boundaryChecks: ['writes-must-stay-inside-allowedFiles']
          },
          expectedTests: [],
          docsSurfaces: [],
          rulesTouched: [],
          riskLevel: 'low',
          rationale: 'test',
          provenanceRefs: []
        }]
      }
    });

    expect(errors).toContain('worker output path .playbook/proofs/out-of-scope.json is outside allowed change scope for lane lane-1');
  });
});
