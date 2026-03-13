import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..');
const cliEntry = path.join(repoRoot, 'packages', 'cli', 'dist', 'main.js');

const runCli = (cwd: string, args: string[]) =>
  spawnSync(process.execPath, [cliEntry, ...args], {
    cwd,
    encoding: 'utf8'
  });

const parseJson = (stdout: string): Record<string, unknown> => {
  const trimmed = stdout.trim();
  expect(trimmed).not.toBe('');

  return JSON.parse(trimmed) as Record<string, unknown>;
};

const createFixtureRepo = (): string => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-query-risk-contract-'));

  fs.mkdirSync(path.join(repo, 'src', 'auth'), { recursive: true });
  fs.mkdirSync(path.join(repo, 'src', 'workouts'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'package.json'), JSON.stringify({ name: 'playbook-query-risk-contract' }, null, 2));
  fs.writeFileSync(path.join(repo, 'src', 'auth', 'index.ts'), 'export const auth = true;\n');
  fs.writeFileSync(
    path.join(repo, 'src', 'workouts', 'index.ts'),
    "import { auth } from '../auth';\nexport const workouts = auth;\n"
  );

  return repo;
};

describe('query risk index-backed contract checks', () => {
  let fixtureRepo = '';

  beforeAll(() => {
    fixtureRepo = createFixtureRepo();
    const indexResult = runCli(fixtureRepo, ['index', '--json']);
    expect(indexResult.status).toBe(0);
    const indexPayload = parseJson(indexResult.stdout);
    expect(indexPayload.command).toBe('index');
    expect(indexPayload.ok).toBe(true);
  });

  afterAll(() => {
    if (fixtureRepo) {
      fs.rmSync(fixtureRepo, { recursive: true, force: true });
    }
  });

  it('validates indexed success contract output from built CLI', () => {
    const riskSuccess = runCli(fixtureRepo, ['query', 'risk', 'auth', '--json']);
    expect(riskSuccess.status).toBe(0);
    const successPayload = parseJson(riskSuccess.stdout);
    expect(successPayload).toMatchObject({
      schemaVersion: '1.0',
      command: 'query',
      type: 'risk',
      module: 'auth',
      signals: {
        dependents: 1
      }
    });
    expect(typeof successPayload.riskScore).toBe('number');
  });

  it('validates deterministic missing-target and missing-argument failures', () => {
    const riskMissing = runCli(fixtureRepo, ['query', 'risk', 'missing', '--json']);
    expect(riskMissing.status).toBe(1);
    const missingPayload = parseJson(riskMissing.stdout);
    expect(missingPayload).toEqual({
      schemaVersion: '1.0',
      command: 'query',
      type: 'risk',
      module: 'missing',
      error: 'playbook query risk: unknown module "missing".'
    });

    const riskMissingArg = runCli(fixtureRepo, ['query', 'risk', '--json']);
    expect(riskMissingArg.status).toBe(1);
    const missingArgPayload = parseJson(riskMissingArg.stdout);
    expect(missingArgPayload).toEqual({
      schemaVersion: '1.0',
      command: 'query',
      type: 'risk',
      module: null,
      error: 'playbook query risk: missing required <module> argument'
    });
  });
});
