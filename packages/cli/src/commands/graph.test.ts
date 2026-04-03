import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';
import { listRegisteredCommands } from './index.js';
import { runGraph } from './graph.js';

const createRepo = (name: string): string => fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));

describe('runGraph', () => {
  it('prints deterministic JSON graph summary when artifact exists', async () => {
    const repo = createRepo('playbook-cli-graph');
    fs.mkdirSync(path.join(repo, '.playbook'), { recursive: true });
    fs.writeFileSync(
      path.join(repo, '.playbook', 'repo-graph.json'),
      `${JSON.stringify(
        {
          schemaVersion: '1.1',
          kind: 'playbook-repo-graph',
          generatedAt: '2026-01-01T00:00:00.000Z',
          nodes: [
            { id: 'repository:root', kind: 'repository', name: 'root' },
            { id: 'module:auth', kind: 'module', name: 'auth' },
            { id: 'module:workouts', kind: 'module', name: 'workouts' },
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
          stats: { nodeCount: 4, edgeCount: 6 }
        },
        null,
        2
      )}\n`,
      'utf8'
    );

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runGraph(repo, { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload).toEqual({
      schemaVersion: '1.1',
      command: 'graph',
      graph: {
        schemaVersion: '1.1',
        kind: 'playbook-repo-graph',
        generatedAt: '2026-01-01T00:00:00.000Z',
        stats: { nodeCount: 4, edgeCount: 6 },
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
      }
    });

    logSpy.mockRestore();
  });

  it('returns deterministic missing-artifact error in JSON mode', async () => {
    const repo = createRepo('playbook-cli-graph-missing');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runGraph(repo, { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Failure);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload).toEqual({
      schemaVersion: '1.1',
      command: 'graph',
      error: 'playbook graph: missing repository graph at .playbook/repo-graph.json. Run "playbook index" first.'
    });

    logSpy.mockRestore();
  });
});

describe('command registry', () => {
  it('registers the graph command', () => {
    const command = listRegisteredCommands().find((entry) => entry.name === 'graph');

    expect(command).toBeDefined();
    expect(command?.description).toBe('Summarize machine-readable repository knowledge graph from .playbook/repo-graph.json');
  });
});
