import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildOrchestratorPlan, parseOrchestratorContract } from '../src/orchestrator.js';

const FIXTURE_DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname), '__fixtures__', 'orchestrator');
const fixture = (name: string): string => fs.readFileSync(path.join(FIXTURE_DIR, name), 'utf8');

describe('orchestrator contracts', () => {
  it('parses deterministic orchestration contracts', () => {
    const contract = parseOrchestratorContract({
      schemaVersion: '1.0',
      goal: 'coordinate lanes',
      lanes: [
        { id: 'engine', allowedPaths: ['packages/engine'], wave: 2, dependsOn: ['core'] },
        { id: 'core', allowedPaths: ['packages/core'], wave: 1 }
      ]
    });

    expect(contract).toEqual({
      schemaVersion: '1.0',
      goal: 'coordinate lanes',
      sharedPaths: [],
      lanes: [
        { id: 'core', allowedPaths: ['packages/core'], sharedPaths: [], wave: 1, dependsOn: [] },
        { id: 'engine', allowedPaths: ['packages/engine'], sharedPaths: [], wave: 2, dependsOn: ['core'] }
      ]
    });
  });

  it('enforces allowedPaths exclusivity across lanes unless shared policy is explicit', () => {
    expect(() => buildOrchestratorPlan(fixture('overlap-fail.contract.json'), { modules: [] })).toThrow(
      'orchestrator: overlapping allowedPaths require shared policy: packages/shared'
    );
  });

  it('accepts overlap when shared paths are explicit globally and per-lane', () => {
    const plan = buildOrchestratorPlan(fixture('overlap-shared.contract.json'), { modules: [] });

    expect(plan.lanes).toEqual([
      {
        id: 'lane-a',
        wave: 1,
        dependsOn: [],
        allowedPaths: ['packages/shared'],
        sharedPaths: ['packages/shared']
      },
      {
        id: 'lane-b',
        wave: 2,
        dependsOn: ['lane-a'],
        allowedPaths: ['packages/shared'],
        sharedPaths: ['packages/shared']
      }
    ]);
  });

  it('enforces wave and dependsOn consistency', () => {
    expect(() => buildOrchestratorPlan({
      schemaVersion: '1.0',
      goal: 'bad wave',
      lanes: [
        { id: 'first', allowedPaths: ['packages/first'], wave: 2, dependsOn: [] },
        { id: 'second', allowedPaths: ['packages/second'], wave: 1, dependsOn: ['first'] }
      ]
    }, { modules: [] })).toThrow('orchestrator: lane second must have wave greater than dependsOn lane first');
  });

  it('returns identical output for identical input and repo shape', () => {
    const contract = fixture('overlap-shared.contract.json');
    const repoShape = { modules: [{ name: 'engine', path: 'packages/engine' }, { name: 'core', path: 'packages/core' }] };

    const first = buildOrchestratorPlan(contract, repoShape);
    const second = buildOrchestratorPlan(contract, repoShape);

    expect(first).toEqual(second);
  });
});
