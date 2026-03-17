import { describe, expect, it } from 'vitest';
import { buildFleetAdoptionReadinessSummary, type RepoAdoptionReadiness } from '../src/index.js';

const readiness = (overrides: Partial<RepoAdoptionReadiness>): RepoAdoptionReadiness => ({
  schemaVersion: '1.0',
  connection_status: 'connected',
  playbook_detected: true,
  governed_artifacts_present: {
    repo_index: { present: true, valid: true, stale: false, failure_type: null },
    repo_graph: { present: true, valid: true, stale: false, failure_type: null },
    plan: { present: true, valid: true, stale: false, failure_type: null },
    policy_apply_result: { present: true, valid: true, stale: false, failure_type: null }
  },
  lifecycle_stage: 'ready',
  fallback_proof_ready: true,
  cross_repo_eligible: true,
  blockers: [],
  recommended_next_steps: [],
  ...overrides
});

describe('buildFleetAdoptionReadinessSummary', () => {
  it('aggregates mixed stages and counts deterministically', () => {
    const summary = buildFleetAdoptionReadinessSummary([
      {
        repo_id: 'repo-b',
        repo_name: 'repo-b',
        readiness: readiness({
          lifecycle_stage: 'playbook_not_detected',
          playbook_detected: false,
          fallback_proof_ready: false,
          cross_repo_eligible: false,
          blockers: [{ code: 'playbook_not_detected', message: 'x', next_command: 'pnpm playbook init' }],
          recommended_next_steps: ['pnpm playbook init']
        })
      },
      {
        repo_id: 'repo-a',
        repo_name: 'repo-a',
        readiness: readiness({
          lifecycle_stage: 'playbook_detected_index_pending',
          fallback_proof_ready: false,
          cross_repo_eligible: false,
          blockers: [{ code: 'index_required', message: 'x', next_command: 'pnpm playbook index --json' }],
          recommended_next_steps: ['pnpm playbook index --json']
        })
      },
      {
        repo_id: 'repo-c',
        repo_name: 'repo-c',
        readiness: readiness({
          lifecycle_stage: 'ready',
          recommended_next_steps: []
        })
      }
    ]);

    expect(summary.total_repos).toBe(3);
    expect(summary.by_lifecycle_stage).toEqual({
      not_connected: 0,
      playbook_not_detected: 1,
      playbook_detected_index_pending: 1,
      indexed_plan_pending: 0,
      planned_apply_pending: 0,
      ready: 1
    });
    expect(summary.playbook_detected_count).toBe(2);
    expect(summary.fallback_proof_ready_count).toBe(1);
    expect(summary.cross_repo_eligible_count).toBe(1);
  });

  it('keeps blocker/action frequencies and priority ordering stable', () => {
    const summary = buildFleetAdoptionReadinessSummary([
      {
        repo_id: 'z',
        repo_name: 'z',
        readiness: readiness({
          lifecycle_stage: 'planned_apply_pending',
          fallback_proof_ready: true,
          blockers: [{ code: 'apply_required', message: 'x', next_command: 'pnpm playbook apply --json' }],
          recommended_next_steps: ['pnpm playbook apply --json']
        })
      },
      {
        repo_id: 'a',
        repo_name: 'a',
        readiness: readiness({
          lifecycle_stage: 'playbook_not_detected',
          playbook_detected: false,
          fallback_proof_ready: false,
          cross_repo_eligible: false,
          blockers: [{ code: 'playbook_not_detected', message: 'x', next_command: 'pnpm playbook init' }],
          recommended_next_steps: ['pnpm playbook init']
        })
      },
      {
        repo_id: 'b',
        repo_name: 'b',
        readiness: readiness({
          lifecycle_stage: 'indexed_plan_pending',
          fallback_proof_ready: false,
          blockers: [
            { code: 'plan_required', message: 'x', next_command: 'pnpm playbook verify --json && pnpm playbook plan --json' },
            { code: 'fallback_proof_prerequisite_missing', message: 'x', next_command: 'pnpm playbook index --json && pnpm playbook verify --json && pnpm playbook plan --json' }
          ],
          recommended_next_steps: ['pnpm playbook verify --json && pnpm playbook plan --json']
        })
      }
    ]);

    expect(summary.blocker_frequencies.map((entry) => entry.blocker_code)).toEqual([
      'apply_required',
      'fallback_proof_prerequisite_missing',
      'plan_required',
      'playbook_not_detected'
    ]);
    expect(summary.recommended_actions.map((entry) => entry.command)).toEqual([
      'pnpm playbook apply --json',
      'pnpm playbook init',
      'pnpm playbook verify --json && pnpm playbook plan --json'
    ]);
    expect(summary.repos_by_priority.map((entry) => entry.repo_id)).toEqual(['a', 'b', 'z']);
  });
});
