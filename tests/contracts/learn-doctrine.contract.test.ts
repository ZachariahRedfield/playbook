import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

type LearnDoctrinePayload = {
  schemaVersion: '1.0';
  command: 'learn-doctrine';
  mode: 'report-only';
  source: { inputPath?: string; changedFiles: string[] };
  conciseChangeSummary: string[];
  learned: {
    rules: Array<{ statement: string }>;
    patterns: Array<{ statement: string }>;
    failureModes: Array<{ statement: string }>;
  };
  suggestedNotesUpdate: Array<{ summary: string }>;
  candidateFutureChecks: Array<{ name: string }>;
};

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const cliEntry = path.join(repoRoot, 'packages', 'cli', 'dist', 'main.js');
const fixturePath = path.join(repoRoot, 'tests', 'contracts', 'fixtures', 'doctrine-extraction-summary.json');

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

describe('learn doctrine contract', () => {
  it('extracts seeded doctrine without mutating the repo in report-only mode', () => {
    const repo = createRepo('playbook-learn-doctrine-contract');

    try {
      initRepo(repo);
      fs.writeFileSync(path.join(repo, 'README.md'), '# doctrine test\n');
      runGit(repo, ['add', '.']);
      runGit(repo, ['commit', '-m', 'baseline']);

      const result = runCli(repo, ['learn', 'doctrine', '--input', fixturePath, '--json']);
      expect(result.status).toBe(0);

      const payload = JSON.parse(result.stdout.trim()) as LearnDoctrinePayload;
      expect(payload.command).toBe('learn-doctrine');
      expect(payload.mode).toBe('report-only');
      expect(payload.learned.rules.map((entry) => entry.statement)).toContain(
        'Durable workflow outputs must expose normalized staged-promotion metadata when they write repo-visible state.'
      );
      expect(payload.learned.patterns.map((entry) => entry.statement)).toContain(
        'Shared aggregation boundary for reads, targeted invalidation boundary for writes.'
      );
      expect(payload.learned.failureModes.map((entry) => entry.statement)).toContain(
        'Writing or validating committed outputs too early causes false failures, drift, and unsafe partial promotion.'
      );

      const statusOutput = runGit(repo, ['status', '--short']);
      expect(statusOutput).toBe('');
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });
});
