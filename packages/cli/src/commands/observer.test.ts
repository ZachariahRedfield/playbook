import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';
import { runObserver, OBSERVER_REPO_REGISTRY_RELATIVE_PATH } from './observer/index.js';

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
