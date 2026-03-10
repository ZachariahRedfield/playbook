import { createHash } from 'node:crypto';
import { createPatternCard, createStablePatternId } from '../patternCards/createPatternCard.js';
import { markPatternSuperseded } from '../patternCards/versioning.js';
import type { PatternCard, PatternCardCollectionArtifact } from '../schema/patternCard.js';
import type { PatternCardDraft, PatternCardDraftArtifact } from '../schema/patternCardDraft.js';
import type { PromotionDecision, PromotionDecisionArtifact } from '../schema/promotionDecision.js';

const byId = <T extends { patternId: string }>(items: T[]): Map<string, T> => new Map(items.map((item) => [item.patternId, item]));

const findDraft = (artifact: PatternCardDraftArtifact, patternDraftId: string): PatternCardDraft => {
  const draft = artifact.drafts.find((item) => item.patternId === patternDraftId);
  if (!draft) {
    throw new Error(`Promotion decision references missing draft: ${patternDraftId}`);
  }
  return draft;
};

const uniqueSorted = (values: string[]): string[] => [...new Set(values)].sort();

const buildSplitDraftId = (decisionId: string, title: string, index: number): string =>
  `draft.${decisionId}.${index + 1}.${createHash('sha256').update(`${title}|${index}`).digest('hex').slice(0, 8)}`;

export type ApplyPromotionDecisionInput = {
  draftArtifact: PatternCardDraftArtifact;
  decision: PromotionDecision;
  existingPatterns?: PatternCard[];
};

export type ApplyPromotionDecisionResult = {
  decision: PromotionDecision;
  patterns: PatternCard[];
  emittedDrafts: PatternCardDraft[];
};

export const applyPromotionDecision = ({ draftArtifact, decision, existingPatterns = [] }: ApplyPromotionDecisionInput): ApplyPromotionDecisionResult => {
  const primaryDraft = findDraft(draftArtifact, decision.patternDraftId);
  const existing = byId(existingPatterns);

  if (decision.decisionType === 'defer' || decision.decisionType === 'reject') {
    return { decision, patterns: [...existing.values()], emittedDrafts: [] };
  }

  if (decision.decisionType === 'split') {
    const emittedDrafts = (decision.splitDrafts ?? []).map((part, index) => ({
      ...primaryDraft,
      patternId: buildSplitDraftId(decision.decisionId, part.title, index),
      title: part.title,
      summary: part.summary,
      mechanism: part.mechanism,
      invariant: part.invariant,
      sourceZettelIds: uniqueSorted(part.sourceZettelIds),
      evidenceRefs: uniqueSorted(primaryDraft.evidenceRefs),
      draftStatus: 'draft' as const
    }));
    return { decision, patterns: [...existing.values()], emittedDrafts };
  }

  if (decision.decisionType === 'merge') {
    const mergeDrafts = uniqueSorted([decision.patternDraftId, ...(decision.relatedDraftIds ?? [])]).map((id) => findDraft(draftArtifact, id));
    const mergedDraft: PatternCardDraft = {
      ...primaryDraft,
      patternId: `merged:${decision.decisionId}`,
      canonicalKey: mergeDrafts.map((draft) => draft.canonicalKey).sort().join('+'),
      title: mergeDrafts.map((draft) => draft.title).sort().join(' + '),
      summary: mergeDrafts.map((draft) => draft.summary).sort().join(' '),
      sourceGroupId: mergeDrafts.map((draft) => draft.sourceGroupId).sort()[0] ?? primaryDraft.sourceGroupId,
      sourceZettelIds: uniqueSorted(mergeDrafts.flatMap((draft) => draft.sourceZettelIds)),
      sourceArtifactPaths: uniqueSorted(mergeDrafts.flatMap((draft) => draft.sourceArtifactPaths)),
      evidenceRefs: uniqueSorted(mergeDrafts.flatMap((draft) => draft.evidenceRefs)),
      linkedContractRefs: uniqueSorted(mergeDrafts.flatMap((draft) => draft.linkedContractRefs)),
      recurrence: {
        cycleCount: mergeDrafts.reduce((sum, draft) => sum + draft.recurrence.cycleCount, 0),
        latestCycleId: mergeDrafts.map((draft) => draft.recurrence.latestCycleId).sort().at(-1) ?? primaryDraft.recurrence.latestCycleId,
        sourceCycleIds: uniqueSorted(mergeDrafts.flatMap((draft) => draft.recurrence.sourceCycleIds))
      }
    };

    const mergedFromPatternIds = mergeDrafts.map((draft) => createStablePatternId(draft));
    const card = createPatternCard({
      draft: mergedDraft,
      decision,
      timestamp: decision.timestamp,
      patternId: decision.resultingPatternIds[0] ?? createStablePatternId(mergedDraft),
      mergedFromPatternIds
    });

    existing.set(card.patternId, card);
    return { decision, patterns: [...existing.values()].sort((a, b) => a.patternId.localeCompare(b.patternId)), emittedDrafts: [] };
  }

  const card = createPatternCard({
    draft: primaryDraft,
    decision,
    timestamp: decision.timestamp,
    patternId: decision.resultingPatternIds[0] ?? createStablePatternId(primaryDraft),
    supersedesPatternIds: decision.decisionType === 'supersede' ? uniqueSorted(decision.relatedPatternIds ?? []) : []
  });

  existing.set(card.patternId, card);

  if (decision.decisionType === 'supersede') {
    for (const supersededId of uniqueSorted(decision.relatedPatternIds ?? [])) {
      const current = existing.get(supersededId);
      if (current) {
        existing.set(
          supersededId,
          markPatternSuperseded(current, { supersededByPatternId: card.patternId, decisionId: decision.decisionId, timestamp: decision.timestamp })
        );
      }
    }
  }

  return { decision, patterns: [...existing.values()].sort((a, b) => a.patternId.localeCompare(b.patternId)), emittedDrafts: [] };
};

export const buildPromotionDecisionArtifact = (input: {
  originCycleId: string;
  createdAt: string;
  decisions: PromotionDecision[];
}): PromotionDecisionArtifact => ({
  schemaVersion: '1.0',
  kind: 'playbook-promotion-decisions',
  artifactId: `promotion-decisions:${input.originCycleId}:${createHash('sha256').update(JSON.stringify(input.decisions)).digest('hex').slice(0, 12)}`,
  originCycleId: input.originCycleId,
  createdAt: input.createdAt,
  decisions: [...input.decisions].sort((a, b) => a.decisionId.localeCompare(b.decisionId))
});

export const buildPatternCardCollectionArtifact = (input: {
  originCycleId: string;
  createdAt: string;
  cards: PatternCard[];
}): PatternCardCollectionArtifact => ({
  schemaVersion: '1.0',
  kind: 'playbook-pattern-cards',
  artifactId: `pattern-cards:${input.originCycleId}:${createHash('sha256').update(JSON.stringify(input.cards)).digest('hex').slice(0, 12)}`,
  originCycleId: input.originCycleId,
  createdAt: input.createdAt,
  cards: [...input.cards].sort((a, b) => a.patternId.localeCompare(b.patternId))
});
