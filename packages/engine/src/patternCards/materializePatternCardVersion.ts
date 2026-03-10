import type { PatternCard } from '../schema/patternCard.js';
import type { PatternCardDraft } from '../schema/patternCardDraft.js';
import type { PatternCardVersionRef, PromotionDecision, PromotionState } from '../schema/promotionDecision.js';

const uniqueSorted = (values: string[]): string[] => [...new Set(values)].sort();

export const materializePatternCardVersion = (input: {
  decision: PromotionDecision;
  draft: PatternCardDraft;
  patternId: string;
  state: PromotionState;
  previous?: PatternCard;
  parentPatternIds?: string[];
  supersedes?: string;
  supersededBy?: string;
}): PatternCard => {
  const version = (input.previous?.currentVersion ?? 0) + 1;
  const previousLineage = input.previous?.lineage;
  const versionRef: PatternCardVersionRef = {
    patternId: input.patternId,
    version,
    status: input.state,
    supersedes: input.supersedes,
    supersededBy: input.supersededBy
  };

  return {
    schemaVersion: '1.0',
    kind: 'playbook-pattern-card',
    patternId: input.patternId,
    canonicalKey: input.draft.canonicalKey,
    title: input.draft.title,
    summary: input.draft.summary,
    mechanism: input.draft.mechanism,
    invariant: input.draft.invariant,
    linkedContractRefs: uniqueSorted(input.draft.linkedContractRefs),
    state: input.state,
    createdAt: input.previous?.createdAt ?? input.decision.timestamp,
    updatedAt: input.decision.timestamp,
    currentVersion: version,
    versionHistory: [
      ...(input.previous?.versionHistory ?? []),
      {
        version,
        decisionId: input.decision.decisionId,
        decisionType: input.decision.decisionType,
        timestamp: input.decision.timestamp,
        state: input.state
      }
    ],
    lineage: {
      originCycleIds: uniqueSorted([...(previousLineage?.originCycleIds ?? []), input.draft.originCycleId, input.decision.originCycleId]),
      sourceDraftIds: uniqueSorted([...(previousLineage?.sourceDraftIds ?? []), ...input.decision.inputDraftIds]),
      sourceGroupIds: uniqueSorted([...(previousLineage?.sourceGroupIds ?? []), ...input.decision.lineage.sourceGroupIds]),
      sourceZettelIds: uniqueSorted([...(previousLineage?.sourceZettelIds ?? []), ...input.decision.lineage.sourceZettelIds]),
      sourceArtifactPaths: uniqueSorted([...(previousLineage?.sourceArtifactPaths ?? []), ...input.decision.lineage.sourceArtifactPaths]),
      evidenceRefs: uniqueSorted([...(previousLineage?.evidenceRefs ?? []), ...input.draft.evidenceRefs, ...input.decision.evidenceRefs]),
      parentPatternIds: uniqueSorted([...(previousLineage?.parentPatternIds ?? []), ...(input.parentPatternIds ?? []), ...input.decision.inputPatternIds]),
      priorVersionIds: uniqueSorted([...(previousLineage?.priorVersionIds ?? []), ...input.decision.lineage.priorVersionIds]),
      decisionIds: uniqueSorted([...(previousLineage?.decisionIds ?? []), input.decision.decisionId])
    },
    versionRef
  };
};
