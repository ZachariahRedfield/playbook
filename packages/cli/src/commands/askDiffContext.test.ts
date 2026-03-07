import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';
import { runAsk } from './ask.js';

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
        rules: ['requireNotesOnChanges']
      },
      null,
      2
    )
  );
};

describe('ask --diff-context', () => {
  it('returns changed-module reasoning from diff context', async () => {
    const repo = createRepo('playbook-cli-ask-diff-context');
    initGitRepo(repo);
    writeRepoIndex(repo);

    fs.mkdirSync(path.join(repo, 'src', 'auth'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'src', 'auth', 'index.ts'), 'export const auth = 1;\n');
    runGit(repo, ['add', '.']);
    runGit(repo, ['commit', '-m', 'initial']);

    fs.mkdirSync(path.join(repo, 'src', 'workouts'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'src', 'workouts', 'index.ts'), 'export const workouts = 2;\n');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runAsk(repo, ['what', 'modules', 'are', 'affected?', '--diff-context'], {
      format: 'json',
      quiet: false,
      diffContext: true
    });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.answer).toContain('Affected modules: workouts');
    expect(payload.scope.diffContext.enabled).toBe(true);
    expect(payload.context.diff.kind).toBe('playbook-diff-context');
    expect(payload.context.sources).toContainEqual({ type: 'diff', files: ['src/workouts/index.ts'] });

    logSpy.mockRestore();
  });

  it('fails deterministically when --module and --diff-context are combined', async () => {
    const repo = createRepo('playbook-cli-ask-diff-context-conflict');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const exitCode = await runAsk(repo, ['what', 'modules', 'are', 'affected?'], {
      format: 'text',
      quiet: false,
      module: 'workouts',
      diffContext: true
    });

    expect(exitCode).toBe(ExitCode.Failure);
    expect(errorSpy).toHaveBeenCalledWith(
      'playbook ask: --module and --diff-context cannot be used together. Choose one deterministic scope.'
    );

    errorSpy.mockRestore();
  });
});
