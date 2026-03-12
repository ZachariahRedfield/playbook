import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildOrchestratorContract, writeOrchestratorArtifact } from '../src/orchestrator/index.js';

describe('orchestrator planner', () => {
  it('builds deterministically ordered lanes with stable ids and dependency mapping', () => {
    const contract = buildOrchestratorContract({
      repoRoot: '/repo',
      goal: 'ship orchestrator',
      lanes: [
        {
          goal: 'add writer',
          wave: 2,
          dependsOn: ['add planner'],
          allowedPaths: ['packages/engine/src/orchestrator/writer.ts'],
          forbiddenPaths: ['packages/cli/**']
        },
        {
          goal: 'add planner',
          wave: 1,
          allowedPaths: ['packages/engine/src/orchestrator/planner.ts'],
          sharedPaths: ['README.md']
        }
      ]
    });

    expect(contract.generatedAt).toBe('deterministic');
    expect(contract.lanes.map((lane) => lane.id)).toEqual(['lane-1', 'lane-2']);
    expect(contract.lanes.map((lane) => lane.goal)).toEqual(['add planner', 'add writer']);
    expect(contract.lanes[1]?.dependsOn).toEqual(['lane-1']);
    expect(contract.lanes[0]?.allowedPaths).toEqual(['packages/engine/src/orchestrator/planner.ts']);
    expect(contract.lanes[1]?.forbiddenPaths).toEqual(['packages/cli/**']);
  });

  it('fails on overlapping allowed paths in fail mode', () => {
    expect(() =>
      buildOrchestratorContract({
        repoRoot: '/repo',
        goal: 'ship orchestrator',
        overlapStrategy: 'fail',
        lanes: [
          { goal: 'lane one', allowedPaths: ['README.md'] },
          { goal: 'lane two', allowedPaths: ['README.md'] }
        ]
      })
    ).toThrow('Overlapping allowedPaths detected: README.md.');
  });

  it('migrates overlapping allowed paths into shared paths deterministically', () => {
    const contract = buildOrchestratorContract({
      repoRoot: '/repo',
      goal: 'ship orchestrator',
      overlapStrategy: 'migrate-to-shared',
      lanes: [
        { goal: 'lane one', allowedPaths: ['README.md'] },
        { goal: 'lane two', allowedPaths: ['README.md'] }
      ]
    });

    expect(contract.lanes.map((lane) => lane.allowedPaths)).toEqual([[], []]);
    expect(contract.lanes.map((lane) => lane.sharedPaths)).toEqual([['README.md'], ['README.md']]);
  });

  it('creates explicit shared-file policy entries for governance files', () => {
    const contract = buildOrchestratorContract({
      repoRoot: '/repo',
      goal: 'ship orchestrator',
      lanes: [
        { goal: 'lane one', allowedPaths: ['README.md'] },
        { goal: 'lane two', allowedPaths: ['docs/CHANGELOG.md', 'packages/engine/src/orchestrator/types.ts'] }
      ]
    });

    expect(contract.sharedFilePolicy).toEqual([
      {
        path: 'README.md',
        handling: 'single-owner',
        ownerLaneId: 'lane-1',
        notes: 'lane-1 is the single owner for README.md.'
      },
      {
        path: 'docs/CHANGELOG.md',
        handling: 'single-owner',
        ownerLaneId: 'lane-2',
        notes: 'lane-2 is the single owner for docs/CHANGELOG.md.'
      },
      {
        path: 'docs/PLAYBOOK_PRODUCT_ROADMAP.md',
        handling: 'deferred-merge',
        ownerLaneId: null,
        notes: 'No lane currently owns docs/PLAYBOOK_PRODUCT_ROADMAP.md; defer edits until a dedicated merge lane is defined.'
      }
    ]);
  });
});

describe('orchestrator artifact writer', () => {
  it('writes orchestrator json and lane prompt artifacts', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestrator-artifact-'));

    const contract = buildOrchestratorContract({
      repoRoot: '/repo',
      goal: 'ship orchestrator',
      lanes: [{ goal: 'lane one', allowedPaths: ['packages/engine/src/orchestrator/planner.ts'] }]
    });

    const result = writeOrchestratorArtifact(contract, path.join(tmpDir, 'out'));

    expect(fs.existsSync(result.orchestratorPath)).toBe(true);
    expect(result.lanePromptPaths).toHaveLength(1);
    expect(fs.readFileSync(result.lanePromptPaths[0]!, 'utf8')).toContain('# lane-1 Prompt');
    expect(fs.readFileSync(result.orchestratorPath, 'utf8')).toContain('"sharedFilePolicy"');
  });
});
