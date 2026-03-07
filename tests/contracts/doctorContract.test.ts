import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

type DoctorPayload = {
  schemaVersion: '1.0';
  command: 'doctor';
  status: 'ok' | 'warning' | 'error';
  summary: {
    errors: number;
    warnings: number;
    info: number;
  };
  findings: Array<{
    category: 'Architecture' | 'Docs' | 'Testing' | 'Risk';
    severity: 'error' | 'warning' | 'info';
    id: string;
    message: string;
  }>;
};

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const cliEntry = path.join(repoRoot, 'packages', 'cli', 'dist', 'main.js');

const runCli = (cwd: string, args: string[]): ReturnType<typeof spawnSync> =>
  spawnSync(process.execPath, [cliEntry, ...args], {
    cwd,
    encoding: 'utf8'
  });

const createFixtureRepo = (withDocsError: boolean): string => {
  // Fixture intent:
  // - withDocsError=false: indexed baseline fixture (may still contain deterministic findings).
  // - withDocsError=true: intentionally produces doctor error findings via docs audit violations.
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-doctor-contract-'));

  fs.writeFileSync(path.join(repo, 'package.json'), JSON.stringify({ name: 'playbook-doctor-contract' }, null, 2));
  fs.mkdirSync(path.join(repo, 'src', 'app'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'src', 'app', 'index.ts'), 'export const app = true;\n');

  if (withDocsError) {
    fs.mkdirSync(path.join(repo, 'docs'), { recursive: true });
    fs.writeFileSync(
      path.join(repo, 'docs', 'PLAYBOOK_IMPROVEMENTS.md'),
      '# Improvements\n\nThis intentionally omits required Playbook anchors for contract coverage.\n'
    );
  }

  return repo;
};

const parseDoctorPayload = (stdout: string): DoctorPayload => {
  const trimmed = stdout.trim();
  expect(trimmed, 'doctor --json should emit a JSON payload even when signaling non-clean repo health').not.toBe('');
  return JSON.parse(trimmed) as DoctorPayload;
};

const assertDoctorExitSemantics = (payload: DoctorPayload, exitCode: number | null): void => {
  // doctor uses process exit code as diagnostic signaling, not only runtime failure signaling.
  // Execution can be successful while still returning exit=1 when error-severity findings exist.
  const expectedExitCode = payload.summary.errors > 0 ? 1 : 0;
  expect(
    exitCode,
    `doctor process exit mismatch: expected ${expectedExitCode} from summary.errors=${payload.summary.errors} (status=${payload.status}), received ${String(exitCode)}`
  ).toBe(expectedExitCode);

  const expectedStatus = payload.summary.errors > 0 ? 'error' : payload.summary.warnings > 0 ? 'warning' : 'ok';
  expect(payload.status).toBe(expectedStatus);
};

describe('doctor contract', () => {
  it('maps an indexed fixture to deterministic JSON contract and severity-driven exit semantics', () => {
    const fixtureRepo = createFixtureRepo(false);

    try {
      const indexResult = runCli(fixtureRepo, ['index', '--json']);
      expect(indexResult.status).toBe(0);

      const result = runCli(fixtureRepo, ['doctor', '--json']);
      const payload = parseDoctorPayload(result.stdout);

      expect(payload).toMatchObject({
        schemaVersion: '1.0',
        command: 'doctor'
      });
      expect(Array.isArray(payload.findings)).toBe(true);
      assertDoctorExitSemantics(payload, result.status);
    } finally {
      fs.rmSync(fixtureRepo, { recursive: true, force: true });
    }
  });

  it('maps an error fixture to exit=1 while preserving JSON diagnostics contract', () => {
    const fixtureRepo = createFixtureRepo(true);

    try {
      const indexResult = runCli(fixtureRepo, ['index', '--json']);
      expect(indexResult.status).toBe(0);

      const result = runCli(fixtureRepo, ['doctor', '--json']);
      const payload = parseDoctorPayload(result.stdout);

      expect(payload).toMatchObject({
        schemaVersion: '1.0',
        command: 'doctor'
      });
      assertDoctorExitSemantics(payload, result.status);
      expect(payload.summary.errors).toBeGreaterThan(0);
      expect(payload.findings.some((finding) => finding.severity === 'error')).toBe(true);
    } finally {
      fs.rmSync(fixtureRepo, { recursive: true, force: true });
    }
  });
});
