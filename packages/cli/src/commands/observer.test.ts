import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';
import { createObserverServer, runObserver, OBSERVER_REPO_REGISTRY_RELATIVE_PATH } from './observer/index.js';

const makeTempDir = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-observer-'));

const writeArtifact = (repoRoot: string, relativePath: string, payload: Record<string, unknown>): void => {
  const targetPath = path.join(repoRoot, relativePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, JSON.stringify(payload, null, 2));
};

const parseJsonCall = (spy: ReturnType<typeof vi.spyOn>): Record<string, unknown> => JSON.parse(String(spy.mock.calls.at(-1)?.[0] ?? '{}'));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('runObserver', () => {
  it('adds, lists, and removes repos deterministically', async () => {
    const cwd = makeTempDir();
    const repoA = path.join(cwd, 'z-repo');
    const repoB = path.join(cwd, 'a-repo');
    fs.mkdirSync(path.join(repoA, '.playbook'), { recursive: true });
    fs.mkdirSync(path.join(repoB, '.playbook'), { recursive: true });

    expect(await runObserver(cwd, ['repo', 'add', repoA, '--id', 'z-id', '--tag', 'primary'], { format: 'json', quiet: false })).toBe(ExitCode.Success);
    expect(await runObserver(cwd, ['repo', 'add', repoB, '--id', 'a-id', '--tag', 'self-host'], { format: 'json', quiet: false })).toBe(ExitCode.Success);

    const registryPath = path.join(cwd, OBSERVER_REPO_REGISTRY_RELATIVE_PATH);
    expect(fs.existsSync(registryPath)).toBe(true);

    const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8')) as { repos: Array<{ id: string }> };
    expect(registry.repos.map((repo) => repo.id)).toEqual(['a-id', 'z-id']);

    const listSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    expect(await runObserver(cwd, ['repo', 'list'], { format: 'json', quiet: false })).toBe(ExitCode.Success);
    const listPayload = parseJsonCall(listSpy);
    expect((listPayload.registry as { repos: Array<{ id: string }> }).repos.map((repo) => repo.id)).toEqual(['a-id', 'z-id']);

    expect(await runObserver(cwd, ['repo', 'remove', 'a-id'], { format: 'json', quiet: false })).toBe(ExitCode.Success);
    const updated = JSON.parse(fs.readFileSync(registryPath, 'utf8')) as { repos: Array<{ id: string }> };
    expect(updated.repos.map((repo) => repo.id)).toEqual(['z-id']);
  });

  it('rejects duplicate ids and duplicate roots', async () => {
    const cwd = makeTempDir();
    const repoA = path.join(cwd, 'repo-a');
    const repoB = path.join(cwd, 'repo-b');
    fs.mkdirSync(path.join(repoA, '.playbook'), { recursive: true });
    fs.mkdirSync(path.join(repoB, '.playbook'), { recursive: true });

    expect(await runObserver(cwd, ['repo', 'add', repoA, '--id', 'repo-main'], { format: 'json', quiet: false })).toBe(ExitCode.Success);

    const dupIdSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    expect(await runObserver(cwd, ['repo', 'add', repoB, '--id', 'repo-main'], { format: 'json', quiet: false })).toBe(ExitCode.Failure);
    expect(String((parseJsonCall(dupIdSpy).error))).toContain('duplicate id');

    const dupRootSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    expect(await runObserver(cwd, ['repo', 'add', repoA, '--id', 'repo-alt'], { format: 'json', quiet: false })).toBe(ExitCode.Failure);
    expect(String((parseJsonCall(dupRootSpy).error))).toContain('duplicate root');
  });

  it('writes stable artifacts for equivalent list operations', async () => {
    const cwd = makeTempDir();
    const repoA = path.join(cwd, 'repo-a');
    fs.mkdirSync(path.join(repoA, '.playbook'), { recursive: true });

    expect(await runObserver(cwd, ['repo', 'add', repoA, '--id', 'repo-a'], { format: 'json', quiet: false })).toBe(ExitCode.Success);

    const registryPath = path.join(cwd, OBSERVER_REPO_REGISTRY_RELATIVE_PATH);
    const first = fs.readFileSync(registryPath, 'utf8');

    expect(await runObserver(cwd, ['repo', 'list'], { format: 'json', quiet: false })).toBe(ExitCode.Success);
    const second = fs.readFileSync(registryPath, 'utf8');

    expect(second).toBe(first);
  });
});


describe('observer server', () => {
  it('serves health, repos, snapshot, repo and artifact endpoints deterministically', async () => {
    const cwd = makeTempDir();
    const repo = path.join(cwd, 'repo-a');
    fs.mkdirSync(path.join(repo, '.playbook'), { recursive: true });
    fs.writeFileSync(path.join(repo, '.playbook', 'session.json'), JSON.stringify({ schemaVersion: '1.0', kind: 'session', id: 'session-a' }, null, 2));
    fs.writeFileSync(path.join(repo, '.playbook', 'system-map.json'), JSON.stringify({ schemaVersion: '1.0', kind: 'system-map', layers: [], nodes: [], edges: [] }, null, 2));

    expect(await runObserver(cwd, ['repo', 'add', repo, '--id', 'repo-a'], { format: 'json', quiet: false })).toBe(ExitCode.Success);

    const server = createObserverServer(cwd);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address();
    expect(address).toBeTypeOf('object');
    const port = typeof address === 'object' && address ? address.port : 0;

    const health = await fetch(`http://127.0.0.1:${port}/health`);
    expect(health.status).toBe(200);
    const healthJson = await health.json() as { status: string; readOnly: boolean; localOnly: boolean };
    expect(healthJson).toMatchObject({ status: 'ok', readOnly: true, localOnly: true });

    const repos = await fetch(`http://127.0.0.1:${port}/repos`);
    expect(repos.status).toBe(200);
    const reposJson = await repos.json() as { home_repo_id: string | null; repos: Array<{ id: string; readiness: { readiness_state: string; session_present: boolean } }> };
    expect(reposJson.home_repo_id).toBeNull();
    expect(reposJson.repos.map((entry) => entry.id)).toEqual(['repo-a']);
    expect(reposJson.repos[0]?.readiness.readiness_state).toBe('partially_observable');
    expect(reposJson.repos[0]?.readiness.session_present).toBe(true);

    const snapshot = await fetch(`http://127.0.0.1:${port}/snapshot`);
    expect(snapshot.status).toBe(200);
    const snapshotJson = await snapshot.json() as {
      home_repo_id: string | null;
      snapshot: { kind: string; repos: Array<{ id: string }> };
      readiness: Array<{ id: string; readiness: { readiness_state: string } }>;
    };
    expect(snapshotJson.home_repo_id).toBeNull();
    expect(snapshotJson.snapshot.kind).toBe('observer-snapshot');
    expect(snapshotJson.snapshot.repos.map((entry) => entry.id)).toEqual(['repo-a']);
    const systemMapInSnapshot = (snapshotJson.snapshot as { repos: Array<{ artifacts?: Array<{ kind: string; value: unknown }> }> }).repos[0]?.artifacts?.find((artifact) => artifact.kind === 'system-map');
    expect(systemMapInSnapshot).toBeDefined();
    expect(snapshotJson.readiness[0]?.id).toBe('repo-a');
    expect(snapshotJson.readiness[0]?.readiness.readiness_state).toBe('partially_observable');

    const repoResponse = await fetch(`http://127.0.0.1:${port}/repos/repo-a`);
    expect(repoResponse.status).toBe(200);
    const repoJson = await repoResponse.json() as { repo: { id: string }; readiness: { readiness_state: string } };
    expect(repoJson.repo.id).toBe('repo-a');
    expect(repoJson.readiness.readiness_state).toBe('partially_observable');

    const artifactResponse = await fetch(`http://127.0.0.1:${port}/repos/repo-a/artifacts/session`);
    expect(artifactResponse.status).toBe(200);
    const artifactJson = await artifactResponse.json() as { artifact: { kind: string; value: { kind: string } } };
    expect(artifactJson.artifact.kind).toBe('session');
    expect(artifactJson.artifact.value.kind).toBe('session');

    const systemMapArtifactResponse = await fetch(`http://127.0.0.1:${port}/repos/repo-a/artifacts/system-map`);
    expect(systemMapArtifactResponse.status).toBe(200);
    const systemMapArtifactJson = await systemMapArtifactResponse.json() as { artifact: { kind: string; value: { kind: string } } };
    expect(systemMapArtifactJson.artifact.kind).toBe('system-map');
    expect(systemMapArtifactJson.artifact.value.kind).toBe('system-map');

    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });


  it('computes deterministic readiness states for connected, partial, and observable repos', async () => {
    const cwd = makeTempDir();
    const connectedOnly = path.join(cwd, 'repo-connected-only');
    const partial = path.join(cwd, 'repo-partial');
    const full = path.join(cwd, 'repo-full');

    fs.mkdirSync(connectedOnly, { recursive: true });
    fs.mkdirSync(path.join(partial, '.playbook'), { recursive: true });
    fs.mkdirSync(path.join(full, '.playbook'), { recursive: true });

    writeArtifact(partial, '.playbook/repo-index.json', { schemaVersion: '1.0', kind: 'repo-index' });
    writeArtifact(partial, '.playbook/session.json', { schemaVersion: '1.0', kind: 'session' });

    writeArtifact(full, '.playbook/repo-index.json', { schemaVersion: '1.0', kind: 'repo-index' });
    writeArtifact(full, '.playbook/cycle-state.json', { schemaVersion: '1.0', kind: 'cycle-state' });
    writeArtifact(full, '.playbook/cycle-history.json', { schemaVersion: '1.0', kind: 'cycle-history' });
    writeArtifact(full, '.playbook/policy-evaluation.json', { schemaVersion: '1.0', kind: 'policy-evaluation' });
    writeArtifact(full, '.playbook/policy-apply-result.json', { schemaVersion: '1.0', kind: 'policy-apply-result' });
    writeArtifact(full, '.playbook/pr-review.json', { schemaVersion: '1.0', kind: 'pr-review' });
    writeArtifact(full, '.playbook/session.json', { schemaVersion: '1.0', kind: 'session' });

    expect(await runObserver(cwd, ['repo', 'add', connectedOnly, '--id', 'connected-only'], { format: 'json', quiet: false })).toBe(ExitCode.Success);
    expect(await runObserver(cwd, ['repo', 'add', partial, '--id', 'partial'], { format: 'json', quiet: false })).toBe(ExitCode.Success);
    expect(await runObserver(cwd, ['repo', 'add', full, '--id', 'full'], { format: 'json', quiet: false })).toBe(ExitCode.Success);

    const server = createObserverServer(cwd);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address();
    expect(address).toBeTypeOf('object');
    const port = typeof address === 'object' && address ? address.port : 0;

    const repos = await fetch(`http://127.0.0.1:${port}/repos`);
    expect(repos.status).toBe(200);
    const reposJson = await repos.json() as {
      repos: Array<{ id: string; readiness: { readiness_state: string; missing_artifacts: string[]; last_artifact_update_time: string | null } }>;
    };

    const states = Object.fromEntries(reposJson.repos.map((repo) => [repo.id, repo.readiness.readiness_state]));
    expect(states).toEqual({
      'connected-only': 'connected_only',
      partial: 'partially_observable',
      full: 'observable'
    });

    const connectedReadiness = reposJson.repos.find((repo) => repo.id === 'connected-only')?.readiness;
    expect(connectedReadiness?.missing_artifacts.length).toBeGreaterThan(0);
    expect(connectedReadiness?.last_artifact_update_time).toBeNull();

    const fullReadiness = reposJson.repos.find((repo) => repo.id === 'full')?.readiness;
    expect(fullReadiness?.missing_artifacts).toEqual([]);
    expect(typeof fullReadiness?.last_artifact_update_time).toBe('string');

    const uiScript = await fetch(`http://127.0.0.1:${port}/ui/app.js`);
    const uiScriptText = await uiScript.text();
    expect(uiScriptText).toContain('readiness: ');
    expect(uiScriptText).toContain('Missing artifacts:');
    expect(uiScriptText).toContain('Last artifact update:');
    expect(uiScriptText).toContain('renderSelfObservation');
    expect(uiScriptText).toContain('Control-plane artifacts present:</strong>');
    expect(uiScriptText).toContain('Runtime loop available:</strong>');

    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });


  it('selects playbook repo as self/home and reports blueprint missing guidance deterministically', async () => {
    const cwd = makeTempDir();
    const playbookRepo = path.join(cwd, 'playbook');
    fs.mkdirSync(path.join(playbookRepo, '.playbook'), { recursive: true });

    writeArtifact(playbookRepo, '.playbook/repo-index.json', { schemaVersion: '1.0', kind: 'repo-index' });
    writeArtifact(playbookRepo, '.playbook/cycle-state.json', { schemaVersion: '1.0', kind: 'cycle-state' });
    writeArtifact(playbookRepo, '.playbook/cycle-history.json', { schemaVersion: '1.0', kind: 'cycle-history' });
    writeArtifact(playbookRepo, '.playbook/policy-evaluation.json', { schemaVersion: '1.0', kind: 'policy-evaluation' });
    writeArtifact(playbookRepo, '.playbook/policy-apply-result.json', { schemaVersion: '1.0', kind: 'policy-apply-result' });
    writeArtifact(playbookRepo, '.playbook/pr-review.json', { schemaVersion: '1.0', kind: 'pr-review' });
    writeArtifact(playbookRepo, '.playbook/session.json', { schemaVersion: '1.0', kind: 'session' });

    expect(await runObserver(cwd, ['repo', 'add', playbookRepo, '--id', 'playbook'], { format: 'json', quiet: false })).toBe(ExitCode.Success);

    const server = createObserverServer(cwd);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address();
    expect(address).toBeTypeOf('object');
    const port = typeof address === 'object' && address ? address.port : 0;

    const repos = await fetch(`http://127.0.0.1:${port}/repos`);
    const reposJson = await repos.json() as { home_repo_id: string | null };
    expect(reposJson.home_repo_id).toBe('playbook');

    const uiResponse = await fetch(`http://127.0.0.1:${port}/ui/app.js`);
    const uiScriptText = await uiResponse.text();
    expect(uiScriptText).toContain('Blueprint missing. Run');
    expect(uiScriptText).toContain('.playbook/system-map.json');
    expect(uiScriptText).toContain('renderSelfObservation');

    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  it('serves UI shell, supports repo add/remove mutations, and still rejects unsupported methods', async () => {
    const cwd = makeTempDir();
    const server = createObserverServer(cwd);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address();
    expect(address).toBeTypeOf('object');
    const port = typeof address === 'object' && address ? address.port : 0;

    const missingRepo = await fetch(`http://127.0.0.1:${port}/repos/unknown`);
    expect(missingRepo.status).toBe(404);
    const missingRepoJson = await missingRepo.json() as { error: string };
    expect(missingRepoJson.error).toBe('repo-not-found');

    const uiResponse = await fetch(`http://127.0.0.1:${port}/`);
    expect(uiResponse.status).toBe(200);
    const uiHtml = await uiResponse.text();
    expect(uiHtml).toContain('Observer Dashboard');
    expect(uiHtml).toContain('System Blueprint');

    const uiScript = await fetch(`http://127.0.0.1:${port}/ui/app.js`);
    expect(uiScript.status).toBe(200);
    const uiScriptText = await uiScript.text();
    expect(uiScriptText).toContain('setInterval(refreshAll, 5000)');
    expect(uiScriptText).toContain("'system-map'");
    expect(uiScriptText).toContain('renderSystemBlueprint');

    const repoPath = path.join(cwd, 'repo-http');
    fs.mkdirSync(repoPath, { recursive: true });
    const postAttempt = await fetch(`http://127.0.0.1:${port}/repos`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: repoPath, id: 'repo-http' })
    });
    expect(postAttempt.status).toBe(200);
    const postJson = await postAttempt.json() as { kind: string; repo: { id: string } };
    expect(postJson.kind).toBe('observer-server-repo-add');
    expect(postJson.repo.id).toBe('repo-http');

    const deleteAttempt = await fetch(`http://127.0.0.1:${port}/repos/repo-http`, { method: 'DELETE' });
    expect(deleteAttempt.status).toBe(200);
    const deleteJson = await deleteAttempt.json() as { kind: string; removedId: string };
    expect(deleteJson.kind).toBe('observer-server-repo-remove');
    expect(deleteJson.removedId).toBe('repo-http');

    const patchAttempt = await fetch(`http://127.0.0.1:${port}/repos`, { method: 'PATCH' });
    expect(patchAttempt.status).toBe(405);
    const patchJson = await patchAttempt.json() as { error: string };
    expect(patchJson.error).toBe('method-not-allowed');

    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });
});
