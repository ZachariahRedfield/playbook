import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MAINTENANCE_PLAN_RELATIVE_PATH, readMaintenancePlan, writeMaintenancePlan } from './maintenancePlan.js';

const writeJson = (repo: string, relativePath: string, value: unknown): void => {
  const absolutePath = path.join(repo, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const createRepo = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-maintenance-plan-'));

describe('maintenancePlan', () => {
  it('is deterministic for the same source artifacts', () => {
    const repo = createRepo();

    writeJson(repo, '.playbook/longitudinal-state.json', {
      schemaVersion: '1.0',
      kind: 'playbook-longitudinal-state',
      approvals_governance_refs: { required: ['proposal-1'], blocked: [], refs: ['proposal-1'] },
      recurring_evidence: {
        finding_clusters: [
          { key: 'rule.docs.audit', count: 3, refs: ['verify:rule.docs.audit'] },
          { key: 'release.version.governance', count: 2, refs: ['verify:release.version.governance'] }
        ],
        failure_clusters: []
      }
    });

    writeJson(repo, '.playbook/remediation-status.json', {
      preferred_repair_classes: [
        { repair_class: 'safe-formatting', success_count: 3, failure_signatures: ['sig-safe'] }
      ],
      blocked_signatures: [],
      review_required_signatures: []
    });

    writeJson(repo, '.playbook/test-autofix-history.json', {
      runs: [{ run_id: 'run-1' }]
    });

    const first = readMaintenancePlan(repo);
    const second = readMaintenancePlan(repo);

    expect(second).toEqual(first);
    expect(first.generatedAt).toBe('1970-01-01T00:00:00.000Z');
    expect(first.maintenanceRows.length).toBeGreaterThan(0);
  });

  it('produces bounded recurring candidates and keeps authority read-only', () => {
    const repo = createRepo();

    writeJson(repo, '.playbook/longitudinal-state.json', {
      schemaVersion: '1.0',
      kind: 'playbook-longitudinal-state',
      approvals_governance_refs: { required: ['proposal-2'], blocked: [], refs: ['proposal-2'] },
      recurring_evidence: {
        finding_clusters: [
          { key: 'docs.changelog.drift', count: 2, refs: ['verify:docs.changelog.drift'] },
          { key: 'playbookignore.cleanup', count: 2, refs: ['verify:playbookignore.cleanup'] },
          { key: 'release.version.governance', count: 2, refs: ['verify:release.version.governance'] }
        ],
        failure_clusters: []
      }
    });

    writeJson(repo, '.playbook/outcome-feedback.json', {
      signals: { trends: ['bounded-failure trend incremented'], confidence: [], triggerQuality: [], staleKnowledge: [] }
    });

    writeJson(repo, '.playbook/remediation-status.json', {
      preferred_repair_classes: [
        { repair_class: 'safe-import-sort', success_count: 2, failure_signatures: ['sig-stable'] }
      ],
      blocked_signatures: [],
      review_required_signatures: []
    });

    writeJson(repo, '.playbook/test-autofix-history.json', {
      runs: [{ run_id: 'run-2' }, { run_id: 'run-3' }]
    });

    const artifact = writeMaintenancePlan(repo);

    expect(artifact.maintenanceRows.map((row) => row.maintenanceType)).toEqual([
      'docs-audit-maintenance',
      'ignore-cleanup-hygiene-recommendations',
      'release-governance-drift-reconciliation',
      'approved-low-risk-remediation-patterns'
    ]);
    expect(artifact.authority).toEqual({
      mutation: 'read-only',
      execution: 'unchanged',
      doctrinePromotion: 'forbidden'
    });
    expect(fs.existsSync(path.join(repo, MAINTENANCE_PLAN_RELATIVE_PATH))).toBe(true);
  });

  it('does not emit noise for non-recurring or high-ambiguity signals', () => {
    const repo = createRepo();

    writeJson(repo, '.playbook/longitudinal-state.json', {
      schemaVersion: '1.0',
      kind: 'playbook-longitudinal-state',
      approvals_governance_refs: { required: [], blocked: [], refs: [] },
      recurring_evidence: {
        finding_clusters: [
          { key: 'ambiguous.signal', count: 1, refs: ['verify:ambiguous.signal'] },
          { key: 'release.note', count: 1, refs: ['verify:release.note'] }
        ],
        failure_clusters: []
      }
    });

    writeJson(repo, '.playbook/remediation-status.json', {
      preferred_repair_classes: [
        { repair_class: 'safe-import-sort', success_count: 1, failure_signatures: ['sig-unstable'] }
      ],
      blocked_signatures: ['sig-unstable'],
      review_required_signatures: []
    });

    writeJson(repo, '.playbook/test-autofix-history.json', {
      runs: [{ run_id: 'run-4' }]
    });

    const artifact = readMaintenancePlan(repo);
    expect(artifact.maintenanceRows).toEqual([]);
    expect(artifact.summary.totalCandidates).toBe(0);
  });
});
