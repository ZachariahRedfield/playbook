import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { evaluateExecutionMergeGuards, EXECUTION_MERGE_GUARDS_RELATIVE_PATH } from './mergeGuards.js';
import type { OrchestrationExecutionRunState } from './orchestrationRunState.js';
import type { WorkerLaunchPlanArtifact } from '../orchestration/workerLaunchPlan.js';
import { computeLaunchPlanFingerprint } from './orchestrationRunState.js';

const createRepo = (name: string): string => fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));

const writeJson = (repo: string, relativePath: string, value: unknown): void => {
  const absolutePath = path.join(repo, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const launchPlanFixture = (overrides?: Partial<WorkerLaunchPlanArtifact['lanes'][number]>): WorkerLaunchPlanArtifact => {
  const lane = {
    lane_id: 'lane-1',
    worker_id: 'worker-lane-1',
    worker_type: 'general',
    launchEligible: true,
    blockers: [],
    requiredCapabilities: ['worker-type:general'],
    allowedWriteSurfaces: ['packages/engine/src/execution/'],
    scopeBoundaries: {
      scope_id: null,
      allowed_write_surfaces: ['packages/engine/src/execution/'],
      blocked_surfaces: [],
      patch_size_budget: null
    },
    protectedSingletonImpact: { hasProtectedSingletonWork: false, targets: [], consolidationStage: 'not_applicable', unresolved: false },
    requiredReceipts: ['.playbook/workset-plan.json', '.playbook/lane-state.json', '.playbook/worker-assignments.json'],
    releaseReadyPreconditions: ['lane-readiness-and-dependencies-satisfied', 'required-receipts-recorded']
  };

  return {
    schemaVersion: '1.0',
    kind: 'worker-launch-plan',
    proposalOnly: true,
    generatedAt: '1970-01-01T00:00:00.000Z',
    sourceArtifacts: {
      worksetPlanPath: '.playbook/workset-plan.json',
      laneStatePath: '.playbook/lane-state.json',
      workerAssignmentsPath: '.playbook/worker-assignments.json',
      verifyPath: '.playbook/verify-report.json',
      policyEvaluationPath: '.playbook/policy-evaluation.json'
    },
    summary: { launchEligibleLanes: ['lane-1'], blockedLanes: [], failClosedReasons: [] },
    lanes: [{ ...lane, ...(overrides ?? {}) }]
  };
};

const runStateFixture = (launchPlan: WorkerLaunchPlanArtifact, status: OrchestrationExecutionRunState['status'], laneStatus: OrchestrationExecutionRunState['lanes'][string]['status']): OrchestrationExecutionRunState => ({
  schemaVersion: '1.0',
  kind: 'orchestration-execution-run-state',
  run_id: 'pb-exec-test',
  source_launch_plan_fingerprint: computeLaunchPlanFingerprint(launchPlan),
  eligible_lanes: ['lane-1'],
  status,
  lanes: {
    'lane-1': {
      lane_id: 'lane-1',
      status: laneStatus,
      blocker_refs: [],
      allowed_write_surfaces: ['packages/engine/src/execution/'],
      scope_id: null,
      receipt_refs: ['execution-state:pb-exec-test:lane:lane-1:worker:worker-lane-1'],
      worker_id: 'worker-lane-1',
      started_at: '1970-01-01T00:00:00.000Z',
      completed_at: laneStatus === 'completed' ? '1970-01-01T00:00:10.000Z' : null,
      updated_at: '1970-01-01T00:00:10.000Z'
    }
  },
  metadata: {
    runtime: 'execution-supervisor',
    resumed_from_interrupted_run: false,
    reconcile_revision: 1
  },
  created_at: '1970-01-01T00:00:00.000Z',
  updated_at: '1970-01-01T00:00:10.000Z',
  completed_at: laneStatus === 'completed' ? '1970-01-01T00:00:10.000Z' : null
});

describe('execution merge guards', () => {
  it('marks run mergeEligible=true when required receipts and lane completion gates are satisfied', () => {
    const repo = createRepo('execution-merge-guards-pass');
    const launchPlan = launchPlanFixture();
    writeJson(repo, '.playbook/worker-launch-plan.json', launchPlan);
    writeJson(repo, '.playbook/execution-runs/pb-exec-test.json', runStateFixture(launchPlan, 'completed', 'completed'));
    writeJson(repo, '.playbook/workset-plan.json', {});
    writeJson(repo, '.playbook/lane-state.json', {});
    writeJson(repo, '.playbook/worker-assignments.json', {});

    const artifact = evaluateExecutionMergeGuards(repo);
    expect(artifact.runs[0]?.mergeEligible).toBe(true);
    expect(artifact.runs[0]?.blockingReasons).toEqual([]);
  });

  it('fails closed for incomplete lane, unresolved protected docs, missing receipts, and stale/conflicted status', () => {
    const repo = createRepo('execution-merge-guards-fail');
    const launchPlan = launchPlanFixture({
      protectedSingletonImpact: {
        hasProtectedSingletonWork: true,
        targets: ['docs/PLAYBOOK_PRODUCT_ROADMAP.md'],
        consolidationStage: 'pending',
        unresolved: true
      }
    });
    writeJson(repo, '.playbook/worker-launch-plan.json', launchPlan);
    writeJson(repo, '.playbook/execution-runs/pb-exec-test.json', runStateFixture(launchPlan, 'completed', 'running'));

    const artifact = evaluateExecutionMergeGuards(repo);
    const run = artifact.runs[0];
    expect(run?.mergeEligible).toBe(false);
    expect(run?.blockingReasons.some((reason) => reason.includes('required-lane-incomplete'))).toBe(true);
    expect(run?.blockingReasons.some((reason) => reason.includes('protected-doc-unresolved'))).toBe(true);
    expect(run?.blockingReasons.some((reason) => reason.includes('required-receipt-missing'))).toBe(true);
    expect(run?.staleOrConflictedState).toBe(true);
  });

  it('is deterministic for same inputs', () => {
    const repo = createRepo('execution-merge-guards-deterministic');
    const launchPlan = launchPlanFixture();
    writeJson(repo, '.playbook/worker-launch-plan.json', launchPlan);
    writeJson(repo, '.playbook/execution-runs/pb-exec-test.json', runStateFixture(launchPlan, 'completed', 'completed'));
    writeJson(repo, '.playbook/workset-plan.json', {});
    writeJson(repo, '.playbook/lane-state.json', {});
    writeJson(repo, '.playbook/worker-assignments.json', {});

    const first = evaluateExecutionMergeGuards(repo);
    const second = evaluateExecutionMergeGuards(repo);
    expect(second).toEqual(first);
    const saved = JSON.parse(fs.readFileSync(path.join(repo, EXECUTION_MERGE_GUARDS_RELATIVE_PATH), 'utf8'));
    expect(saved).toEqual(first);
  });
});
