import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveRepositoryTarget } from '../src/intelligence/targetResolver.js';

const createRepo = (name: string): string => fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));

const writeRepoIndex = (repo: string, payload: Record<string, unknown>): void => {
  const indexPath = path.join(repo, '.playbook', 'repo-index.json');
  fs.mkdirSync(path.dirname(indexPath), { recursive: true });
  fs.writeFileSync(indexPath, JSON.stringify(payload, null, 2));
};

describe('resolveRepositoryTarget', () => {
  it('resolves bare and explicit module targets for indexed feature modules', () => {
    const repo = createRepo('playbook-target-resolver-modules');
    writeRepoIndex(repo, {
      schemaVersion: '1.0',
      framework: 'node',
      language: 'typescript',
      architecture: 'modular-monolith',
      modules: [{ name: 'users', dependencies: [] }, { name: 'workouts', dependencies: ['users'] }],
      database: 'none',
      rules: ['PB001']
    });

    expect(resolveRepositoryTarget(repo, 'workouts')).toEqual({
      input: 'workouts',
      kind: 'module',
      selector: 'workouts',
      canonical: 'module:workouts',
      matched: true
    });

    expect(resolveRepositoryTarget(repo, 'module:workouts')).toEqual({
      input: 'module:workouts',
      kind: 'module',
      selector: 'workouts',
      canonical: 'module:workouts',
      matched: true
    });
  });
});
