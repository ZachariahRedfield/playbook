import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';
import { createObserverServer, runObserver, OBSERVER_REPO_REGISTRY_RELATIVE_PATH } from './observer/index.js';

const makeTempDir = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-observer-'));

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
    const reposJson = await repos.json() as { repos: Array<{ id: string }> };
    expect(reposJson.repos.map((entry) => entry.id)).toEqual(['repo-a']);

    const snapshot = await fetch(`http://127.0.0.1:${port}/snapshot`);
    expect(snapshot.status).toBe(200);
    const snapshotJson = await snapshot.json() as { snapshot: { kind: string; repos: Array<{ id: string }> } };
    expect(snapshotJson.snapshot.kind).toBe('observer-snapshot');
    expect(snapshotJson.snapshot.repos.map((entry) => entry.id)).toEqual(['repo-a']);

    const repoResponse = await fetch(`http://127.0.0.1:${port}/repos/repo-a`);
    expect(repoResponse.status).toBe(200);
    const repoJson = await repoResponse.json() as { repo: { id: string } };
    expect(repoJson.repo.id).toBe('repo-a');

    const artifactResponse = await fetch(`http://127.0.0.1:${port}/repos/repo-a/artifacts/session`);
    expect(artifactResponse.status).toBe(200);
    const artifactJson = await artifactResponse.json() as { artifact: { kind: string; value: { kind: string } } };
    expect(artifactJson.artifact.kind).toBe('session');
    expect(artifactJson.artifact.value.kind).toBe('session');

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

    const uiScript = await fetch(`http://127.0.0.1:${port}/ui/app.js`);
    expect(uiScript.status).toBe(200);
    const uiScriptText = await uiScript.text();
    expect(uiScriptText).toContain('setInterval(refreshAll, 5000)');

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
