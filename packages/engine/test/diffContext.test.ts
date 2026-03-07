import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { resolveDiffAskContext } from '../src/ask/diffContext.js';

const createRepo = (name: string): string => fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));

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

const runGit = (repo: string, args: string[]): string =>
  execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

const initGitRepo = (repo: string): void => {
  runGit(repo, ['init']);
  runGit(repo, ['config', 'user.email', 'bot@example.com']);
  runGit(repo, ['config', 'user.name', 'Playbook Bot']);
  runGit(repo, ['checkout', '-b', 'main']);
};

describe('resolveDiffAskContext', () => {
  it('returns deterministic diff context from changed files mapped to modules', () => {
    const repo = createRepo('playbook-engine-diff-context');
    writeRepoIndex(repo);
    initGitRepo(repo);

    fs.mkdirSync(path.join(repo, 'src', 'auth'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'src', 'auth', 'index.ts'), 'export const auth = 1;\n');
    runGit(repo, ['add', '.']);
    runGit(repo, ['commit', '-m', 'initial']);

    fs.mkdirSync(path.join(repo, 'src', 'workouts'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'src', 'workouts', 'index.ts'), 'export const workouts = 2;\n');
    fs.mkdirSync(path.join(repo, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'docs', 'note.md'), '# note\n');

    const result = resolveDiffAskContext(repo, { baseRef: 'main' });

    expect(result.kind).toBe('playbook-diff-context');
    expect(result.baseRef).toBe('main');
    expect(result.changedFiles).toEqual(['docs/note.md', 'src/workouts/index.ts']);
    expect(result.affectedModules).toEqual(['workouts']);
    expect(result.docs).toEqual(['docs/note.md']);
  });

  it('fails deterministically when there are no changed files', () => {
    const repo = createRepo('playbook-engine-diff-context-empty');
    writeRepoIndex(repo);
    initGitRepo(repo);

    fs.mkdirSync(path.join(repo, 'src', 'auth'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'src', 'auth', 'index.ts'), 'export const auth = 1;\n');
    runGit(repo, ['add', '.']);
    runGit(repo, ['commit', '-m', 'initial']);

    expect(() => resolveDiffAskContext(repo, { baseRef: 'main' })).toThrow(
      'playbook ask --diff-context: no changed files were detected for the current working tree/diff base.'
    );
  });
});
