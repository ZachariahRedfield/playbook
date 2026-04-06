import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { collectScmContext } from './context.js';

const git = (cwd: string, args: string[]): string =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

const makeRepo = (prefix: string): string => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
  git(repo, ['init', '-b', 'main']);
  git(repo, ['config', 'user.email', 'dev@example.com']);
  git(repo, ['config', 'user.name', 'Dev']);
  fs.writeFileSync(path.join(repo, 'README.md'), '# seed\n', 'utf8');
  git(repo, ['add', '.']);
  git(repo, ['commit', '-m', 'seed']);
  return repo;
};

describe('collectScmContext', () => {
  it('resolves PR-like base from origin/main when available', () => {
    const repo = makeRepo('playbook-scm-origin-main');
    const mainSha = git(repo, ['rev-parse', 'HEAD']);
    git(repo, ['update-ref', 'refs/remotes/origin/main', mainSha]);

    git(repo, ['checkout', '-b', 'feature/scm']);
    fs.writeFileSync(path.join(repo, 'feature.txt'), 'feature\n', 'utf8');
    git(repo, ['add', '.']);
    git(repo, ['commit', '-m', 'feature']);

    const context = collectScmContext(repo);

    expect(context.diffBase.baseRef).toBe('origin/main');
    expect(context.git.detachedHead).toBe(false);
    expect(context.git.branch).toBe('feature/scm');
  });

  it('resolves push-like base from HEAD~1 on main', () => {
    const repo = makeRepo('playbook-scm-main');
    fs.writeFileSync(path.join(repo, 'next.txt'), 'next\n', 'utf8');
    git(repo, ['add', '.']);
    git(repo, ['commit', '-m', 'next']);

    const context = collectScmContext(repo);

    expect(context.diffBase.baseRef).toBe('HEAD~1');
    expect(context.diffBase.baseSha).toBe(git(repo, ['rev-parse', 'HEAD~1']));
  });

  it('reports detached HEAD state deterministically', () => {
    const repo = makeRepo('playbook-scm-detached');
    const sha = git(repo, ['rev-parse', 'HEAD']);
    git(repo, ['checkout', sha]);

    const context = collectScmContext(repo);

    expect(context.git.detachedHead).toBe(true);
    expect(context.git.branch).toBeNull();
  });

  it('reports shallow clone and dirty working tree state', () => {
    const source = makeRepo('playbook-scm-source');
    fs.writeFileSync(path.join(source, 'second.txt'), 'second\n', 'utf8');
    git(source, ['add', '.']);
    git(source, ['commit', '-m', 'second']);

    const target = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-scm-shallow-'));
    git(target, ['clone', '--depth', '1', `file://${source}`, 'repo']);
    const repo = path.join(target, 'repo');

    fs.writeFileSync(path.join(repo, 'dirty.txt'), 'dirty\n', 'utf8');

    const context = collectScmContext(repo);

    expect(context.git.isShallow).toBe(true);
    expect(context.workingTree.dirty).toBe(true);
    expect(context.workingTree.untrackedChanges).toBe(true);
  });

  it('reports rename summary from diff base', () => {
    const repo = makeRepo('playbook-scm-renames');

    fs.writeFileSync(path.join(repo, 'old-name.txt'), 'value\n', 'utf8');
    git(repo, ['add', '.']);
    git(repo, ['commit', '-m', 'add old file on main']);

    git(repo, ['update-ref', 'refs/remotes/origin/main', git(repo, ['rev-parse', 'HEAD'])]);
    git(repo, ['checkout', '-b', 'feature/rename']);
    git(repo, ['mv', 'old-name.txt', 'new-name.txt']);
    git(repo, ['commit', '-m', 'rename file']);

    const context = collectScmContext(repo);

    expect(context.renameSummary.count).toBe(1);
    expect(context.renameSummary.entries[0]).toMatchObject({
      status: expect.stringMatching(/^R/),
      from: 'old-name.txt',
      to: 'new-name.txt'
    });
  });
});
