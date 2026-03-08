import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

type AnalyzePrPayload = {
  schemaVersion: '1.0';
  command: 'analyze-pr';
  baseRef: string;
  changedFiles: string[];
  architecture: {
    boundariesTouched: string[];
  };
  rules: {
    related: string[];
  };
};

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const cliEntry = path.join(repoRoot, 'packages', 'cli', 'dist', 'main.js');

const runCli = (cwd: string, args: string[]): ReturnType<typeof spawnSync> =>
  spawnSync(process.execPath, [cliEntry, ...args], {
    cwd,
    encoding: 'utf8'
  });

const runGit = (repo: string, args: string[]): string =>
  execFileSync('git', args, {
    cwd: repo,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim();

const createRepo = (name: string): string => fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));

const initRepo = (repo: string): void => {
  runGit(repo, ['init']);
  runGit(repo, ['config', 'user.email', 'bot@example.com']);
  runGit(repo, ['config', 'user.name', 'Playbook Bot']);
  runGit(repo, ['checkout', '-b', 'main']);
};

const writeIndex = (repo: string): void => {
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
        rules: ['PB001', 'notes.missing', 'requireNotesOnChanges', 'verify.rule.tests.required']
      },
      null,
      2
    )
  );
};

const seedBaseline = (repo: string): void => {
  fs.mkdirSync(path.join(repo, 'src', 'auth'), { recursive: true });
  fs.mkdirSync(path.join(repo, 'src', 'workouts'), { recursive: true });
  fs.mkdirSync(path.join(repo, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'src', 'auth', 'index.ts'), 'export const auth = 1;\n');
  fs.writeFileSync(path.join(repo, 'src', 'workouts', 'index.ts'), 'export const workouts = 1;\n');
  fs.writeFileSync(path.join(repo, 'src', 'workouts', 'legacy.ts'), 'export const legacy = 1;\n');
  fs.writeFileSync(path.join(repo, 'docs', 'guide.md'), '# guide\n');
  runGit(repo, ['add', '.']);
  runGit(repo, ['commit', '-m', 'baseline']);
};

const parseJson = (stdout: string): AnalyzePrPayload => JSON.parse(stdout.trim()) as AnalyzePrPayload;

describe('analyze-pr contract', () => {
  it('scopes docs-only, source, and multi-boundary rule relevance deterministically', () => {
    const docsOnlyRepo = createRepo('playbook-analyze-pr-contract-docs-only');
    const sourceRepo = createRepo('playbook-analyze-pr-contract-source');
    const multiBoundaryRepo = createRepo('playbook-analyze-pr-contract-multi-boundary');

    try {
      initRepo(docsOnlyRepo);
      writeIndex(docsOnlyRepo);
      seedBaseline(docsOnlyRepo);
      fs.writeFileSync(path.join(docsOnlyRepo, 'docs', 'guide.md'), '# updated guide\n');

      const docsOnlyResult = runCli(docsOnlyRepo, ['analyze-pr', '--json']);
      expect(docsOnlyResult.status).toBe(0);
      const docsPayload = parseJson(docsOnlyResult.stdout);
      expect(docsPayload.changedFiles).toEqual(['docs/guide.md']);
      expect(docsPayload.rules.related).toEqual(['PB001']);

      initRepo(sourceRepo);
      writeIndex(sourceRepo);
      seedBaseline(sourceRepo);
      fs.writeFileSync(path.join(sourceRepo, 'src', 'workouts', 'index.ts'), 'export const workouts = 2;\n');

      const sourceResult = runCli(sourceRepo, ['analyze-pr', '--json']);
      expect(sourceResult.status).toBe(0);
      const sourcePayload = parseJson(sourceResult.stdout);
      expect(sourcePayload.changedFiles).toEqual(['src/workouts/index.ts']);
      expect(sourcePayload.rules.related).toEqual(['notes.missing', 'requireNotesOnChanges', 'verify.rule.tests.required']);

      initRepo(multiBoundaryRepo);
      writeIndex(multiBoundaryRepo);
      seedBaseline(multiBoundaryRepo);
      fs.writeFileSync(path.join(multiBoundaryRepo, 'src', 'workouts', 'index.ts'), 'export const workouts = 2;\n');
      fs.writeFileSync(path.join(multiBoundaryRepo, 'docs', 'guide.md'), '# updated guide\n');

      const multiBoundaryResult = runCli(multiBoundaryRepo, ['analyze-pr', '--json']);
      expect(multiBoundaryResult.status).toBe(0);
      const multiBoundaryPayload = parseJson(multiBoundaryResult.stdout);
      expect(multiBoundaryPayload.architecture.boundariesTouched).toEqual(['docs', 'source']);
      expect(multiBoundaryPayload.rules.related).toEqual([
        'notes.missing',
        'PB001',
        'requireNotesOnChanges',
        'verify.rule.tests.required'
      ]);
    } finally {
      fs.rmSync(docsOnlyRepo, { recursive: true, force: true });
      fs.rmSync(sourceRepo, { recursive: true, force: true });
      fs.rmSync(multiBoundaryRepo, { recursive: true, force: true });
    }
  });

  it('keeps SCM edge-case behavior deterministic', () => {
    const detachedRepo = createRepo('playbook-analyze-pr-contract-detached');
    const mergeBaseHeadRepo = createRepo('playbook-analyze-pr-contract-merge-base-head');
    const missingBaseHistoryRepo = createRepo('playbook-analyze-pr-contract-missing-base-history');
    const renameRepo = createRepo('playbook-analyze-pr-contract-rename');

    try {
      initRepo(detachedRepo);
      writeIndex(detachedRepo);
      seedBaseline(detachedRepo);
      runGit(detachedRepo, ['checkout', '--detach']);
      fs.writeFileSync(path.join(detachedRepo, 'README.md'), '# detached update\n');

      const detachedResult = runCli(detachedRepo, ['analyze-pr', '--json']);
      expect(detachedResult.status).toBe(0);
      const detachedPayload = parseJson(detachedResult.stdout);
      expect(detachedPayload.changedFiles).toEqual(['README.md']);

      initRepo(mergeBaseHeadRepo);
      writeIndex(mergeBaseHeadRepo);
      seedBaseline(mergeBaseHeadRepo);
      fs.writeFileSync(path.join(mergeBaseHeadRepo, 'README.md'), '# baseline\n');
      runGit(mergeBaseHeadRepo, ['add', 'README.md']);
      runGit(mergeBaseHeadRepo, ['commit', '-m', 'main follow-up']);
      fs.writeFileSync(path.join(mergeBaseHeadRepo, 'README.md'), '# main dirty working tree\n');

      const mergeBaseHeadResult = runCli(mergeBaseHeadRepo, ['analyze-pr', '--json']);
      expect(mergeBaseHeadResult.status).toBe(0);
      const mergeBaseHeadPayload = parseJson(mergeBaseHeadResult.stdout);
      expect(mergeBaseHeadPayload.baseRef).toBe('HEAD~1');
      expect(mergeBaseHeadPayload.changedFiles).toEqual(['README.md']);

      initRepo(missingBaseHistoryRepo);
      writeIndex(missingBaseHistoryRepo);
      seedBaseline(missingBaseHistoryRepo);
      fs.writeFileSync(path.join(missingBaseHistoryRepo, 'README.md'), '# unresolved base\n');

      const missingBaseResult = runCli(missingBaseHistoryRepo, ['analyze-pr', '--json', '--base', 'origin/main']);
      expect(missingBaseResult.status).toBe(1);
      const missingBasePayload = JSON.parse(missingBaseResult.stdout.trim()) as { error: string };
      expect(missingBasePayload.error).toContain('unable to determine git diff from base "origin/main"');

      initRepo(renameRepo);
      writeIndex(renameRepo);
      seedBaseline(renameRepo);
      runGit(renameRepo, ['mv', 'src/workouts/legacy.ts', 'src/workouts/legacy-renamed.ts']);

      const renameResult = runCli(renameRepo, ['analyze-pr', '--json']);
      expect(renameResult.status).toBe(0);
      const renamePayload = parseJson(renameResult.stdout);
      expect(renamePayload.changedFiles).toEqual(['src/workouts/legacy-renamed.ts']);
    } finally {
      fs.rmSync(detachedRepo, { recursive: true, force: true });
      fs.rmSync(mergeBaseHeadRepo, { recursive: true, force: true });
      fs.rmSync(missingBaseHistoryRepo, { recursive: true, force: true });
      fs.rmSync(renameRepo, { recursive: true, force: true });
    }
  });

  it('fails deterministically in a non-git directory', () => {
    const nonGitDir = createRepo('playbook-analyze-pr-contract-non-git');

    try {
      writeIndex(nonGitDir);
      fs.mkdirSync(path.join(nonGitDir, 'docs'), { recursive: true });
      fs.writeFileSync(path.join(nonGitDir, 'docs', 'guide.md'), '# guide\n');

      const result = runCli(nonGitDir, ['analyze-pr', '--json']);
      expect(result.status).toBe(1);
      const payload = JSON.parse(result.stdout.trim()) as { error: string };
      expect(payload.error).toBe('playbook analyze-pr: git diff is unavailable because this directory is not a git repository.');
    } finally {
      fs.rmSync(nonGitDir, { recursive: true, force: true });
    }
  });

  it('falls back to HEAD~1 when merge-base equals HEAD on main with unstaged changes', () => {
    const repo = createRepo('playbook-analyze-pr-contract-head-fallback');

    try {
      initRepo(repo);
      writeIndex(repo);
      seedBaseline(repo);
      fs.writeFileSync(path.join(repo, 'README.md'), '# committed\n');
      runGit(repo, ['add', 'README.md']);
      runGit(repo, ['commit', '-m', 'add readme']);

      fs.writeFileSync(path.join(repo, 'README.md'), '# unstaged\n');

      const result = runCli(repo, ['analyze-pr', '--json']);
      expect(result.status).toBe(0);
      const payload = parseJson(result.stdout);
      expect(payload.baseRef).toBe('HEAD~1');
      expect(payload.changedFiles).toEqual(['README.md']);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it('keeps explicit-base failure deterministic for shallow clone/missing base history scenarios', () => {
    const upstream = createRepo('playbook-analyze-pr-contract-upstream');
    const shallowClone = createRepo('playbook-analyze-pr-contract-shallow-clone');

    try {
      initRepo(upstream);
      writeIndex(upstream);
      seedBaseline(upstream);
      fs.writeFileSync(path.join(upstream, 'src', 'auth', 'index.ts'), 'export const auth = 2;\n');
      runGit(upstream, ['add', '.']);
      runGit(upstream, ['commit', '-m', 'upstream update']);
      runGit(upstream, ['checkout', '-b', 'feature/contract']);
      fs.writeFileSync(path.join(upstream, 'README.md'), '# feature branch\n');
      runGit(upstream, ['add', 'README.md']);
      runGit(upstream, ['commit', '-m', 'feature change']);

      runGit(path.dirname(shallowClone), ['clone', '--depth', '1', '--branch', 'feature/contract', `file://${upstream}`, shallowClone]);
      runGit(shallowClone, ['config', 'user.email', 'bot@example.com']);
      runGit(shallowClone, ['config', 'user.name', 'Playbook Bot']);
      fs.writeFileSync(path.join(shallowClone, 'README.md'), '# shallow change\n');

      const result = runCli(shallowClone, ['analyze-pr', '--json', '--base', 'origin/main']);
      expect(result.status).toBe(1);
      const payload = JSON.parse(result.stdout.trim()) as { error: string };
      expect(payload.error).toContain('unable to determine git diff from base "origin/main"');
    } finally {
      fs.rmSync(upstream, { recursive: true, force: true });
      fs.rmSync(shallowClone, { recursive: true, force: true });
    }
  });

  it('handles rename-heavy diffs deterministically', () => {
    const repo = createRepo('playbook-analyze-pr-contract-rename-heavy');

    try {
      initRepo(repo);
      writeIndex(repo);
      seedBaseline(repo);
      fs.writeFileSync(path.join(repo, 'src', 'workouts', 'another.ts'), 'export const another = 1;\n');
      runGit(repo, ['add', '.']);
      runGit(repo, ['commit', '-m', 'add rename candidates']);

      runGit(repo, ['mv', 'src/workouts/legacy.ts', 'src/workouts/legacy-renamed.ts']);
      runGit(repo, ['mv', 'src/workouts/another.ts', 'src/workouts/another-renamed.ts']);

      const result = runCli(repo, ['analyze-pr', '--json']);
      expect(result.status).toBe(0);
      const payload = parseJson(result.stdout);
      expect(payload.changedFiles).toEqual([
        'src/workouts/another-renamed.ts',
        'src/workouts/another.ts',
        'src/workouts/legacy-renamed.ts'
      ]);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it('keeps json/github-comment/github-review output contracts stable', () => {
    const repo = createRepo('playbook-analyze-pr-contract-formats');

    try {
      initRepo(repo);
      writeIndex(repo);
      seedBaseline(repo);
      fs.writeFileSync(path.join(repo, 'src', 'workouts', 'index.ts'), 'export const workouts = 3;\n');

      const jsonResult = runCli(repo, ['analyze-pr', '--json']);
      expect(jsonResult.status).toBe(0);
      const jsonPayload = parseJson(jsonResult.stdout);
      expect(jsonPayload.command).toBe('analyze-pr');

      const commentResult = runCli(repo, ['analyze-pr', '--format', 'github-comment']);
      expect(commentResult.status).toBe(0);
      expect(commentResult.stdout).toContain('## 🧠 Playbook PR Analysis');

      const reviewResult = runCli(repo, ['analyze-pr', '--format', 'github-review']);
      expect(reviewResult.status).toBe(0);
      const reviewPayload = JSON.parse(reviewResult.stdout.trim()) as Array<{ path: string; line: number; body: string }>;
      expect(Array.isArray(reviewPayload)).toBe(true);
      expect(reviewPayload.every((annotation) => typeof annotation.path === 'string')).toBe(true);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });
});
