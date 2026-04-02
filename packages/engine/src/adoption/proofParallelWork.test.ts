import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readProofParallelWorkSummary } from './proofParallelWork.js';

const writeJson = (repoRoot: string, relativePath: string, value: unknown): void => {
  const target = path.join(repoRoot, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(value, null, 2));
};

describe('readProofParallelWorkSummary scope drift', () => {
  it('surfaces violated mutation scope with violated files and budget overflow', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-proof-scope-'));
    writeJson(repoRoot, '.playbook/execution-outcome-input.json', {
      prompt_outcomes: [{
        mutation_scope: {
          declared_files: ['docs/commands/status.md'],
          actual_files: ['docs/commands/status.md', 'packages/cli/src/commands/status.ts'],
          budget_files: 1
        }
      }]
    });

    const summary = readProofParallelWorkSummary(repoRoot);

    expect(summary.scope).toEqual({
      present: 1,
      missing: 0,
      violated: 1,
      clean: 0,
      violated_files: ['packages/cli/src/commands/status.ts'],
      budget_status: 'over_budget'
    });
    expect(summary.affected_surfaces).toContain('scope violated=1');
    expect(summary.blockers).toContain('scope violation: packages/cli/src/commands/status.ts');
  });

  it('keeps clean scope compact', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-proof-scope-clean-'));
    writeJson(repoRoot, '.playbook/execution-outcome-input.json', {
      prompt_outcomes: [{
        mutation_scope: {
          declared_files: ['docs/commands/status.md'],
          actual_files: ['docs/commands/status.md'],
          budget_files: 1
        }
      }]
    });

    const summary = readProofParallelWorkSummary(repoRoot);

    expect(summary.scope).toEqual({
      present: 1,
      missing: 0,
      violated: 0,
      clean: 1,
      violated_files: [],
      budget_status: 'within_budget'
    });
    expect(summary.affected_surfaces).toContain('scope clean=1');
    expect(summary.blockers.join('\n')).not.toContain('scope violation:');
  });

  it('drops blank blocker entries from compact summary output', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-proof-blockers-'));
    writeJson(repoRoot, '.playbook/lane-state.json', {
      lanes: [{ lane_id: 'lane-b', status: 'blocked', protected_doc_consolidation: { stage: 'not_applicable' } }],
      blocked_lanes: ['lane-b'],
      merge_ready_lanes: []
    });
    writeJson(repoRoot, '.playbook/docs-consolidation-plan.json', {
      tasks: [],
      excluded: [{ target_doc: 'docs/PLAYBOOK_PRODUCT_ROADMAP.md' }, { target_doc: '   ' }]
    });
    writeJson(repoRoot, '.playbook/policy-apply-result.json', {
      skipped_blocked: [{ proposal_id: 'proposal-9' }, { proposal_id: '   ' }]
    });

    const summary = readProofParallelWorkSummary(repoRoot);

    expect(summary.blockers).toEqual([
      'blocked lane: lane-b',
      'docs exclusion: docs/PLAYBOOK_PRODUCT_ROADMAP.md',
      'guard conflict: proposal-9'
    ]);
  });
});
