import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..');
const cliEntry = path.join(repoRoot, 'packages', 'cli', 'dist', 'main.js');

function createFixtureRepo(): string {
  const fixtureRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-external-repo-'));

  fs.writeFileSync(path.join(fixtureRepo, 'package.json'), JSON.stringify({ name: 'external-repo-fixture' }, null, 2));
  fs.mkdirSync(path.join(fixtureRepo, 'src', 'features', 'workouts'), { recursive: true });
  fs.mkdirSync(path.join(fixtureRepo, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(fixtureRepo, 'src', 'features', 'workouts', 'index.ts'), 'export const workouts = true;\n');
  fs.writeFileSync(path.join(fixtureRepo, 'docs', 'ARCHITECTURE.md'), '# Architecture\n');
  fs.writeFileSync(path.join(fixtureRepo, 'docs', 'CHANGELOG.md'), '# Changelog\n');
  fs.writeFileSync(path.join(fixtureRepo, 'docs', 'PLAYBOOK_CHECKLIST.md'), '# Checklist\n');
  fs.writeFileSync(path.join(fixtureRepo, 'docs', 'PLAYBOOK_NOTES.md'), '# Playbook Notes\n\n- Fixture notes.\n');
  fs.writeFileSync(path.join(fixtureRepo, 'playbook.config.json'), JSON.stringify({ version: 1 }, null, 2));

  return fixtureRepo;
}

function runCli(args: readonly string[]) {
  return spawnSync(process.execPath, [cliEntry, ...args], {
    cwd: repoRoot,
    encoding: 'utf8'
  });
}

describe('external repo bootstrap', () => {
  let fixtureRepo = '';

  beforeAll(() => {
    fixtureRepo = createFixtureRepo();
  });

  afterAll(() => {
    if (fixtureRepo) {
      fs.rmSync(fixtureRepo, { recursive: true, force: true });
    }
  });

  it('supports running commands against a target repo with --repo', { timeout: 45000 }, () => {
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
    fs.writeFileSync(path.join(fixtureRepo, '.playbook', 'plan.json'), plan.stdout);

    const query = runCli(['--repo', fixtureRepo, 'query', 'modules', '--json']);
    expect(query.status).toBe(0);
    expect(query.stdout).toContain('"command": "query"');
    expect(query.stdout).toContain('"modules"');
  });

  it('proves bootstrap readiness and surfaces execution-state failures clearly', { timeout: 45000 }, () => {
    const before = fs.existsSync(path.join(fixtureRepo, '.playbook', 'policy-apply-result.json'));
    expect(before).toBe(false);

    const plan = runCli([`--repo=${fixtureRepo}`, 'plan', '--json']);
    expect(plan.status).toBe(0);
    fs.writeFileSync(path.join(fixtureRepo, '.playbook', 'plan.json'), plan.stdout);

    const reportProof = runCli(['--repo', fixtureRepo, 'status', 'proof', '--json']);
    expect(reportProof.status).toBe(0);
    const reportPayload = JSON.parse(reportProof.stdout);
    expect(reportPayload.mode).toBe('proof');
    expect(reportPayload.proof.current_state).toBe('execution_state_blocked');

    const failingProof = runCli(['--repo', fixtureRepo, 'status', 'proof', '--proof-gate', '--json']);
    expect(failingProof.status).toBe(1);
    const failingPayload = JSON.parse(failingProof.stdout);
    expect(failingPayload.mode).toBe('proof');
    expect(failingPayload.proof.current_state).toBe('execution_state_blocked');
    expect(failingPayload.proof.diagnostics.failing_stage).toBe('execution-state');

    fs.writeFileSync(path.join(fixtureRepo, '.playbook', 'policy-apply-result.json'), JSON.stringify({ ok: true }, null, 2));

    const passingProof = runCli(['--repo', fixtureRepo, 'status', 'proof', '--proof-gate', '--json']);
    expect(passingProof.status).toBe(0);
    const passingPayload = JSON.parse(passingProof.stdout);
    expect(passingPayload.proof.ok).toBe(true);
    expect(passingPayload.proof.current_state).toBe('governed_consumer_ready');
  });

});
