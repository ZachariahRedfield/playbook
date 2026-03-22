import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readProofParallelWorkSummary } from '../src/adoption/proofParallelWork.js';

const writeJson = (repo: string, relativePath: string, value: unknown): void => {
  const absolutePath = path.join(repo, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

describe('readProofParallelWorkSummary', () => {
  it('reads parallel-work artifacts into a deterministic compact summary', () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-proof-parallel-work-'));

    writeJson(repo, '.playbook/lane-state.json', {
      schemaVersion: '1.0',
      kind: 'lane-state',
      generatedAt: '1970-01-01T00:00:00.000Z',
      proposalOnly: true,
      workset_plan_path: '.playbook/workset-plan.json',
      lanes: [
        {
          lane_id: 'lane-a',
          task_ids: ['task-a'],
          status: 'ready',
          readiness_status: 'ready',
          dependency_level: 'low',
          dependencies_satisfied: true,
          blocked_reasons: [],
          blocking_reasons: [],
          conflict_surface_paths: [],
          shared_artifact_risk: 'low',
          assignment_confidence: 0.9,
          verification_summary: { status: 'pending', required_checks: [], optional_checks: [], notes: [] },
          merge_ready: false,
          worker_ready: true,
          protected_doc_consolidation: { has_protected_doc_work: true, stage: 'plan_ready', summary: 'pending protected-doc consolidation', next_command: 'pnpm playbook apply --from-plan .playbook/docs-consolidation-plan.json' }
        },
        {
          lane_id: 'lane-b',
          task_ids: ['task-b'],
          status: 'blocked',
          readiness_status: 'blocked',
          dependency_level: 'medium',
          dependencies_satisfied: false,
          blocked_reasons: ['waiting on dependency lane lane-a'],
          blocking_reasons: ['waiting on dependency lane lane-a'],
          conflict_surface_paths: [],
          shared_artifact_risk: 'medium',
          assignment_confidence: 0.5,
          verification_summary: { status: 'blocked', required_checks: [], optional_checks: [], notes: [] },
          merge_ready: false,
          worker_ready: true,
          protected_doc_consolidation: { has_protected_doc_work: false, stage: 'not_applicable', summary: 'no protected-doc work', next_command: null }
        },
        {
          lane_id: 'lane-c',
          task_ids: ['task-c'],
          status: 'merge_ready',
          readiness_status: 'ready',
          dependency_level: 'low',
          dependencies_satisfied: true,
          blocked_reasons: [],
          blocking_reasons: [],
          conflict_surface_paths: [],
          shared_artifact_risk: 'low',
          assignment_confidence: 0.95,
          verification_summary: { status: 'pending', required_checks: [], optional_checks: [], notes: [] },
          merge_ready: true,
          worker_ready: true,
          protected_doc_consolidation: { has_protected_doc_work: false, stage: 'applied', summary: 'protected-doc consolidation applied', next_command: null }
        }
      ],
      blocked_lanes: ['lane-b'],
      ready_lanes: ['lane-a'],
      running_lanes: [],
      completed_lanes: [],
      merge_ready_lanes: ['lane-c'],
      dependency_status: { total_edges: 1, satisfied_edges: 0, unsatisfied_edges: 1 },
      merge_readiness: { merge_ready_lanes: ['lane-c'], not_merge_ready_lanes: [] },
      verification_status: { status: 'blocked', lanes_pending_verification: ['lane-a', 'lane-c'], lanes_blocked_from_verification: ['lane-b'] },
      warnings: []
    });
    writeJson(repo, '.playbook/worker-results.json', {
      schemaVersion: '1.0',
      kind: 'worker-results',
      proposalOnly: true,
      generatedAt: '1970-01-01T00:00:00.000Z',
      results: [
        {
          schemaVersion: '1.0',
          kind: 'worker-result',
          result_id: 'worker-result:1',
          lane_id: 'lane-a',
          task_ids: ['task-a'],
          worker_type: 'docs',
          completion_status: 'in_progress',
          summary: 'working',
          blockers: [],
          unresolved_items: [],
          fragment_refs: [],
          proof_refs: [],
          artifact_refs: [],
          submitted_at: '1970-01-01T00:00:00.000Z',
          proposalOnly: true
        }
      ]
    });
    writeJson(repo, '.playbook/docs-consolidation-plan.json', {
      schemaVersion: '1.0',
      kind: 'docs-consolidation-plan',
      command: 'docs-consolidate-plan',
      source: { path: '.playbook/docs-consolidation.json', command: 'docs consolidate' },
      tasks: [
        {
          task_id: 'task-docs-1',
          task_kind: 'docs-managed-write',
          file: 'docs/CHANGELOG.md',
          write: { operation: 'replace-managed-block', blockId: 'x', startMarker: '<!-- x -->', endMarker: '<!-- /x -->', content: 'content' },
          preconditions: { target_path: 'docs/CHANGELOG.md', target_file_fingerprint: 'a', approved_fragment_ids: ['f1'], planned_operation: 'replace-managed-block', managed_block_fingerprint: 'b' },
          provenance: { source_artifact_path: '.playbook/docs-consolidation.json', fragment_ids: ['f1'], lane_ids: ['lane-a'], target_doc: 'docs/CHANGELOG.md', section_keys: ['status'] }
        }
      ],
      excluded: [
        {
          exclusion_id: 'exclude-1',
          target_doc: 'docs/PLAYBOOK_PRODUCT_ROADMAP.md',
          section_keys: ['roadmap'],
          fragment_ids: ['f2'],
          lane_ids: ['lane-b'],
          reason: 'issue-blocked',
          message: 'blocked'
        }
      ],
      summary: { total_targets: 2, executable_targets: 1, excluded_targets: 1, auto_fix_tasks: 1 }
    });
    writeJson(repo, '.playbook/policy-apply-result.json', {
      schemaVersion: '1.0',
      kind: 'policy-apply-result',
      executed: [],
      skipped_requires_review: [],
      skipped_blocked: [{ proposal_id: 'proposal-9', decision: 'blocked', reason: 'guard conflict' }],
      failed_execution: [],
      summary: { executed: 1, skipped_requires_review: 0, skipped_blocked: 1, failed_execution: 0, total: 2 }
    });

    const result = readProofParallelWorkSummary(repo);

    expect(result).toMatchObject({
      decision: 'parallel_guard_conflicted',
      status: 'guarded apply conflicted',
      counts: { pending: 1, blocked: 1, plan_ready: 1, guard_conflicted: 1, merge_ready: 1 }
    });
    expect(result.affected_surfaces).toEqual([
      '1 blocked lane(s)',
      '1 docs plan-ready lane(s)',
      '1 guarded-apply conflict(s)',
      '1 merge-ready lane(s)',
      '1 pending lane(s)',
      'docs targets=1'
    ]);
    expect(result.blockers).toEqual([
      'blocked lane: lane-b',
      'docs exclusion: docs/PLAYBOOK_PRODUCT_ROADMAP.md',
      'guard conflict: proposal-9'
    ]);
    expect(result.details.lane_state.plan_ready_lanes).toEqual(['lane-a']);
    expect(result.details.guarded_apply.skipped_blocked).toEqual(['proposal-9']);
  });
});
