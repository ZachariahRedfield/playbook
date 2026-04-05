import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readReplayPromotionSystem, REPLAY_PROMOTION_SYSTEM_RELATIVE_PATH, writeReplayPromotionSystem } from './replayPromotionSystem.js';

const writeJson = (repo: string, relativePath: string, value: unknown): void => {
  const absolutePath = path.join(repo, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const createRepo = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-replay-promotion-system-'));

describe('replayPromotionSystem', () => {
  it('is deterministic for the same replay/consolidation/compaction/promotion sources', () => {
    const repo = createRepo();

    writeJson(repo, '.playbook/memory/replay-candidates.json', {
      candidates: [
        {
          candidateId: 'replay.a',
          kind: 'pattern',
          salienceScore: 7,
          provenance: [{ eventId: 'evt.1', sourcePath: '.playbook/memory/events/evt.1.json' }]
        }
      ]
    });
    writeJson(repo, '.playbook/memory/consolidation-candidates.json', {
      candidates: [
        {
          consolidationCandidateId: 'cons.a',
          reviewStatus: 'review_required',
          promotion: { eligible: true, reviewRequired: true },
          provenance: { events: [{ eventId: 'evt.1', sourcePath: '.playbook/memory/events/evt.1.json' }] }
        }
      ]
    });
    writeJson(repo, '.playbook/memory/compaction-review.json', {
      entries: [
        {
          reviewId: 'review.a',
          decision: { decision: 'new_candidate' },
          promotion: { reviewRequired: true },
          provenance: { events: [{ eventId: 'evt.1', sourcePath: '.playbook/memory/events/evt.1.json' }] }
        }
      ]
    });
    writeJson(repo, '.playbook/memory/lifecycle-candidates.json', {
      candidates: [{ recommendation_id: 'life.1', status: 'stale', recommended_action: 'retire' }]
    });
    writeJson(repo, '.playbook/memory/knowledge/patterns.json', {
      entries: [{ knowledgeId: 'knowledge.a', status: 'active' }, { knowledgeId: 'knowledge.b', status: 'superseded' }]
    });
    writeJson(repo, '.playbook/memory/knowledge/decisions.json', { entries: [{ knowledgeId: 'knowledge.c', status: 'retired' }] });
    writeJson(repo, '.playbook/memory/knowledge/failure-modes.json', { entries: [] });
    writeJson(repo, '.playbook/memory/knowledge/invariants.json', { entries: [] });

    const first = readReplayPromotionSystem(repo);
    const second = readReplayPromotionSystem(repo);

    expect(second).toEqual(first);
    expect(first.generatedAt).toBe('1970-01-01T00:00:00.000Z');
  });

  it('keeps candidate-only boundaries explicit without auto-promotion', () => {
    const repo = createRepo();

    writeJson(repo, '.playbook/memory/replay-candidates.json', { candidates: [{ candidateId: 'replay.a', kind: 'pattern', salienceScore: 5, provenance: [] }] });
    writeJson(repo, '.playbook/memory/consolidation-candidates.json', {
      candidates: [{ consolidationCandidateId: 'cons.a', reviewStatus: 'already_promoted_match', promotion: { eligible: false, reviewRequired: true }, provenance: { events: [] } }]
    });
    writeJson(repo, '.playbook/memory/compaction-review.json', {
      entries: [{ reviewId: 'review.a', decision: { decision: 'attach' }, promotion: { reviewRequired: true }, provenance: { events: [] } }]
    });
    writeJson(repo, '.playbook/memory/knowledge/patterns.json', { entries: [{ knowledgeId: 'knowledge.a', status: 'active' }] });
    writeJson(repo, '.playbook/memory/knowledge/decisions.json', { entries: [] });
    writeJson(repo, '.playbook/memory/knowledge/failure-modes.json', { entries: [] });
    writeJson(repo, '.playbook/memory/knowledge/invariants.json', { entries: [] });

    const artifact = writeReplayPromotionSystem(repo);

    expect(artifact.promotion_boundaries.candidateOnly.replay).toBe(1);
    expect(artifact.promotion_boundaries.explicitAuthority).toEqual({
      mutation: 'read-only',
      promotion: 'review-required',
      autoPromotion: false
    });
    expect(artifact.provenance_refs_end_to_end.replayCandidateIds).toEqual(['replay.a']);
    expect(fs.existsSync(path.join(repo, REPLAY_PROMOTION_SYSTEM_RELATIVE_PATH))).toBe(true);
  });
});
