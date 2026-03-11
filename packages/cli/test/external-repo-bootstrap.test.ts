import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..');
const cliEntry = path.join(repoRoot, 'packages', 'cli', 'dist', 'main.js');

function createFixtureRepo(): string {
  const fixtureRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-external-repo-'));

  fs.writeFileSync(path.join(fixtureRepo, 'package.json'), JSON.stringify({ name: 'external-repo-fixture' }, null, 2));
  fs.mkdirSync(path.join(fixtureRepo, 'src', 'features', 'workouts'), { recursive: true });
  fs.mkdirSync(path.join(fixtureRepo, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(fixtureRepo, 'src', 'features', 'workouts', 'index.ts'), 'export const workouts = true;\n');
  fs.writeFileSync(path.join(fixtureRepo, 'docs', 'PLAYBOOK_NOTES.md'), '# Playbook Notes\n\n- Fixture notes.\n');

  return fixtureRepo;
}

function runCli(args: readonly string[]) {
  return spawnSync(process.execPath, [cliEntry, ...args], {
    cwd: repoRoot,
    encoding: 'utf8'
  });
}

describe('external repo bootstrap', () => {
  it('supports running commands against a target repo with --repo', () => {
    const fixtureRepo = createFixtureRepo();

    try {
      const context = runCli(['--repo', fixtureRepo, 'context', '--json']);
      expect(context.status).toBe(0);
      expect(context.stdout).toContain('"command": "context"');

      const index = runCli(['--repo', fixtureRepo, 'index', '--json']);
      expect(index.status).toBe(0);
      expect(index.stdout).toContain('"command": "index"');
      expect(fs.existsSync(path.join(fixtureRepo, '.playbook', 'repo-index.json'))).toBe(true);
      expect(fs.existsSync(path.join(fixtureRepo, '.playbook', 'repo-graph.json'))).toBe(true);

      const verify = runCli(['--repo', fixtureRepo, 'verify', '--json']);
      expect(verify.status).toBe(0);
      expect(verify.stdout).toContain('"command": "verify"');

      const plan = runCli([`--repo=${fixtureRepo}`, 'plan', '--json']);
      expect(plan.status).toBe(0);
      expect(plan.stdout).toContain('"command": "plan"');

      const query = runCli(['--repo', fixtureRepo, 'query', 'modules', '--json']);
      expect(query.status).toBe(0);
      expect(query.stdout).toContain('"command": "query"');
      expect(query.stdout).toContain('"modules"');
    } finally {
      fs.rmSync(fixtureRepo, { recursive: true, force: true });
    }
  });
});
