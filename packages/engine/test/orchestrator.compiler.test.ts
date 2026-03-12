import { describe, expect, it } from 'vitest';
import { buildOrchestratorContract } from '../src/orchestrator/index.js';

describe('buildOrchestratorContract', () => {
  it('builds deterministic lane contracts with explicit ownership metadata', () => {
    const contract = buildOrchestratorContract({
      goal: '  Implement query risk and docs audit improvements in parallel  ',
      laneCountRequested: 3
    });

    expect(contract.schemaVersion).toBe('1.0');
    expect(contract.command).toBe('orchestrate');
    expect(contract.goal).toBe('Implement query risk and docs audit improvements in parallel');
    expect(contract.laneCountRequested).toBe(3);
    expect(contract.laneCountProduced).toBe(3);
    expect(contract.sharedPaths).toEqual(['README.md', 'docs/CHANGELOG.md', 'docs/PLAYBOOK_PRODUCT_ROADMAP.md']);

    const owned = new Set<string>();
    contract.lanes.forEach((lane) => {
      expect(lane).toMatchObject({
        id: expect.any(String),
        title: expect.any(String),
        objective: expect.any(String),
        allowedPaths: expect.any(Array),
        forbiddenPaths: expect.any(Array),
        sharedPaths: expect.any(Array),
        wave: expect.any(Number),
        dependsOn: expect.any(Array),
        promptFile: expect.any(String),
        verification: expect.any(Array),
        documentationUpdates: expect.any(Array)
      });

      lane.allowedPaths.forEach((ownedPath) => {
        expect(owned.has(ownedPath)).toBe(false);
        owned.add(ownedPath);
      });
    });

    const waveTwo = contract.lanes.filter((lane) => lane.wave === 2);
    expect(waveTwo).toHaveLength(1);
    expect(waveTwo[0]?.dependsOn).toEqual(['lane-1', 'lane-2']);
  });

  it('is stable for identical input', () => {
    const first = buildOrchestratorContract({ goal: 'Test orchestration slice', laneCountRequested: 3 });
    const second = buildOrchestratorContract({ goal: 'Test orchestration slice', laneCountRequested: 3 });
    expect(first).toEqual(second);
  });

  it('degrades lane count safely to one lane for constrained requests', () => {
    const contract = buildOrchestratorContract({ goal: 'Constrained execution', laneCountRequested: 1 });
    expect(contract.laneCountProduced).toBe(1);
    expect(contract.lanes[0]?.wave).toBe(1);
    expect(contract.lanes[0]?.dependsOn).toEqual([]);
  });

  it('caps lane count at deterministic v1 maximum with warning', () => {
    const contract = buildOrchestratorContract({ goal: 'Max lane guard', laneCountRequested: 7 });
    expect(contract.laneCountProduced).toBe(4);
    expect(contract.warnings).toEqual([
      'Requested 7 lanes; reduced to 4 because v1 supports up to four deterministic ownership buckets.'
    ]);
  });
});
