import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { generateLifecycleCandidatesArtifact, writeLifecycleCandidatesArtifact } from './lifecycleCandidates.js';

const makeRepo = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-lifecycle-candidates-'));

const seedPatterns = (repoRoot: string): void => {
  fs.mkdirSync(path.join(repoRoot, '.playbook', 'memory', 'knowledge'), { recursive: true });
  fs.writeFileSync(path.join(repoRoot, '.playbook', 'patterns.json'), JSON.stringify({
    schemaVersion: '1.0',
    kind: 'promoted-patterns',
    patterns: [
      { id: 'pattern.runtime.rollback', title: 'Rollback pattern', status: 'active' },
      { id: 'pattern.runtime.drift', title: 'Drift pattern', status: 'active' }
    ]
  }, null, 2));
  fs.writeFileSync(path.join(repoRoot, '.playbook', 'promotion-receipts.json'), JSON.stringify({
    schemaVersion: '1.0',
    kind: 'promotion-receipt-log',
    receipts: [
      {
        receipt_id: 'promotion-receipt:1',
        generated_at: '2026-03-18T00:00:00.000Z',
        workflow_kind: 'promote-pattern-supersede',
        target_id: 'pattern.runtime.drift',
        summary: 'supersede drift pattern with newer evidence',
        outcome: 'promoted'
      }
    ]
  }, null, 2));
  fs.writeFileSync(path.join(repoRoot, '.playbook', 'portability-outcomes.json'), JSON.stringify({
    schemaVersion: '1.0',
    kind: 'portability-outcomes',
    generatedAt: '2026-03-19T00:00:00.000Z',
    outcomes: [
      {
        recommendation_id: 'rec-1',
        pattern_id: 'pattern.runtime.rollback',
        source_repo: 'source/repo',
        target_repo: 'target/repo',
        decision_status: 'accepted',
        adoption_status: 'adopted',
        observed_outcome: 'unsuccessful',
        decision_reason: 'rollback required after deployment',
        timestamp: '2026-03-19T00:00:00.000Z'
      }
    ]
  }, null, 2));
};

describe('lifecycle candidate generation', () => {
  it('deterministically converts evidence into candidate-only lifecycle recommendations with provenance', () => {
    const repoRoot = makeRepo();
    seedPatterns(repoRoot);
    const input = {
      projectRoot: repoRoot,
      outcomeInput: {
        schemaVersion: '1.0' as const,
        kind: 'fleet-adoption-execution-outcome-input' as const,
        generated_at: '2026-03-19T01:00:00.000Z',
        session_id: 'session-1',
        prompt_outcomes: [
          {
            prompt_id: 'wave_1:apply_lane:repo-a',
            repo_id: 'repo-a',
            lane_id: 'apply',
            status: 'failed' as const,
            notes: 'rollback required for pattern.runtime.rollback after regression'
          }
        ]
      },
      receipt: {
        schemaVersion: '1.0' as const,
        kind: 'fleet-adoption-execution-receipt' as const,
        generated_at: '2026-03-19T01:00:00.000Z',
        execution_plan_digest: 'digest',
        session_id: 'session-1',
        wave_results: [],
        prompt_results: [
          {
            prompt_id: 'wave_1:apply_lane:repo-a',
            repo_id: 'repo-a',
            lane_id: 'apply',
            wave_id: 'wave_1',
            intended_transition: { from: 'planned_apply_pending', to: 'ready' },
            observed_transition: { from: 'planned_apply_pending', to: 'planned_apply_pending' },
            status: 'mismatch' as const,
            verification_passed: false,
            notes: 'rollback required for pattern.runtime.rollback after regression',
            evidence: ['pattern.runtime.rollback drifted after deploy']
          }
        ],
        repo_results: [],
        artifact_deltas: [],
        blockers: [],
        verification_summary: {
          prompts_total: 1,
          verification_passed_count: 0,
          succeeded_count: 0,
          failed_count: 0,
          partial_count: 0,
          mismatch_count: 1,
          not_run_count: 0,
          repos_needing_retry: ['repo-a'],
          planned_vs_actual_drift: [
            {
              prompt_id: 'pattern.runtime.drift',
              repo_id: 'repo-a',
              expected: 'ready',
              observed: 'planned_apply_pending'
            }
          ]
        }
      },
      updatedState: {
        schemaVersion: '1.0' as const,
        kind: 'fleet-adoption-updated-state' as const,
        generated_at: '2026-03-19T01:00:00.000Z',
        execution_plan_digest: 'digest',
        session_id: 'session-1',
        summary: {
          repos_total: 1,
          by_reconciliation_status: {
            completed_as_planned: 0,
            completed_with_drift: 1,
            partial: 0,
            failed: 0,
            blocked: 0,
            not_run: 0,
            stale_plan_or_superseded: 0,
          },
          action_counts: { needs_retry: 1, needs_replan: 0, needs_review: 1 },
          repos_needing_retry: ['repo-a'],
          repos_needing_replan: [],
          repos_needing_review: ['repo-a'],
          stale_or_superseded_repo_ids: [],
          blocked_repo_ids: [],
          completed_repo_ids: []
        },
        repos: []
      }
    };

    const first = generateLifecycleCandidatesArtifact(input);
    const second = generateLifecycleCandidatesArtifact(input);

    expect(second).toEqual(first);
    expect(first.candidates).toHaveLength(2);
    expect(first.candidates.every((entry) => entry.status === 'candidate')).toBe(true);
    expect(first.candidates.find((entry) => entry.target_pattern_id === 'pattern.runtime.rollback')).toMatchObject({
      recommended_action: 'retire'
    });
    expect(first.candidates.find((entry) => entry.target_pattern_id === 'pattern.runtime.drift')).toMatchObject({
      recommended_action: 'supersede'
    });
    expect(first.candidates[0]?.source_evidence_ids.length).toBeGreaterThan(0);
    expect(first.candidates[0]?.provenance_fingerprints.length).toBeGreaterThan(0);

    const artifactPath = writeLifecycleCandidatesArtifact(repoRoot, first);
    expect(artifactPath).toBe('.playbook/memory/lifecycle-candidates.json');
    expect(fs.existsSync(path.join(repoRoot, artifactPath))).toBe(true);
  });

  it('never mutates promoted doctrine while producing lifecycle recommendations', () => {
    const repoRoot = makeRepo();
    seedPatterns(repoRoot);
    const before = fs.readFileSync(path.join(repoRoot, '.playbook', 'patterns.json'), 'utf8');

    generateLifecycleCandidatesArtifact({
      projectRoot: repoRoot,
      outcomeInput: {
        schemaVersion: '1.0' as const,
        kind: 'fleet-adoption-execution-outcome-input' as const,
        generated_at: '2026-03-19T01:00:00.000Z',
        session_id: 'session-1',
        prompt_outcomes: []
      },
      receipt: {
        schemaVersion: '1.0' as const,
        kind: 'fleet-adoption-execution-receipt' as const,
        generated_at: '2026-03-19T01:00:00.000Z',
        execution_plan_digest: 'digest',
        session_id: 'session-1',
        wave_results: [],
        prompt_results: [],
        repo_results: [],
        artifact_deltas: [],
        blockers: [],
        verification_summary: {
          prompts_total: 0,
          verification_passed_count: 0,
          succeeded_count: 0,
          failed_count: 0,
          partial_count: 0,
          mismatch_count: 0,
          not_run_count: 0,
          repos_needing_retry: [],
          planned_vs_actual_drift: []
        }
      },
      updatedState: {
        schemaVersion: '1.0' as const,
        kind: 'fleet-adoption-updated-state' as const,
        generated_at: '2026-03-19T01:00:00.000Z',
        execution_plan_digest: 'digest',
        session_id: 'session-1',
        summary: {
          repos_total: 0,
          by_reconciliation_status: {
            completed_as_planned: 0,
            completed_with_drift: 0,
            partial: 0,
            failed: 0,
            blocked: 0,
            not_run: 0,
            stale_plan_or_superseded: 0,
          },
          action_counts: { needs_retry: 0, needs_replan: 0, needs_review: 0 },
          repos_needing_retry: [],
          repos_needing_replan: [],
          repos_needing_review: [],
          stale_or_superseded_repo_ids: [],
          blocked_repo_ids: [],
          completed_repo_ids: []
        },
        repos: []
      }
    });

    const after = fs.readFileSync(path.join(repoRoot, '.playbook', 'patterns.json'), 'utf8');
    expect(after).toBe(before);
  });
});
