import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildOrchestratorContract, compileOrchestratorArtifacts } from '../src/orchestrator/index.js';

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
        shardKey: expect.any(String),
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

    expect(contract.lanes.map((lane) => lane.shardKey)).toEqual(['packages-cli', 'packages-engine', 'tests']);
  });


  it('surfaces shared-governance shard explicitly and avoids duplicate shard ownership within each wave', () => {
    const contract = buildOrchestratorContract({ goal: 'Wave shard safety', laneCountRequested: 4 });

    const waveShardOwners = new Map<number, Set<string>>();
    contract.lanes.forEach((lane) => {
      const keys = waveShardOwners.get(lane.wave) ?? new Set<string>();
      expect(keys.has(lane.shardKey)).toBe(false);
      keys.add(lane.shardKey);
      waveShardOwners.set(lane.wave, keys);
    });

    const sharedGovernanceLane = contract.lanes.find((lane) => lane.shardKey === 'shared-governance');
    expect(sharedGovernanceLane?.allowedPaths).toEqual(expect.arrayContaining(['docs/commands/README.md', 'docs/commands/orchestrate.md']));
  });

  it('is stable for identical input', () => {
    const first = buildOrchestratorContract({ goal: 'Test orchestration slice', laneCountRequested: 3 });
    const second = buildOrchestratorContract({ goal: 'Test orchestration slice', laneCountRequested: 3 });
    expect(first).toEqual(second);
    expect(first.lanes.map((lane) => lane.shardKey)).toEqual(second.lanes.map((lane) => lane.shardKey));
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


  it('writes worker bundles for each produced lane', () => {
    const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-orchestrator-worker-bundles-'));

    const result = compileOrchestratorArtifacts({
      cwd: repoDir,
      goal: 'Emit worker bundles',
      laneCountRequested: 3,
      outDir: '.playbook/orchestrator',
      artifactFormat: 'json'
    });

    const workersDir = path.join(repoDir, '.playbook', 'orchestrator', 'workers');
    expect(fs.existsSync(workersDir)).toBe(true);

    const workerLaneDirs = fs.readdirSync(workersDir);
    expect(workerLaneDirs).toHaveLength(result.contract.laneCountProduced);
    expect(result.artifact.workerBundleDirs).toHaveLength(result.contract.laneCountProduced);

    workerLaneDirs.forEach((laneId) => {
      expect(fs.existsSync(path.join(workersDir, laneId, 'prompt.md'))).toBe(true);
      expect(fs.existsSync(path.join(workersDir, laneId, 'contract.json'))).toBe(true);

      const workerContract = JSON.parse(fs.readFileSync(path.join(workersDir, laneId, 'contract.json'), 'utf8')) as { shardKey: string };
      expect(workerContract.shardKey).toBeTruthy();
    });

    const laneOnePrompt = fs.readFileSync(path.join(workersDir, 'lane-1', 'prompt.md'), 'utf8');
    expect(laneOnePrompt).toContain('## Shard ownership');
    expect(laneOnePrompt).toContain('Shard key:');
  });
});
