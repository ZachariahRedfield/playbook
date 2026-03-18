import { describe, expect, it } from 'vitest';
import { buildFleetAdoptionWorkQueue } from './workQueue.js';
import { buildFleetCodexExecutionPlan } from './executionPlan.js';
import { ingestExecutionResults, mapExecutionResultsToOutcomeInput } from './executionIngestion.js';
import type { FleetAdoptionReadinessSummary } from './fleetReadiness.js';

const makeFleet = (ready = false): FleetAdoptionReadinessSummary => ({
  schemaVersion: '1.0',
  kind: 'fleet-adoption-readiness-summary',
  total_repos: 2,
  by_lifecycle_stage: {
    not_connected: 0,
    playbook_not_detected: 0,
    playbook_detected_index_pending: 0,
    indexed_plan_pending: ready ? 0 : 1,
    planned_apply_pending: ready ? 0 : 1,
    ready: ready ? 2 : 0
  },
  playbook_detected_count: 2,
  fallback_proof_ready_count: 2,
  cross_repo_eligible_count: 2,
  blocker_frequencies: [],
  recommended_actions: [],
  repos_by_priority: ready
    ? [
        { repo_id: 'repo-a', repo_name: 'Repo A', lifecycle_stage: 'ready', priority_stage: 'ready', blocker_codes: [], next_action: null },
        { repo_id: 'repo-b', repo_name: 'Repo B', lifecycle_stage: 'ready', priority_stage: 'ready', blocker_codes: [], next_action: null }
      ]
    : [
        { repo_id: 'repo-a', repo_name: 'Repo A', lifecycle_stage: 'indexed_plan_pending', priority_stage: 'plan_pending', blocker_codes: ['plan_required'], next_action: 'pnpm playbook verify --json && pnpm playbook plan --json' },
        { repo_id: 'repo-b', repo_name: 'Repo B', lifecycle_stage: 'planned_apply_pending', priority_stage: 'apply_pending', blocker_codes: ['apply_required'], next_action: 'pnpm playbook apply --json' }
      ]
});

describe('execution ingestion', () => {
  it('maps explicit execution results into a deterministic canonical outcome input', () => {
    const fleet = makeFleet();
    const queue = buildFleetAdoptionWorkQueue(fleet, { generatedAt: '2026-01-01T00:00:00.000Z' });
    const plan = buildFleetCodexExecutionPlan(queue, { generatedAt: '2026-01-02T00:00:00.000Z' });

    const outcomeInput = mapExecutionResultsToOutcomeInput([
      { repo_id: 'repo-b', prompt_id: plan.codex_prompts.find((entry) => entry.repo_id === 'repo-b')!.prompt_id, status: 'failed', error: 'apply failed' },
      { repo_id: 'repo-a', prompt_id: plan.codex_prompts.find((entry) => entry.repo_id === 'repo-a')!.prompt_id, status: 'success' }
    ], plan, queue, { generatedAt: '2026-01-03T00:00:00.000Z' });

    expect(outcomeInput.prompt_outcomes.map((entry) => entry.repo_id)).toEqual(['repo-a', 'repo-b']);
    expect(outcomeInput.prompt_outcomes[0]).toMatchObject({ status: 'succeeded', verification_passed: true });
    expect(outcomeInput.prompt_outcomes[1]).toMatchObject({ status: 'failed', notes: 'apply failed' });
  });

  it('closes the loop from receipt to updated state to next queue without rereading readiness for outcomes', () => {
    const fleetBefore = makeFleet();
    const queue = buildFleetAdoptionWorkQueue(fleetBefore, { generatedAt: '2026-01-01T00:00:00.000Z' });
    const plan = buildFleetCodexExecutionPlan(queue, { generatedAt: '2026-01-02T00:00:00.000Z' });
    const repoAPrompt = plan.codex_prompts.find((entry) => entry.repo_id === 'repo-a')!;
    const repoBPrompt = plan.codex_prompts.find((entry) => entry.repo_id === 'repo-b')!;

    const ingested = ingestExecutionResults([
      {
        repo_id: 'repo-a',
        prompt_id: repoAPrompt.prompt_id,
        status: 'success',
        observed_transition: { from: 'indexed_plan_pending', to: 'planned_apply_pending' }
      },
      {
        repo_id: 'repo-b',
        prompt_id: repoBPrompt.prompt_id,
        status: 'failed',
        error: 'apply worker failed'
      }
    ], { fleet: makeFleet(true), queue, plan }, { generatedAt: '2026-01-04T00:00:00.000Z' });

    expect(ingested.receipt.repo_results.find((entry) => entry.repo_id === 'repo-a')?.status).toBe('success');
    expect(ingested.receipt.repo_results.find((entry) => entry.repo_id === 'repo-b')?.status).toBe('failed');
    expect(ingested.updated_state.summary.repos_needing_retry).toEqual(['repo-b']);
    expect(ingested.next_queue.work_items.map((entry) => entry.repo_id)).toEqual(['repo-b']);
  });
});
