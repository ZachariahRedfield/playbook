import { describe, expect, it } from 'vitest';
import { applyFunctor } from '../src/functors/applyFunctor.js';
import type { PatternCard } from '../src/schema/patternCard.js';

const pattern: PatternCard = {
  schemaVersion: '1.0',
  kind: 'playbook-pattern-card',
  patternId: 'pattern.det.verify',
  canonicalKey: 'deterministic-contract-mutation',
  title: 'Deterministic contract mutation proposals',
  summary: 'Promoted pattern cards produce reviewable mutation proposals.',
  mechanism: 'Pattern promotion emits contract proposals before any mutation.',
  invariant: 'Contracts evolve only through verified mutation proposals.',
  linkedContractRefs: ['rule.contract.proposals'],
  state: 'promoted',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  currentVersion: 2,
  versionHistory: [],
  lineage: {
    originCycleIds: ['2026-01-01T00-00-00.000Z@abc1234'],
    sourceDraftIds: ['draft.1'],
    sourceGroupIds: ['group.1'],
    sourceZettelIds: ['zettel.1'],
    sourceArtifactPaths: ['.playbook/pattern-cards/promoted/2026-01-01T00-00-00.000Z@abc1234.json'],
    evidenceRefs: ['verify:rule.promotions', 'graph:group.compatibility'],
    parentPatternIds: ['pattern.det.verify.previous'],
    priorVersionIds: ['pattern.det.verify@v1'],
    decisionIds: ['decision.1']
  },
  versionRef: { patternId: 'pattern.det.verify', version: 2, status: 'promoted' }
};

describe('functor transforms', () => {
  it('preserves structural invariants and lineage', () => {
    const artifact = applyFunctor({ pattern, functorId: 'functor.pattern.to.contract-proposal', generatedAt: '2026-01-01T00:00:00.000Z' });
    const [application] = artifact.applications;

    expect(application.structuralInvariantProjection.mechanism).toBe(pattern.mechanism);
    expect(application.structuralInvariantProjection.invariant).toBe(pattern.invariant);
    expect(application.structuralInvariantProjection.dependencies).toEqual([
      'pattern.det.verify.previous',
      'pattern.det.verify@v1',
      'rule.contract.proposals'
    ]);

    expect(application.lineage.sourcePatternId).toBe(pattern.patternId);
    expect(application.lineage.sourceArtifactPath).toBe(pattern.lineage.sourceArtifactPaths[0]);
    expect(application.lineage.sourceEvidenceRefs).toEqual(['graph:group.compatibility', 'verify:rule.promotions']);
  });

  it('produces deterministic replay output', () => {
    const first = applyFunctor({ pattern, generatedAt: '2026-01-01T00:00:00.000Z' });
    const second = applyFunctor({ pattern, generatedAt: '2026-01-01T00:00:00.000Z' });

    expect(second).toEqual(first);
  });
});
