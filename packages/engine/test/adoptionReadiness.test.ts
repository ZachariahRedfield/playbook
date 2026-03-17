import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildRepoAdoptionReadiness } from '../src/adoption/readiness.js';

const mk = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'adoption-readiness-'));
const writeJson = (root: string, rel: string, value: unknown): void => {
  const target = path.join(root, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

describe('buildRepoAdoptionReadiness', () => {
  it('handles repo not connected', () => {
    const readiness = buildRepoAdoptionReadiness({ repoRoot: mk(), connected: false });
    expect(readiness.connection_status).toBe('not_connected');
    expect(readiness.lifecycle_stage).toBe('not_connected');
  });

  it('handles connected repo without playbook detection', () => {
    const root = mk();
    const readiness = buildRepoAdoptionReadiness({ repoRoot: root, connected: true });
    expect(readiness.playbook_detected).toBe(false);
    expect(readiness.lifecycle_stage).toBe('playbook_not_detected');
  });

  it('handles playbook detected but indexing missing', () => {
    const root = mk();
    fs.mkdirSync(path.join(root, '.playbook'), { recursive: true });
    const readiness = buildRepoAdoptionReadiness({ repoRoot: root });
    expect(readiness.lifecycle_stage).toBe('playbook_detected_index_pending');
  });

  it('handles indexed but planning missing', () => {
    const root = mk();
    writeJson(root, '.playbook/repo-index.json', { framework: 'node' });
    const readiness = buildRepoAdoptionReadiness({ repoRoot: root });
    expect(readiness.lifecycle_stage).toBe('indexed_plan_pending');
  });

  it('handles plan present but apply missing', () => {
    const root = mk();
    writeJson(root, '.playbook/repo-index.json', { framework: 'node' });
    writeJson(root, '.playbook/plan.json', { command: 'plan' });
    writeJson(root, '.playbook/repo-graph.json', { edges: [] });
    const readiness = buildRepoAdoptionReadiness({ repoRoot: root });
    expect(readiness.lifecycle_stage).toBe('planned_apply_pending');
    expect(readiness.fallback_proof_ready).toBe(true);
  });

  it('handles fully ready repo with stable JSON shape fields', () => {
    const root = mk();
    writeJson(root, '.playbook/repo-index.json', { framework: 'node' });
    writeJson(root, '.playbook/repo-graph.json', { edges: [] });
    writeJson(root, '.playbook/plan.json', { command: 'plan' });
    writeJson(root, '.playbook/policy-apply-result.json', { kind: 'policy-apply-result' });

    const readiness = buildRepoAdoptionReadiness({ repoRoot: root });
    expect(readiness.lifecycle_stage).toBe('ready');
    expect(readiness.cross_repo_eligible).toBe(true);
    expect(Object.keys(readiness)).toEqual([
      'schemaVersion',
      'connection_status',
      'playbook_detected',
      'governed_artifacts_present',
      'lifecycle_stage',
      'fallback_proof_ready',
      'cross_repo_eligible',
      'blockers',
      'recommended_next_steps'
    ]);
  });
});
