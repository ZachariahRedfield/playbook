import type { PatternCardDraftArtifact } from '../schema/patternCardDraft.js';
import type { DecisionBatch, PromotionDecision } from '../schema/promotionDecision.js';
import { applyPromotionDecision, type ApplyPromotionDecisionResult } from './applyPromotionDecision.js';

const byReplayOrder = (a: PromotionDecision, b: PromotionDecision): number => {
  if (a.originCycleId !== b.originCycleId) return a.originCycleId.localeCompare(b.originCycleId);
  if (a.sequence !== b.sequence) return a.sequence - b.sequence;
  if (a.timestamp !== b.timestamp) return a.timestamp.localeCompare(b.timestamp);
  return a.decisionId.localeCompare(b.decisionId);
};

export type ReplayDecisionJournalResult = {
  final: ApplyPromotionDecisionResult;
  appliedDecisionIds: string[];
};

export const replayDecisionJournal = (input: { draftArtifact: PatternCardDraftArtifact; batch: DecisionBatch }): ReplayDecisionJournalResult => {
  const ordered = [...input.batch.decisions].sort(byReplayOrder);
  let result: ApplyPromotionDecisionResult = {
    decision: ordered[0],
    patterns: [],
    emittedDrafts: [],
    terminalRecords: [],
    transitions: []
  };

  for (const decision of ordered) {
    result = applyPromotionDecision({
      draftArtifact: input.draftArtifact,
      decision,
      existingPatterns: result.patterns
    });
  }

  return {
    final: result,
    appliedDecisionIds: ordered.map((decision) => decision.decisionId)
  };
};
