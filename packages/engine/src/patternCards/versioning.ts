import type { PatternCard } from '../schema/patternCard.js';
import type { PromotionDecisionType, PromotionState } from '../schema/promotionDecision.js';

export const appendPatternVersion = (card: PatternCard, input: { decisionId: string; decisionType: PromotionDecisionType; timestamp: string; state: PromotionState }): PatternCard => {
  const nextVersion = card.currentVersion + 1;
  return {
    ...card,
    state: input.state,
    updatedAt: input.timestamp,
    currentVersion: nextVersion,
    versionHistory: [...card.versionHistory, { version: nextVersion, decisionId: input.decisionId, decisionType: input.decisionType, timestamp: input.timestamp, state: input.state }],
    lineage: { ...card.lineage, decisionIds: [...new Set([...card.lineage.decisionIds, input.decisionId])] },
    versionRef: { ...card.versionRef, version: nextVersion, status: input.state }
  };
};

export const markPatternSuperseded = (card: PatternCard, input: { supersededByPatternId: string; decisionId: string; timestamp: string }): PatternCard => {
  const next = appendPatternVersion(card, { decisionId: input.decisionId, decisionType: 'supersede', timestamp: input.timestamp, state: 'superseded' });
  return {
    ...next,
    versionRef: { ...next.versionRef, supersededBy: input.supersededByPatternId }
  };
};
