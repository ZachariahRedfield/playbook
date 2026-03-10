import { describe, expect, it } from 'vitest';
import { applyPromotionDecision } from '../src/promotion/applyPromotionDecision.js';
import type { PatternCardDraftArtifact } from '../src/schema/patternCardDraft.js';
import type { PromotionDecision } from '../src/schema/promotionDecision.js';

const draftArtifact: PatternCardDraftArtifact = {
  schemaVersion: '1.0',
  kind: 'playbook-pattern-card-drafts',
  artifactId: 'draft-artifact:1',
  cycleId: '2026-01-01T00-00-00.000Z@abc1234',
  snapshotId: 'snapshot:1',
  sourceCandidateArtifactId: 'candidate:1',
  createdAt: '2026-01-01T00:00:00.000Z',
  drafts: [
    {
      patternId: 'draft.a',
      originCycleId: '2026-01-01T00-00-00.000Z@abc1234',
      sourceGroupId: 'group.a',
      sourceZettelIds: ['zettel.1', 'zettel.2'],
      sourceArtifactPaths: ['.playbook/run-cycles/a.json'],
      canonicalKey: 'deterministic-promotion',
      title: 'Deterministic promotion',
      summary: 'Promotion requires explicit decision artifacts.',
      evidenceRefs: ['evidence.a'],
      linkedContractRefs: ['contract.a'],
      recurrence: { cycleCount: 2, latestCycleId: 'cycle.2', sourceCycleIds: ['cycle.1', 'cycle.2'] },
      conflictFlags: [],
      boundaryFlags: [],
      draftStatus: 'ready'
    },
    {
      patternId: 'draft.b',
      originCycleId: '2026-01-01T00-00-00.000Z@abc1234',
      sourceGroupId: 'group.b',
      sourceZettelIds: ['zettel.3'],
      sourceArtifactPaths: ['.playbook/run-cycles/b.json'],
      canonicalKey: 'deterministic-lineage',
      title: 'Deterministic lineage',
      summary: 'Lineage remains linked after promotion.',
      evidenceRefs: ['evidence.b'],
      linkedContractRefs: ['contract.b'],
      recurrence: { cycleCount: 1, latestCycleId: 'cycle.1', sourceCycleIds: ['cycle.1'] },
      conflictFlags: [],
      boundaryFlags: [],
      draftStatus: 'review'
    }
  ],
  metrics: { draftCount: 2, conflictFlagCount: 0, boundaryFlagCount: 0 }
};

const promoteDecision: PromotionDecision = {
  decisionId: 'decision.promote.1',
  originCycleId: draftArtifact.cycleId,
  patternDraftId: 'draft.a',
  decisionType: 'promote',
  decisionReason: 'Stable recurrence observed.',
  timestamp: '2026-01-01T00:01:00.000Z',
  sourceGroupIds: ['group.a'],
  sourceZettelIds: ['zettel.1', 'zettel.2'],
  resultingPatternIds: ['pattern.a']
};

describe('applyPromotionDecision', () => {
  it('promotes deterministically from decision artifact only', () => {
    const first = applyPromotionDecision({ draftArtifact, decision: promoteDecision });
    const second = applyPromotionDecision({ draftArtifact, decision: promoteDecision });

    expect(first.patterns).toEqual(second.patterns);
    expect(first.patterns[0]).toMatchObject({
      patternId: 'pattern.a',
      status: 'active',
      lineage: {
        sourceDraftIds: ['draft.a'],
        sourceZettelIds: ['zettel.1', 'zettel.2']
      }
    });
  });

  it('merge preserves parent lineage', () => {
    const merge = applyPromotionDecision({
      draftArtifact,
      decision: {
        ...promoteDecision,
        decisionId: 'decision.merge.1',
        decisionType: 'merge',
        patternDraftId: 'draft.a',
        relatedDraftIds: ['draft.b'],
        resultingPatternIds: ['pattern.merge.1']
      }
    });

    expect(merge.patterns[0].lineage.sourceZettelIds).toEqual(['zettel.1', 'zettel.2', 'zettel.3']);
    expect(merge.patterns[0].lineage.mergedFromPatternIds.length).toBe(2);
  });

  it('split emits new drafts and no promotions', () => {
    const split = applyPromotionDecision({
      draftArtifact,
      decision: {
        ...promoteDecision,
        decisionId: 'decision.split.1',
        decisionType: 'split',
        splitDrafts: [
          { title: 'Split One', summary: 'One', sourceZettelIds: ['zettel.1'] },
          { title: 'Split Two', summary: 'Two', sourceZettelIds: ['zettel.2'] }
        ],
        resultingPatternIds: []
      }
    });

    expect(split.patterns).toHaveLength(0);
    expect(split.emittedDrafts).toHaveLength(2);
  });

  it('supersede marks previous pattern as superseded', () => {
    const promoted = applyPromotionDecision({ draftArtifact, decision: promoteDecision });
    const superseded = applyPromotionDecision({
      draftArtifact,
      existingPatterns: promoted.patterns,
      decision: {
        ...promoteDecision,
        decisionId: 'decision.supersede.1',
        decisionType: 'supersede',
        resultingPatternIds: ['pattern.new'],
        relatedPatternIds: ['pattern.a']
      }
    });

    const oldCard = superseded.patterns.find((card) => card.patternId === 'pattern.a');
    expect(oldCard?.status).toBe('superseded');
    expect(oldCard?.supersededByPatternId).toBe('pattern.new');
  });

  it('defer and reject do not mutate promoted cards', () => {
    const defer = applyPromotionDecision({
      draftArtifact,
      decision: { ...promoteDecision, decisionId: 'decision.defer.1', decisionType: 'defer', resultingPatternIds: [] }
    });
    const reject = applyPromotionDecision({
      draftArtifact,
      decision: { ...promoteDecision, decisionId: 'decision.reject.1', decisionType: 'reject', resultingPatternIds: [] }
    });

    expect(defer.patterns).toHaveLength(0);
    expect(reject.patterns).toHaveLength(0);
  });
});
