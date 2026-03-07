import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';
import { runAnalyzePr } from './analyzePr.js';

const createRepo = (name: string): string => fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));

const runGit = (repo: string, args: string[]): string =>
  execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

const initGitRepo = (repo: string): void => {
  runGit(repo, ['init']);
  runGit(repo, ['config', 'user.email', 'bot@example.com']);
  runGit(repo, ['config', 'user.name', 'Playbook Bot']);
  runGit(repo, ['checkout', '-b', 'main']);
};

const writeRepoIndex = (repo: string): void => {
  const indexPath = path.join(repo, '.playbook', 'repo-index.json');
  fs.mkdirSync(path.dirname(indexPath), { recursive: true });
  fs.writeFileSync(
    indexPath,
    JSON.stringify(
      {
        schemaVersion: '1.0',
        framework: 'node',
        language: 'typescript',
        architecture: 'modular-monolith',
        modules: [
          { name: 'auth', dependencies: [] },
          { name: 'workouts', dependencies: ['auth'] }
        ],
        database: 'postgres',
        rules: ['PB001']
      },
      null,
      2
    )
  );
};

describe('analyze-pr', () => {
  it('returns deterministic PR analysis JSON', async () => {
    const repo = createRepo('playbook-cli-analyze-pr');
    initGitRepo(repo);
    writeRepoIndex(repo);

    fs.mkdirSync(path.join(repo, 'src', 'auth'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'src', 'auth', 'index.ts'), 'export const auth = 1;\n');
    runGit(repo, ['add', '.']);
    runGit(repo, ['commit', '-m', 'initial']);

    fs.mkdirSync(path.join(repo, 'src', 'workouts'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'src', 'workouts', 'index.ts'), 'export const workouts = 2;\n');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runAnalyzePr(repo, ['--json'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.command).toBe('analyze-pr');
    expect(payload.changedFiles).toEqual(['src/workouts/index.ts']);
    expect(payload.affectedModules).toEqual(['workouts']);
    expect(payload.summary.changedFileCount).toBe(1);
    expect(Array.isArray(payload.reviewGuidance)).toBe(true);

    logSpy.mockRestore();
  });

  it('fails deterministically when repo index is missing', async () => {
    const repo = createRepo('playbook-cli-analyze-pr-missing-index');
    initGitRepo(repo);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runAnalyzePr(repo, ['--json'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Failure);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.command).toBe('analyze-pr');
    expect(payload.error).toContain('missing repository index');

    logSpy.mockRestore();
  });

  it('fails deterministically when there are no changed files', async () => {
    const repo = createRepo('playbook-cli-analyze-pr-no-diff');
    initGitRepo(repo);
    writeRepoIndex(repo);

    fs.mkdirSync(path.join(repo, 'src', 'auth'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'src', 'auth', 'index.ts'), 'export const auth = 1;\n');
    runGit(repo, ['add', '.']);
    runGit(repo, ['commit', '-m', 'initial']);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runAnalyzePr(repo, ['--json'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Failure);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.command).toBe('analyze-pr');
    expect(payload.error).toContain('no changed files were detected');

    logSpy.mockRestore();
  });
});
