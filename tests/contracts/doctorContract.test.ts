import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const cliEntry = path.join(repoRoot, 'packages', 'cli', 'dist', 'main.js');

const createFixtureRepo = (): string => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-doctor-contract-'));

  fs.writeFileSync(path.join(repo, 'package.json'), JSON.stringify({ name: 'playbook-doctor-contract' }, null, 2));
  fs.mkdirSync(path.join(repo, 'src', 'app'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'src', 'app', 'index.ts'), 'export const app = true;\n');

  return repo;
};

describe('doctor contract', () => {
  it('emits stable diagnosis envelope', () => {
    const fixtureRepo = createFixtureRepo();

    try {
      const indexResult = spawnSync(process.execPath, [cliEntry, 'index', '--json'], {
        cwd: fixtureRepo,
        encoding: 'utf8'
      });
      expect(indexResult.status).toBe(0);

      const result = spawnSync(process.execPath, [cliEntry, 'doctor', '--json'], {
        cwd: fixtureRepo,
        encoding: 'utf8'
      });

      expect([0, 1]).toContain(result.status);
      const payload = JSON.parse(result.stdout);
      expect(payload).toMatchObject({
        schemaVersion: '1.0',
        command: 'doctor'
      });
      expect(['ok', 'warning', 'error']).toContain(payload.status);
      expect(payload.summary).toEqual(
        expect.objectContaining({
          errors: expect.any(Number),
          warnings: expect.any(Number),
          info: expect.any(Number)
        })
      );
      expect(Array.isArray(payload.findings)).toBe(true);
    } finally {
      fs.rmSync(fixtureRepo, { recursive: true, force: true });
    }
  });
});
