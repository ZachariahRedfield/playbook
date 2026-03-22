import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { verifyProtectedDocGovernance } from '../src/verify/rules/protectedDocGovernance.js';

const writeJson = (repo: string, relativePath: string, value: unknown): void => {
  const absolutePath = path.join(repo, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const makeRepo = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-protected-doc-governance-'));

const writeLaneState = (repo: string, stage: 'pending' | 'plan_ready' | 'blocked' | 'applied'): void => {
  writeJson(repo, '.playbook/lane-state.json', {
    schemaVersion: '1.0',
    kind: 'lane-state',
    generatedAt: '1970-01-01T00:00:00.000Z',
    proposalOnly: true,
    workset_plan_path: '.playbook/workset-plan.json',
    lanes: [
      {
        lane_id: 'lane-docs',
        task_ids: ['task-docs-1'],
        status: stage === 'blocked' ? 'blocked' : stage === 'applied' ? 'merge_ready' : 'completed',
        readiness_status: stage === 'blocked' ? 'blocked' : 'ready',
        dependency_level: 'low',
        dependencies_satisfied: true,
        blocked_reasons: stage === 'blocked' ? ['consolidation conflict'] : [],
        blocking_reasons: stage === 'blocked' ? ['consolidation conflict'] : [],
        conflict_surface_paths: ['docs/CHANGELOG.md'],
        shared_artifact_risk: 'high',
        assignment_confidence: 0.9,
        verification_summary: { status: 'pending', required_checks: [], optional_checks: [], notes: [] },
        merge_ready: stage === 'applied',
        worker_ready: true,
        protected_doc_consolidation: {
          has_protected_doc_work: true,
          stage,
          summary: stage === 'blocked' ? 'blocked by conflicts' : stage === 'applied' ? 'protected-doc consolidation applied' : 'pending protected-doc consolidation',
          next_command: stage === 'plan_ready' ? 'pnpm playbook apply --from-plan .playbook/docs-consolidation-plan.json' : 'pnpm playbook docs consolidate --json'
        }
      }
    ],
    blocked_lanes: stage === 'blocked' ? ['lane-docs'] : [],
    ready_lanes: [],
    running_lanes: [],
    completed_lanes: stage === 'applied' ? [] : ['lane-docs'],
    merge_ready_lanes: stage === 'applied' ? ['lane-docs'] : [],
    dependency_status: { total_edges: 0, satisfied_edges: 0, unsatisfied_edges: 0 },
    merge_readiness: { merge_ready_lanes: stage === 'applied' ? ['lane-docs'] : [], not_merge_ready_lanes: [] },
    verification_status: { status: 'pending', lanes_pending_verification: [], lanes_blocked_from_verification: [] },
    warnings: []
  });
};

const writeWorkerResults = (repo: string): void => {
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
        lane_id: 'lane-docs',
        task_ids: ['task-docs-1'],
        worker_type: 'docs',
        completion_status: 'completed',
        summary: 'fragment ready',
        blockers: [],
        unresolved_items: ['await reviewed consolidation'],
        fragment_refs: [
          {
            target_path: 'docs/CHANGELOG.md',
            fragment_path: '.playbook/fragments/changelog.fragment.json',
            fragment_id: 'frag-1'
          }
        ],
        proof_refs: [],
        artifact_refs: [],
        submitted_at: '1970-01-01T00:00:00.000Z',
        proposalOnly: true
      }
    ]
  });
};

const writeDocsPlan = (repo: string): void => {
  writeJson(repo, '.playbook/docs-consolidation-plan.json', {
    schemaVersion: '1.0',
    kind: 'docs-consolidation-plan',
    command: 'docs-consolidate-plan',
    source: { path: '.playbook/docs-consolidation.json', command: 'docs consolidate' },
    tasks: [
      {
        id: 'task-docs-1',
        ruleId: 'docs-consolidation.managed-write',
        action: 'update protected doc',
        autoFix: true,
        task_kind: 'docs-managed-write',
        file: 'docs/CHANGELOG.md',
        write: { operation: 'replace-managed-block', blockId: 'changelog', startMarker: '<!-- start -->', endMarker: '<!-- end -->', content: 'updated' },
        preconditions: { target_path: 'docs/CHANGELOG.md', target_file_fingerprint: 'fp', approved_fragment_ids: ['frag-1'], planned_operation: 'replace-managed-block', managed_block_fingerprint: 'block-fp' },
        provenance: { source_artifact_path: '.playbook/docs-consolidation.json', fragment_ids: ['frag-1'], lane_ids: ['lane-docs'], target_doc: 'docs/CHANGELOG.md', section_keys: ['status'] }
      }
    ],
    excluded: [],
    summary: { total_targets: 1, executable_targets: 1, excluded_targets: 0, auto_fix_tasks: 1 }
  });
};

describe('verifyProtectedDocGovernance', () => {
  it('fails deterministically when protected-doc fragments have no reviewed consolidation plan', () => {
    const repo = makeRepo();
    writeLaneState(repo, 'pending');
    writeWorkerResults(repo);

    const failures = verifyProtectedDocGovernance(repo);

    expect(failures.map((failure) => failure.id)).toEqual([
      'protected-doc.consolidation.pending',
      'protected-doc.consolidation.plan.missing'
    ]);
    expect(failures[0]?.fix ?? failures[1]?.fix).toContain('docs consolidate-plan');
  });

  it('fails deterministically when guarded apply reports singleton-doc drift conflicts', () => {
    const repo = makeRepo();
    writeLaneState(repo, 'applied');
    writeWorkerResults(repo);
    writeDocsPlan(repo);
    writeJson(repo, '.playbook/policy-apply-result.json', {
      schemaVersion: '1.0',
      kind: 'policy-apply-result',
      executed: [],
      skipped_requires_review: [],
      skipped_blocked: [],
      failed_execution: [
        { proposal_id: 'task-docs-1', decision: 'blocked', reason: 'docs consolidation conflict', error: 'target-drift-detected' }
      ],
      summary: { executed: 0, skipped_requires_review: 0, skipped_blocked: 0, failed_execution: 1, total: 1 }
    });

    const failures = verifyProtectedDocGovernance(repo);

    expect(failures).toEqual([
      expect.objectContaining({
        id: 'protected-doc.apply.drift-conflict',
        fix: 'Regenerate the reviewed docs-consolidation-plan artifact before applying again.'
      })
    ]);
  });

  it('passes when the reviewed consolidation path is clean', () => {
    const repo = makeRepo();
    writeLaneState(repo, 'applied');
    writeWorkerResults(repo);
    writeDocsPlan(repo);
    writeJson(repo, '.playbook/policy-apply-result.json', {
      schemaVersion: '1.0',
      kind: 'policy-apply-result',
      executed: [{ proposal_id: 'task-docs-1', decision: 'safe', reason: 'applied' }],
      skipped_requires_review: [],
      skipped_blocked: [],
      failed_execution: [],
      summary: { executed: 1, skipped_requires_review: 0, skipped_blocked: 0, failed_execution: 0, total: 1 }
    });

    expect(verifyProtectedDocGovernance(repo)).toEqual([]);
  });
});
