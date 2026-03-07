import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { generateRepositoryGraph, readRepositoryGraph, summarizeRepositoryGraph } from '../src/graph/repoGraph.js';
import type { RepositoryIndex } from '../src/indexer/repoIndexer.js';

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

describe('repository graph', () => {
  it('generates deterministic graph scaffold from index data', () => {
    const graph = generateRepositoryGraph(sampleIndex, new Date('2026-01-01T00:00:00.000Z'));

    expect(graph).toEqual({
      schemaVersion: '1.0',
      kind: 'playbook-repo-graph',
      generatedAt: '2026-01-01T00:00:00.000Z',
      nodes: [
        { id: 'module:auth', kind: 'module', name: 'auth' },
        { id: 'module:workouts', kind: 'module', name: 'workouts' },
        { id: 'rule:PB001', kind: 'rule', name: 'PB001' }
      ],
      edges: [
        { kind: 'depends_on', from: 'module:workouts', to: 'module:auth' }
      ],
      stats: {
        nodeCount: 3,
        edgeCount: 1
      }
    });
  });

  it('summarizes graph with kinds and dependency hubs', () => {
    const graph = generateRepositoryGraph(sampleIndex, new Date('2026-01-01T00:00:00.000Z'));

    expect(summarizeRepositoryGraph(graph)).toEqual({
      schemaVersion: '1.0',
      kind: 'playbook-repo-graph',
      generatedAt: '2026-01-01T00:00:00.000Z',
      stats: { nodeCount: 3, edgeCount: 1 },
      nodeKinds: ['module', 'rule'],
      edgeKinds: ['depends_on'],
      topDependencyHubs: [
        { module: 'auth', incomingDependencies: 1 },
        { module: 'workouts', incomingDependencies: 0 }
      ]
    });
  });

  it('fails deterministically when graph artifact is missing', () => {
    const repo = createRepo('playbook-repo-graph-missing');

    expect(() => readRepositoryGraph(repo)).toThrow(
      'playbook graph: missing repository graph at .playbook/repo-graph.json. Run "playbook index" first.'
    );
  });
});
