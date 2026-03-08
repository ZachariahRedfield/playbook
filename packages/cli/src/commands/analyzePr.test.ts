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
    expect(Array.isArray(payload.findings)).toBe(true);
    expect(Array.isArray(payload.reviewGuidance)).toBe(true);

    logSpy.mockRestore();
  });


  it('renders GitHub comment markdown when --format github-comment is provided', async () => {
    const repo = createRepo('playbook-cli-analyze-pr-github-comment');
    initGitRepo(repo);
    writeRepoIndex(repo);

    fs.mkdirSync(path.join(repo, 'src', 'auth'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'src', 'auth', 'index.ts'), 'export const auth = 1;\n');
    runGit(repo, ['add', '.']);
    runGit(repo, ['commit', '-m', 'initial']);

    fs.mkdirSync(path.join(repo, 'src', 'workouts'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'src', 'workouts', 'index.ts'), 'export const workouts = 2;\n');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runAnalyzePr(repo, ['--format', 'github-comment'], { format: 'github-comment', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const output = String(logSpy.mock.calls[0]?.[0]);
    expect(output).toContain('## 🧠 Playbook PR Analysis');
    expect(output).toContain('### Affected Modules');
    expect(output).toContain('### Governance Findings');

    logSpy.mockRestore();
  });



  it('renders GitHub review diagnostics JSON when --format github-review is provided', async () => {
    const repo = createRepo('playbook-cli-analyze-pr-github-review');
    initGitRepo(repo);
    writeRepoIndex(repo);

    fs.mkdirSync(path.join(repo, 'src', 'auth'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'src', 'auth', 'index.ts'), 'export const auth = 1;\n');
    runGit(repo, ['add', '.']);
    runGit(repo, ['commit', '-m', 'initial']);

    fs.mkdirSync(path.join(repo, 'src', 'workouts'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'src', 'workouts', 'index.ts'), 'export const workouts = 2;\n');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runAnalyzePr(repo, ['--format', 'github-review'], { format: 'github-review', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const output = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(Array.isArray(output)).toBe(true);

    logSpy.mockRestore();
  });

  it('renders text summary when --format text is provided', async () => {
    const repo = createRepo('playbook-cli-analyze-pr-text');
    initGitRepo(repo);
    writeRepoIndex(repo);

    fs.mkdirSync(path.join(repo, 'src', 'auth'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'src', 'auth', 'index.ts'), 'export const auth = 1;\n');
    runGit(repo, ['add', '.']);
    runGit(repo, ['commit', '-m', 'initial']);

    fs.mkdirSync(path.join(repo, 'src', 'workouts'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'src', 'workouts', 'index.ts'), 'export const workouts = 2;\n');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runAnalyzePr(repo, ['--format', 'text'], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const output = String(logSpy.mock.calls[0]?.[0]);
    expect(output).toContain('Playbook Pull Request Analysis');
    expect(output).toContain('Changed files');

    logSpy.mockRestore();
  });

  it('fails with deterministic message for unsupported --format values', async () => {
    const repo = createRepo('playbook-cli-analyze-pr-invalid-format');
    initGitRepo(repo);
    writeRepoIndex(repo);

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const exitCode = await runAnalyzePr(repo, ['--format', 'markdown'], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Failure);
    expect(String(errorSpy.mock.calls[0]?.[0])).toContain('Unsupported analyze-pr format "markdown"');

    errorSpy.mockRestore();
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



  it('scopes related rules for docs-only diffs to avoid repo-wide governance noise', async () => {
    const repo = createRepo('playbook-cli-analyze-pr-docs-only');
    initGitRepo(repo);

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
          modules: [{ name: 'workouts', dependencies: [] }],
          database: 'postgres',
          rules: ['PB001', 'requireNotesOnChanges', 'verify.rule.tests.required']
        },
        null,
        2
      )
    );

    fs.mkdirSync(path.join(repo, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'docs', 'guide.md'), '# guide\n');
    runGit(repo, ['add', '.']);
    runGit(repo, ['commit', '-m', 'initial']);

    fs.writeFileSync(path.join(repo, 'docs', 'guide.md'), '# updated guide\n');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runAnalyzePr(repo, ['--json'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.rules.related).toEqual(['PB001']);

    logSpy.mockRestore();
  });

  it('handles detached HEAD deterministically', async () => {
    const repo = createRepo('playbook-cli-analyze-pr-detached-head');
    initGitRepo(repo);
    writeRepoIndex(repo);

    fs.mkdirSync(path.join(repo, 'src', 'auth'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'src', 'auth', 'index.ts'), 'export const auth = 1;\n');
    runGit(repo, ['add', '.']);
    runGit(repo, ['commit', '-m', 'initial']);
    runGit(repo, ['checkout', '--detach']);

    fs.writeFileSync(path.join(repo, 'README.md'), '# detached change\n');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runAnalyzePr(repo, ['--json'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.command).toBe('analyze-pr');
    expect(payload.summary.changedFileCount).toBeGreaterThan(0);

    logSpy.mockRestore();
  });



  it('reports multi-boundary PRs with deterministic boundary summary', async () => {
    const repo = createRepo('playbook-cli-analyze-pr-multi-boundary');
    initGitRepo(repo);
    writeRepoIndex(repo);

    fs.mkdirSync(path.join(repo, 'src', 'auth'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'src', 'auth', 'index.ts'), 'export const auth = 1;\n');
    fs.mkdirSync(path.join(repo, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'docs', 'guide.md'), '# guide\n');
    runGit(repo, ['add', '.']);
    runGit(repo, ['commit', '-m', 'initial']);

    fs.writeFileSync(path.join(repo, 'src', 'auth', 'index.ts'), 'export const auth = 2;\n');
    fs.writeFileSync(path.join(repo, 'docs', 'guide.md'), '# updated guide\n');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runAnalyzePr(repo, ['--json'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.architecture.boundariesTouched).toEqual(['docs', 'source']);

    logSpy.mockRestore();
  });

  it('fails deterministically when an explicit base ref cannot be resolved', async () => {
    const repo = createRepo('playbook-cli-analyze-pr-missing-base');
    initGitRepo(repo);
    writeRepoIndex(repo);

    fs.mkdirSync(path.join(repo, 'src', 'auth'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'src', 'auth', 'index.ts'), 'export const auth = 1;\n');
    runGit(repo, ['add', '.']);
    runGit(repo, ['commit', '-m', 'initial']);

    fs.writeFileSync(path.join(repo, 'README.md'), '# shallow-like base failure\n');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runAnalyzePr(repo, ['--json', '--base', 'origin/main'], { format: 'json', quiet: false, baseRef: 'origin/main' });

    expect(exitCode).toBe(ExitCode.Failure);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.error).toContain('unable to determine git diff from base "origin/main"');

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
