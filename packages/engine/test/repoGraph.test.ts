import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  generateRepositoryGraph,
  readRepositoryGraph,
  summarizeGraphNeighborhood,
  summarizeRepositoryGraph
} from '../src/graph/repoGraph.js';
import { inferArchitectureRoles } from '../src/graph/architectureRoleInference.js';
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
      schemaVersion: '1.1',
      kind: 'playbook-repo-graph',
      generatedAt: '2026-01-01T00:00:00.000Z',
      nodes: [
        { id: 'module:auth', kind: 'module', name: 'auth' },
        { id: 'module:workouts', kind: 'module', name: 'workouts' },
        { id: 'repository:root', kind: 'repository', name: 'root' },
        { id: 'rule:PB001', kind: 'rule', name: 'PB001' }
      ],
      edges: [
        { kind: 'contains', from: 'repository:root', to: 'module:auth' },
        { kind: 'contains', from: 'repository:root', to: 'module:workouts' },
        { kind: 'contains', from: 'repository:root', to: 'rule:PB001' },
        { kind: 'depends_on', from: 'module:workouts', to: 'module:auth' },
        { kind: 'governed_by', from: 'module:auth', to: 'rule:PB001' },
        { kind: 'governed_by', from: 'module:workouts', to: 'rule:PB001' }
      ],
      stats: {
        nodeCount: 4,
        edgeCount: 6,
        nodeKinds: {
          module: 2,
          repository: 1,
          rule: 1
        },
        edgeKinds: {
          contains: 3,
          depends_on: 1,
          governed_by: 2
        }
      }
    });
  });

  it('summarizes graph with kinds and dependency hubs', () => {
    const graph = generateRepositoryGraph(sampleIndex, new Date('2026-01-01T00:00:00.000Z'));

    expect(summarizeRepositoryGraph(graph)).toEqual({
      schemaVersion: '1.1',
      kind: 'playbook-repo-graph',
      generatedAt: '2026-01-01T00:00:00.000Z',
      stats: {
        nodeCount: 4,
        edgeCount: 6,
        nodeKinds: { module: 2, repository: 1, rule: 1 },
        edgeKinds: { contains: 3, depends_on: 1, governed_by: 2 }
      },
      nodeKinds: ['module', 'repository', 'rule'],
      edgeKinds: ['contains', 'depends_on', 'governed_by'],
      topDependencyHubs: [
        { module: 'auth', incomingDependencies: 1 },
        { module: 'workouts', incomingDependencies: 0 }
      ],
      architectureRoleInference: {
        schemaVersion: '1.0',
        roles: [
          {
            module: 'auth',
            role: 'foundation',
            evidence: { incomingDependencies: 1, outgoingDependencies: 0, dependencyDirection: 'inbound' }
          },
          {
            module: 'workouts',
            role: 'interface',
            evidence: { incomingDependencies: 0, outgoingDependencies: 1, dependencyDirection: 'outbound' }
          }
        ]
      }
    });
  });


  it('infers deterministic architecture roles from dependency direction and structural position', () => {
    const roleFixtureIndex: RepositoryIndex = {
      ...sampleIndex,
      modules: [
        { name: 'adapter', dependencies: [] },
        { name: 'foundation', dependencies: [] },
        { name: 'interface', dependencies: ['orchestration'] },
        { name: 'orchestration', dependencies: ['foundation'] }
      ]
    };

    const graph = generateRepositoryGraph(roleFixtureIndex, new Date('2026-01-01T00:00:00.000Z'));

    expect(inferArchitectureRoles(graph)).toEqual({
      schemaVersion: '1.0',
      roles: [
        {
          module: 'adapter',
          role: 'adapter',
          evidence: { incomingDependencies: 0, outgoingDependencies: 0, dependencyDirection: 'isolated' }
        },
        {
          module: 'foundation',
          role: 'foundation',
          evidence: { incomingDependencies: 1, outgoingDependencies: 0, dependencyDirection: 'inbound' }
        },
        {
          module: 'interface',
          role: 'interface',
          evidence: { incomingDependencies: 0, outgoingDependencies: 1, dependencyDirection: 'outbound' }
        },
        {
          module: 'orchestration',
          role: 'orchestration',
          evidence: { incomingDependencies: 1, outgoingDependencies: 1, dependencyDirection: 'bidirectional' }
        }
      ]
    });

    expect(inferArchitectureRoles(graph)).toEqual(inferArchitectureRoles(graph));
  });

  it('returns deterministic neighborhood summaries for module nodes', () => {
    const graph = generateRepositoryGraph(sampleIndex, new Date('2026-01-01T00:00:00.000Z'));

    expect(summarizeGraphNeighborhood(graph, 'module:workouts')).toEqual({
      node: {
        id: 'module:workouts',
        kind: 'module',
        name: 'workouts'
      },
      outgoing: [
        { kind: 'depends_on', target: 'module:auth' },
        { kind: 'governed_by', target: 'rule:PB001' }
      ],
      incoming: [{ kind: 'contains', source: 'repository:root' }]
    });
  });

  it('fails deterministically when graph artifact is missing', () => {
    const repo = createRepo('playbook-repo-graph-missing');

    expect(() => readRepositoryGraph(repo)).toThrow(
      'playbook graph: missing repository graph at .playbook/repo-graph.json. Run "playbook index" first.'
    );
  });
});
