import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { RepositoryIndex } from '../src/indexer/repoIndexer.js';
import { generateRepositoryGraph } from '../src/graph/repoGraph.js';
import { buildModuleContextDigests, readModuleContextDigest, writeModuleContextDigests } from '../src/context/moduleContext.js';

const createRepo = (name: string): string => fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));

const sampleIndex: RepositoryIndex = {
  schemaVersion: '1.0',
  framework: 'node',
  language: 'typescript',
  architecture: 'modular-monolith',
  modules: [
    { name: 'auth', dependencies: [] },
    { name: 'workouts', dependencies: ['auth'] }
  ],
  database: 'none',
  rules: ['PB001']
};

describe('module context digest', () => {
  it('builds deterministic compressed module digests', () => {
    const repo = createRepo('playbook-module-context');
    fs.mkdirSync(path.join(repo, 'src', 'features', 'auth'), { recursive: true });
    fs.mkdirSync(path.join(repo, 'src', 'features', 'workouts'), { recursive: true });
    fs.mkdirSync(path.join(repo, 'docs'), { recursive: true });
    fs.mkdirSync(path.join(repo, '.playbook'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'src', 'features', 'auth', 'index.ts'), 'export const auth = true;\n');
    fs.writeFileSync(path.join(repo, 'src', 'features', 'workouts', 'index.ts'), 'import { auth } from "../auth";\nexport const workouts = auth;\n');
    fs.writeFileSync(path.join(repo, 'docs', 'auth.md'), '# auth\n');
    fs.writeFileSync(path.join(repo, '.playbook', 'verify-report.json'), JSON.stringify({ failures: [] }, null, 2));
    fs.writeFileSync(path.join(repo, '.playbook', 'repo-index.json'), JSON.stringify(sampleIndex, null, 2));

    const graph = generateRepositoryGraph(sampleIndex, new Date('2026-01-01T00:00:00.000Z'));
    const digests = buildModuleContextDigests(repo, sampleIndex, graph, new Date('2026-01-01T00:00:00.000Z'));

    expect(digests[0]).toMatchObject({
      schemaVersion: '1.0',
      kind: 'playbook-module-context-digest',
      module: {
        name: 'auth',
        type: 'module'
      },
      dependencies: [],
      directDependents: ['workouts']
    });
  });

  it('writes and reads module digest artifacts', () => {
    const repo = createRepo('playbook-module-context-write');
    fs.mkdirSync(path.join(repo, '.playbook'), { recursive: true });
    fs.writeFileSync(path.join(repo, '.playbook', 'verify-report.json'), JSON.stringify({ failures: [] }, null, 2));
    fs.writeFileSync(path.join(repo, '.playbook', 'repo-index.json'), JSON.stringify(sampleIndex, null, 2));
    const graph = generateRepositoryGraph(sampleIndex, new Date('2026-01-01T00:00:00.000Z'));
    const digests = buildModuleContextDigests(repo, sampleIndex, graph, new Date('2026-01-01T00:00:00.000Z'));

    writeModuleContextDigests(repo, digests);

    const digest = readModuleContextDigest(repo, 'auth');
    expect(digest?.module.name).toBe('auth');
    expect(readModuleContextDigest(repo, 'unknown')).toBeNull();
  });
});
