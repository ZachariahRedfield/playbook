import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildObserverSnapshot,
  buildObserverSnapshotFromRegistry,
  readObserverRepoRegistry,
  readObserverSnapshotArtifact,
  writeObserverSnapshotArtifact,
  type ObserverRepoRegistry
} from '../src/observer/snapshot.js';

const createRoot = (name: string): string => fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));

const writeJson = (filePath: string, value: unknown): void => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const writeGovernedArtifacts = (repoPath: string, suffix: string): void => {
  writeJson(path.join(repoPath, '.playbook/cycle-state.json'), { kind: 'cycle-state', id: `${suffix}-cycle-state` });
  writeJson(path.join(repoPath, '.playbook/cycle-history.json'), { kind: 'cycle-history', id: `${suffix}-cycle-history` });
  writeJson(path.join(repoPath, '.playbook/policy-evaluation.json'), { kind: 'policy-evaluation', id: `${suffix}-policy-eval` });
  writeJson(path.join(repoPath, '.playbook/policy-apply-result.json'), { kind: 'policy-apply-result', id: `${suffix}-policy-apply` });
  writeJson(path.join(repoPath, '.playbook/pr-review.json'), { kind: 'pr-review', id: `${suffix}-pr-review` });
  writeJson(path.join(repoPath, '.playbook/session.json'), { kind: 'session', id: `${suffix}-session` });
};

const writeRegistry = (cwd: string, registry: ObserverRepoRegistry): void => {
  writeJson(path.join(cwd, '.playbook/observer/registry.json'), registry);
};

describe('observer snapshot ingestion', () => {
  it('ingests a single repo with all governed artifacts', () => {
    const cwd = createRoot('observer-single-root');
    const repo = createRoot('observer-single-repo');
    writeGovernedArtifacts(repo, 'single');

    const snapshot = buildObserverSnapshot({
      schemaVersion: '1.0',
      kind: 'observer-repo-registry',
      repos: [{ repo_id: 'repo-single', repo_name: 'repo-single', repo_path: repo }]
    });

    expect(snapshot.repos).toHaveLength(1);
    expect(snapshot.repos[0]).toMatchObject({
      repo_id: 'repo-single',
      repo_name: 'repo-single',
      status: 'ok'
    });
    expect(snapshot.repos[0]?.warnings).toEqual([]);
    expect(snapshot.repos[0]?.artifacts.cycleState).toEqual({ kind: 'cycle-state', id: 'single-cycle-state' });

    const out = writeObserverSnapshotArtifact(cwd, snapshot);
    expect(readObserverSnapshotArtifact(cwd)).toEqual(snapshot);
    expect(fs.readFileSync(out, 'utf8')).toContain('"kind": "observer-snapshot"');
  });

  it('ingests multiple repos with deterministic ordering', () => {
    const repoA = createRoot('observer-multi-a');
    const repoB = createRoot('observer-multi-b');
    writeGovernedArtifacts(repoA, 'a');
    writeGovernedArtifacts(repoB, 'b');

    const forward = buildObserverSnapshot({
      schemaVersion: '1.0',
      kind: 'observer-repo-registry',
      repos: [
        { repo_id: 'repo-b', repo_name: 'Repo B', repo_path: repoB },
        { repo_id: 'repo-a', repo_name: 'Repo A', repo_path: repoA }
      ]
    });

    const reverse = buildObserverSnapshot({
      schemaVersion: '1.0',
      kind: 'observer-repo-registry',
      repos: [
        { repo_id: 'repo-a', repo_name: 'Repo A', repo_path: repoA },
        { repo_id: 'repo-b', repo_name: 'Repo B', repo_path: repoB }
      ]
    });

    expect(forward).toEqual(reverse);
    expect(forward.repos.map((entry) => entry.repo_id)).toEqual(['repo-a', 'repo-b']);
  });

  it('records missing artifact warnings and safely degrades', () => {
    const repo = createRoot('observer-missing');
    writeJson(path.join(repo, '.playbook/cycle-state.json'), { kind: 'cycle-state', id: 'present' });

    const snapshot = buildObserverSnapshot({
      schemaVersion: '1.0',
      kind: 'observer-repo-registry',
      repos: [{ repo_id: 'repo-missing', repo_name: 'repo-missing', repo_path: repo }]
    });

    expect(snapshot.repos[0]?.status).toBe('warning');
    expect(snapshot.repos[0]?.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ artifact: 'cycleHistory', code: 'missing' }),
        expect.objectContaining({ artifact: 'policyEvaluation', code: 'missing' })
      ])
    );
    expect(snapshot.repos[0]?.artifacts.cycleState).toEqual({ kind: 'cycle-state', id: 'present' });
    expect(snapshot.repos[0]?.artifacts.policyEvaluation).toBeNull();
  });

  it('records malformed and invalid-kind warnings', () => {
    const repo = createRoot('observer-malformed');
    fs.mkdirSync(path.join(repo, '.playbook'), { recursive: true });
    fs.writeFileSync(path.join(repo, '.playbook/session.json'), '{ not json', 'utf8');
    writeJson(path.join(repo, '.playbook/pr-review.json'), { kind: 'wrong-kind' });

    const snapshot = buildObserverSnapshot({
      schemaVersion: '1.0',
      kind: 'observer-repo-registry',
      repos: [{ repo_id: 'repo-malformed', repo_name: 'repo-malformed', repo_path: repo }]
    });

    expect(snapshot.repos[0]?.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ artifact: 'session', code: 'malformed' }),
        expect.objectContaining({ artifact: 'prReview', code: 'invalid-kind' })
      ])
    );
    expect(snapshot.repos[0]?.artifacts.session).toBeNull();
    expect(snapshot.repos[0]?.artifacts.prReview).toBeNull();
  });

  it('builds from on-disk observer registry', () => {
    const cwd = createRoot('observer-registry-root');
    const repo = createRoot('observer-registry-repo');
    writeGovernedArtifacts(repo, 'registry');

    writeRegistry(cwd, {
      schemaVersion: '1.0',
      kind: 'observer-repo-registry',
      repos: [{ repo_id: 'repo-z', repo_name: 'Repo Z', repo_path: repo }]
    });

    const registry = readObserverRepoRegistry(cwd);
    expect(registry.repos).toHaveLength(1);

    const snapshot = buildObserverSnapshotFromRegistry(cwd);
    expect(snapshot.kind).toBe('observer-snapshot');
    expect(snapshot.repos[0]?.repo_id).toBe('repo-z');
  });
});
