import type { PatternCard } from '../schema/patternCard.js';

export const appendPatternVersion = (card: PatternCard, input: { decisionId: string; decisionType: 'promote' | 'merge' | 'supersede'; timestamp: string }): PatternCard => {
  const nextVersion = card.currentVersion + 1;
  return {
    ...card,
    updatedAt: input.timestamp,
    currentVersion: nextVersion,
    versionHistory: [...card.versionHistory, { version: nextVersion, decisionId: input.decisionId, decisionType: input.decisionType, timestamp: input.timestamp }],
    lineage: {
      ...card.lineage,
      decisionIds: [...new Set([...card.lineage.decisionIds, input.decisionId])]
    }
  };
};

export const markPatternSuperseded = (card: PatternCard, input: { supersededByPatternId: string; decisionId: string; timestamp: string }): PatternCard => {
  const next = appendPatternVersion(card, { decisionId: input.decisionId, decisionType: 'supersede', timestamp: input.timestamp });
  return {
    ...next,
    status: 'superseded',
    supersededByPatternId: input.supersededByPatternId
  };
};
