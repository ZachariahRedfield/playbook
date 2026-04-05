import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPLAY_PROMOTION_SYSTEM_RELATIVE_PATH } from './replayPromotionSystem.js';
import { REPOSITORY_MEMORY_SYSTEM_RELATIVE_PATH, readRepositoryMemorySystem, writeRepositoryMemorySystem } from './repositoryMemorySystem.js';

const writeJson = (repo: string, relativePath: string, value: unknown): void => {
  const absolutePath = path.join(repo, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const createRepo = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-memory-system-'));

describe('repositoryMemorySystem', () => {
  it('is deterministic for the same canonical source artifacts', () => {
    const repo = createRepo();

    writeJson(repo, '.playbook/repo-index.json', { modules: [{ id: 'engine' }, { id: 'cli' }] });
    writeJson(repo, '.playbook/repo-graph.json', { nodes: [{ id: 'a' }], edges: [{ from: 'a', to: 'b' }] });
    writeJson(repo, '.playbook/memory/index.json', { events: [{ id: 'e1' }] });
    writeJson(repo, '.playbook/memory/events/e1.json', { eventId: 'e1' });
    writeJson(repo, '.playbook/memory/replay-candidates.json', { candidates: [{ candidateId: 'cand.1' }] });
    writeJson(repo, '.playbook/memory/consolidation-candidates.json', { candidates: [{ candidateId: 'cc.1' }] });
    writeJson(repo, '.playbook/memory/lifecycle-candidates.json', {
      candidates: [
        { recommendation_id: 'l1', recommended_action: 'freshness_review', status: 'candidate' },
        { recommendation_id: 'l2', recommended_action: 'supersede', status: 'candidate' }
      ]
    });
    writeJson(repo, '.playbook/memory/knowledge/patterns.json', {
      entries: [
        { id: 'pattern.1', status: 'active' },
        { id: 'pattern.2', status: 'superseded' }
      ]
    });
    writeJson(repo, '.playbook/memory/knowledge/decisions.json', { entries: [{ id: 'decision.1', status: 'retired' }] });
    writeJson(repo, '.playbook/memory/knowledge/failure-modes.json', { entries: [] });
    writeJson(repo, '.playbook/memory/knowledge/invariants.json', { entries: [] });

    const first = readRepositoryMemorySystem(repo);
    const second = readRepositoryMemorySystem(repo);

    expect(second).toEqual(first);
    expect(first.generatedAt).toBe('1970-01-01T00:00:00.000Z');
  });

  it('keeps structural graph and temporal memory boundaries explicit', () => {
    const repo = createRepo();

    writeJson(repo, '.playbook/repo-index.json', { modules: [{ id: 'engine' }] });
    writeJson(repo, '.playbook/repo-graph.json', { nodes: [{ id: 'engine' }], edges: [] });
    writeJson(repo, '.playbook/memory/index.json', { events: [] });

    const artifact = readRepositoryMemorySystem(repo);

    expect(artifact.boundaries.graph_vs_temporal.structuralRefs).toEqual(['.playbook/repo-index.json', '.playbook/repo-graph.json']);
    expect(artifact.boundaries.graph_vs_temporal.temporalRefs).toEqual(['.playbook/memory/index.json', '.playbook/memory/events']);
    expect(artifact.layers.structural_graph.boundary).toBe('repository-shape-intelligence');
    expect(artifact.layers.temporal_episodic.boundary).toBe('execution-observation-events');
  });

  it('keeps candidate/promoted/superseded states explicit', () => {
    const repo = createRepo();

    writeJson(repo, '.playbook/memory/candidates.json', { candidates: [{ candidateId: 'cand.legacy' }] });
    writeJson(repo, '.playbook/memory/lifecycle-candidates.json', {
      candidates: [
        { recommendation_id: 'l1', recommended_action: 'freshness_review', status: 'candidate' },
        { recommendation_id: 'l2', recommended_action: 'supersede', status: 'candidate' },
        { recommendation_id: 'l3', recommended_action: 'retire', status: 'stale' }
      ]
    });
    writeJson(repo, '.playbook/memory/knowledge/patterns.json', {
      entries: [
        { id: 'pattern.1', status: 'active' },
        { id: 'pattern.2', status: 'superseded' }
      ]
    });
    writeJson(repo, '.playbook/memory/knowledge/decisions.json', { entries: [{ id: 'decision.1', status: 'retired' }] });
    writeJson(repo, '.playbook/memory/knowledge/failure-modes.json', { entries: [] });
    writeJson(repo, '.playbook/memory/knowledge/invariants.json', { entries: [] });

    const artifact = writeRepositoryMemorySystem(repo);

    expect(artifact.state_summaries.candidates.total).toBeGreaterThan(0);
    expect(artifact.state_summaries.candidates.stale).toBeGreaterThan(0);
    expect(artifact.state_summaries.promoted.superseded).toBe(1);
    expect(artifact.state_summaries.promoted.retired).toBe(1);
    expect(fs.existsSync(path.join(repo, REPOSITORY_MEMORY_SYSTEM_RELATIVE_PATH))).toBe(true);
    expect(fs.existsSync(path.join(repo, REPLAY_PROMOTION_SYSTEM_RELATIVE_PATH))).toBe(true);
  });
});
