import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

type LearnDraftPayload = {
  schemaVersion: '1.0';
  command: 'learn-draft';
  baseRef: string;
  baseSha: string;
  headSha: string;
  diffContext: boolean;
  changedFiles: string[];
  candidates: Array<{
    candidateId: string;
    theme: string;
    evidence: Array<{ path: string }>;
    dedupe: { kind: 'none' };
  }>;
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
        modules: [{ name: 'workouts', dependencies: [] }],
        database: 'postgres',
        rules: ['PB001']
      },
      null,
      2
    )
  );
};

describe('learn draft contract', () => {
  it('fails deterministically when repository intelligence index is missing', () => {
    const repo = createRepo('playbook-learn-draft-contract-no-index');

    try {
      initRepo(repo);
      fs.writeFileSync(path.join(repo, 'README.md'), '# draft\n');

      const result = runCli(repo, ['learn', 'draft', '--json']);
      expect(result.status).toBe(1);
      const payload = JSON.parse(result.stdout.trim()) as { error: string };
      expect(payload.error).toBe(
        'playbook learn draft: missing repository index at .playbook/repo-index.json. Run "playbook index" first.'
      );
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it('writes deterministic candidates artifact and supports appending notes', () => {
    const repo = createRepo('playbook-learn-draft-contract-happy-path');

    try {
      initRepo(repo);
      writeIndex(repo);
      fs.mkdirSync(path.join(repo, 'packages', 'engine', 'src'), { recursive: true });
      fs.writeFileSync(path.join(repo, 'packages', 'engine', 'src', 'index.ts'), 'export const value = 1;\n');
      runGit(repo, ['add', '.']);
      runGit(repo, ['commit', '-m', 'baseline']);

      fs.writeFileSync(path.join(repo, 'packages', 'engine', 'src', 'index.ts'), 'export const value = 2;\n');

      const result = runCli(repo, ['learn', 'draft', '--json', '--append-notes']);
      expect(result.status).toBe(0);
      const payload = JSON.parse(result.stdout.trim()) as LearnDraftPayload;
      expect(payload.command).toBe('learn-draft');
      expect(payload.changedFiles).toEqual(['packages/engine/src/index.ts']);
      expect(payload.candidates.length).toBeGreaterThan(0);
      expect(payload.candidates[0]?.dedupe.kind).toBe('none');

      const artifactPath = path.join(repo, '.playbook', 'knowledge', 'candidates.json');
      expect(fs.existsSync(artifactPath)).toBe(true);

      const notesPath = path.join(repo, 'docs', 'PLAYBOOK_NOTES.md');
      expect(fs.existsSync(notesPath)).toBe(true);
      const notes = fs.readFileSync(notesPath, 'utf8');
      expect(notes).toContain('## Learn Draft');
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });
});
