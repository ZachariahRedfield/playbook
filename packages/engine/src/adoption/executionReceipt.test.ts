import { describe, expect, it } from 'vitest';
import { buildFleetAdoptionWorkQueue } from './workQueue.js';
import { buildFleetCodexExecutionPlan } from './executionPlan.js';
import { buildFleetExecutionReceipt, type FleetExecutionOutcomeInput } from './executionReceipt.js';
import type { FleetAdoptionReadinessSummary } from './fleetReadiness.js';

const makeFleet = (overrides?: Partial<FleetAdoptionReadinessSummary>): FleetAdoptionReadinessSummary => ({
  schemaVersion: '1.0',
  kind: 'fleet-adoption-readiness-summary',
  total_repos: 2,
  by_lifecycle_stage: {
    not_connected: 0,
    playbook_not_detected: 0,
    playbook_detected_index_pending: 0,
    indexed_plan_pending: 1,
    planned_apply_pending: 1,
    ready: 0
  },
  playbook_detected_count: 2,
  fallback_proof_ready_count: 1,
  cross_repo_eligible_count: 1,
  blocker_frequencies: [],
  recommended_actions: [],
  repos_by_priority: [
    { repo_id: 'repo-a', repo_name: 'Repo A', lifecycle_stage: 'indexed_plan_pending', priority_stage: 'plan_pending', blocker_codes: ['plan_required'], next_action: 'pnpm playbook verify --json && pnpm playbook plan --json' },
    { repo_id: 'repo-b', repo_name: 'Repo B', lifecycle_stage: 'planned_apply_pending', priority_stage: 'apply_pending', blocker_codes: ['apply_required'], next_action: 'pnpm playbook apply --json' }
  ],
  ...overrides
});

const makeOutcomeInput = (prompt_outcomes: FleetExecutionOutcomeInput['prompt_outcomes']): FleetExecutionOutcomeInput => ({
  schemaVersion: '1.0',
  kind: 'fleet-adoption-execution-outcome-input',
  generated_at: '2026-01-03T00:00:00.000Z',
  session_id: 'session-123',
  prompt_outcomes
});

describe('buildFleetExecutionReceipt', () => {
  it('records a successful prompt outcome when observed lifecycle matches planned transition', () => {
    const queue = buildFleetAdoptionWorkQueue(makeFleet(), { generatedAt: '2026-01-01T00:00:00.000Z' });
    const plan = buildFleetCodexExecutionPlan(queue, { generatedAt: '2026-01-02T00:00:00.000Z' });
    const prompt = plan.codex_prompts.find((entry) => entry.repo_id === 'repo-b');
    const fleetAfter = makeFleet({
      by_lifecycle_stage: { not_connected: 0, playbook_not_detected: 0, playbook_detected_index_pending: 0, indexed_plan_pending: 1, planned_apply_pending: 0, ready: 1 },
      repos_by_priority: [
        { repo_id: 'repo-a', repo_name: 'Repo A', lifecycle_stage: 'indexed_plan_pending', priority_stage: 'plan_pending', blocker_codes: ['plan_required'], next_action: 'pnpm playbook verify --json && pnpm playbook plan --json' },
        { repo_id: 'repo-b', repo_name: 'Repo B', lifecycle_stage: 'ready', priority_stage: 'ready', blocker_codes: [], next_action: 'none' }
      ]
    });

    const receipt = buildFleetExecutionReceipt(plan, queue, fleetAfter, makeOutcomeInput([{ prompt_id: prompt!.prompt_id, repo_id: 'repo-b', lane_id: prompt!.lane_id, status: 'succeeded', verification_passed: true, notes: 'apply completed' }]), { generatedAt: '2026-01-04T00:00:00.000Z' });
    const result = receipt.prompt_results.find((entry) => entry.prompt_id === prompt!.prompt_id);

    expect(result?.status).toBe('success');
    expect(result?.verification_passed).toBe(true);
    expect(receipt.verification_summary.succeeded_count).toBe(1);
  });

  it('records a failed prompt outcome with blockers', () => {
    const queue = buildFleetAdoptionWorkQueue(makeFleet(), { generatedAt: '2026-01-01T00:00:00.000Z' });
    const plan = buildFleetCodexExecutionPlan(queue, { generatedAt: '2026-01-02T00:00:00.000Z' });
    const prompt = plan.codex_prompts.find((entry) => entry.repo_id === 'repo-a');

    const receipt = buildFleetExecutionReceipt(plan, queue, makeFleet(), makeOutcomeInput([{ prompt_id: prompt!.prompt_id, repo_id: 'repo-a', lane_id: prompt!.lane_id, status: 'failed', verification_passed: false, notes: 'verify failed', blockers: [{ blocker_code: 'verify_failed', message: 'verify remained red', evidence: '.playbook/verify.json' }] }]));

    expect(receipt.prompt_results.find((entry) => entry.prompt_id === prompt!.prompt_id)?.status).toBe('failed');
    expect(receipt.blockers).toEqual([expect.objectContaining({ blocker_code: 'verify_failed', repo_id: 'repo-a' })]);
  });

  it('records partial wave completion when only some prompts finish', () => {
    const queue = buildFleetAdoptionWorkQueue(makeFleet(), { generatedAt: '2026-01-01T00:00:00.000Z' });
    const plan = buildFleetCodexExecutionPlan(queue, { generatedAt: '2026-01-02T00:00:00.000Z' });

    const receipt = buildFleetExecutionReceipt(plan, queue, makeFleet(), makeOutcomeInput([{ prompt_id: plan.codex_prompts[0]!.prompt_id, repo_id: plan.codex_prompts[0]!.repo_id, lane_id: plan.codex_prompts[0]!.lane_id, status: 'partial', verification_passed: false, notes: 'partial completion' }]));

    expect(receipt.wave_results[0]?.status).toBe('partial');
    expect(receipt.verification_summary.partial_count).toBe(1);
  });

  it('marks mismatch when declared success does not reach planned lifecycle stage', () => {
    const queue = buildFleetAdoptionWorkQueue(makeFleet(), { generatedAt: '2026-01-01T00:00:00.000Z' });
    const plan = buildFleetCodexExecutionPlan(queue, { generatedAt: '2026-01-02T00:00:00.000Z' });
    const prompt = plan.codex_prompts.find((entry) => entry.repo_id === 'repo-b');

    const receipt = buildFleetExecutionReceipt(plan, queue, makeFleet(), makeOutcomeInput([{ prompt_id: prompt!.prompt_id, repo_id: 'repo-b', lane_id: prompt!.lane_id, status: 'succeeded', verification_passed: true, notes: 'operator reported success but readiness stayed pending' }]));

    expect(receipt.prompt_results.find((entry) => entry.prompt_id === prompt!.prompt_id)?.status).toBe('mismatch');
    expect(receipt.verification_summary.mismatch_count).toBe(1);
  });

  it('keeps stable JSON shape', () => {
    const queue = buildFleetAdoptionWorkQueue(makeFleet(), { generatedAt: '2026-01-01T00:00:00.000Z' });
    const plan = buildFleetCodexExecutionPlan(queue, { generatedAt: '2026-01-02T00:00:00.000Z' });

    const receipt = buildFleetExecutionReceipt(plan, queue, makeFleet(), makeOutcomeInput([]), { generatedAt: '2026-01-04T00:00:00.000Z' });

    expect(receipt).toMatchObject({
      schemaVersion: '1.0',
      kind: 'fleet-adoption-execution-receipt',
      workflow_promotion: null,
      execution_plan_digest: expect.any(String),
      wave_results: expect.any(Array),
      prompt_results: expect.any(Array),
      repo_results: expect.any(Array),
      artifact_deltas: expect.any(Array),
      blockers: expect.any(Array),
      verification_summary: expect.any(Object)
    });
  });

  it('attaches workflow-promotion metadata when provided', () => {
    const queue = buildFleetAdoptionWorkQueue(makeFleet(), { generatedAt: '2026-01-01T00:00:00.000Z' });
    const plan = buildFleetCodexExecutionPlan(queue, { generatedAt: '2026-01-02T00:00:00.000Z' });

    const receipt = buildFleetExecutionReceipt(plan, queue, makeFleet(), makeOutcomeInput([]), {
      generatedAt: '2026-01-04T00:00:00.000Z',
      workflowPromotion: {
        schemaVersion: '1.0',
        kind: 'workflow-promotion',
        workflow_kind: 'status-updated',
        staged_generation: true,
        candidate_artifact_path: '.playbook/staged/workflow-status-updated/execution-updated-state.json',
        staged_artifact_path: '.playbook/staged/workflow-status-updated/execution-updated-state.json',
        committed_target_path: '.playbook/execution-updated-state.json',
        validation_status: 'blocked',
        validation_passed: false,
        promotion_status: 'blocked',
        promoted: false,
        committed_state_preserved: true,
        blocked_reason: 'summary.repos_total must match repos length',
        error_summary: 'summary.repos_total must match repos length',
        generated_at: '2026-01-04T00:00:00.000Z',
        summary: 'Staged updated-state candidate blocked; committed adoption state preserved.'
      }
    });

    expect(receipt.workflow_promotion).toMatchObject({
      workflow_kind: 'status-updated',
      promotion_status: 'blocked',
      committed_state_preserved: true
    });
  });
});
