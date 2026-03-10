import { describe, expect, it } from 'vitest';
import { applyPromotionDecision } from '../src/promotion/applyPromotionDecision.js';
import { replayDecisionJournal } from '../src/promotion/replayDecisionJournal.js';
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
      patternId: 'draft.a', originCycleId: 'cycle.1', sourceGroupId: 'group.a', sourceZettelIds: ['zettel.1', 'zettel.2'], sourceArtifactPaths: ['.playbook/run-cycles/a.json'], canonicalKey: 'deterministic-promotion', title: 'Deterministic promotion', summary: 'Promotion requires explicit decision artifacts.', evidenceRefs: ['evidence.a'], linkedContractRefs: ['contract.a'], recurrence: { cycleCount: 2, latestCycleId: 'cycle.2', sourceCycleIds: ['cycle.1', 'cycle.2'] }, conflictFlags: [], boundaryFlags: [], draftStatus: 'draft'
    },
    {
      patternId: 'draft.b', originCycleId: 'cycle.1', sourceGroupId: 'group.b', sourceZettelIds: ['zettel.3'], sourceArtifactPaths: ['.playbook/run-cycles/b.json'], canonicalKey: 'deterministic-lineage', title: 'Deterministic lineage', summary: 'Lineage remains linked after promotion.', evidenceRefs: ['evidence.b'], linkedContractRefs: ['contract.b'], recurrence: { cycleCount: 1, latestCycleId: 'cycle.1', sourceCycleIds: ['cycle.1'] }, conflictFlags: [], boundaryFlags: [], draftStatus: 'review'
    }
  ],
  metrics: { draftCount: 2, conflictFlagCount: 0, boundaryFlagCount: 0 }
};

const baseDecision: PromotionDecision = {
  decisionId: 'decision.promote.1',
  originCycleId: draftArtifact.cycleId,
  sequence: 1,
  timestamp: '2026-01-01T00:01:00.000Z',
  decisionType: 'promote',
  inputPatternIds: [],
  inputDraftIds: ['draft.a'],
  decisionReason: 'Stable recurrence observed.',
  resultingPatternIds: ['pattern.a'],
  resultingState: 'promoted',
  evidenceRefs: ['evidence.a'],
  lineage: { sourceGroupIds: ['group.a'], sourceZettelIds: ['zettel.1', 'zettel.2'], sourceArtifactPaths: ['.playbook/run-cycles/a.json'], priorVersionIds: [] }
};

describe('promotion decision algebra', () => {
  it('rejects invalid transitions deterministically', () => {
    expect(() =>
      applyPromotionDecision({ draftArtifact, decision: { ...baseDecision, decisionId: 'bad.1', decisionType: 'supersede', resultingState: 'superseded' } })
    ).toThrow('Invalid state transition');
  });

  it('replay journal is stable across repeated runs', () => {
    const batch = {
      schemaVersion: '1.0' as const,
      kind: 'playbook-promotion-decision-batch' as const,
      batchId: 'batch.1',
      originCycleId: draftArtifact.cycleId,
      createdAt: '2026-01-01T00:02:00.000Z',
      decisions: [{ ...baseDecision }, { ...baseDecision, decisionId: 'decision.defer.1', sequence: 2, decisionType: 'defer', inputDraftIds: ['draft.b'], resultingState: 'deferred', resultingPatternIds: [] }]
    };

    const first = replayDecisionJournal({ draftArtifact, batch });
    const second = replayDecisionJournal({ draftArtifact, batch });
    expect(first.final.patterns).toEqual(second.final.patterns);
  });

  it('merge and split preserve lineage', () => {
    const merge = applyPromotionDecision({
      draftArtifact,
      decision: {
        ...baseDecision,
        decisionId: 'decision.merge.1',
        sequence: 2,
        decisionType: 'merge',
        inputPatternIds: ['pattern.a', 'pattern.b'],
        inputDraftIds: ['draft.a', 'draft.b'],
        resultingPatternIds: ['pattern.merge.1']
      }
    });

    expect(merge.patterns[0].lineage.parentPatternIds).toEqual(['pattern.a', 'pattern.b']);

    const split = applyPromotionDecision({
      draftArtifact,
      decision: {
        ...baseDecision,
        decisionId: 'decision.split.1',
        sequence: 3,
        decisionType: 'split',
        inputDraftIds: ['draft.a'],
        resultingPatternIds: ['draft.split.1', 'draft.split.2'],
        resultingState: 'review'
      }
    });

    expect(split.emittedDrafts).toHaveLength(2);
    expect(split.terminalRecords[0].lineage.sourceGroupIds).toEqual(['group.a']);
  });
});
