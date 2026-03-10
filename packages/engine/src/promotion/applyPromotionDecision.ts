import { createHash } from 'node:crypto';
import type { PatternCard } from '../schema/patternCard.js';
import type { PatternCardDraft, PatternCardDraftArtifact } from '../schema/patternCardDraft.js';
import type { DecisionBatch, PromotionDecision, PromotionState, PromotionStateTransition } from '../schema/promotionDecision.js';
import { materializePatternCardVersion } from '../patternCards/materializePatternCardVersion.js';
import { validateTransition } from './validateTransition.js';

const uniqueSorted = (values: string[]): string[] => [...new Set(values)].sort();

const findDraft = (artifact: PatternCardDraftArtifact, draftId: string): PatternCardDraft => {
  const draft = artifact.drafts.find((item) => item.patternId === draftId);
  if (!draft) throw new Error(`Promotion decision references missing draft: ${draftId}`);
  return draft;
};

const draftState = (draft: PatternCardDraft): PromotionState => (draft.draftStatus === 'review' || draft.draftStatus === 'ready' ? 'review' : 'draft');

const stateByPatternId = (patterns: PatternCard[]): Map<string, PromotionState> =>
  new Map(patterns.map((pattern) => [pattern.patternId, pattern.state]));

const defaultTransitionState = (decision: PromotionDecision, draftArtifact: PatternCardDraftArtifact, existingPatterns: PatternCard[]): PromotionState => {
  if (decision.decisionType === 'merge' || decision.decisionType === 'split') {
    return decision.inputDraftIds.length > 0 ? draftState(findDraft(draftArtifact, decision.inputDraftIds[0])) : 'review';
  }
  if (decision.inputPatternIds.length > 0) {
    const states = stateByPatternId(existingPatterns);
    return states.get(decision.inputPatternIds[0]) ?? 'promoted';
  }
  if (decision.inputDraftIds.length > 0) {
    return draftState(findDraft(draftArtifact, decision.inputDraftIds[0]));
  }
  return 'draft';
};

const buildTerminalRecord = (decision: PromotionDecision) => ({
  decisionId: decision.decisionId,
  patternIds: uniqueSorted(decision.inputPatternIds),
  inputDraftIds: uniqueSorted(decision.inputDraftIds),
  resultingState: decision.resultingState,
  timestamp: decision.timestamp,
  reason: decision.decisionReason,
  lineage: decision.lineage
});

export type ApplyPromotionDecisionInput = {
  draftArtifact: PatternCardDraftArtifact;
  decision: PromotionDecision;
  existingPatterns?: PatternCard[];
};

export type ApplyPromotionDecisionResult = {
  decision: PromotionDecision;
  patterns: PatternCard[];
  emittedDrafts: PatternCardDraft[];
  terminalRecords: Array<ReturnType<typeof buildTerminalRecord>>;
  transitions: PromotionStateTransition[];
};

export const applyPromotionDecision = ({ draftArtifact, decision, existingPatterns = [] }: ApplyPromotionDecisionInput): ApplyPromotionDecisionResult => {
  const existing = new Map(existingPatterns.map((pattern) => [pattern.patternId, pattern]));
  const emittedDrafts: PatternCardDraft[] = [];
  const terminalRecords: Array<ReturnType<typeof buildTerminalRecord>> = [];
  const transitions: PromotionStateTransition[] = [];

  const inputState = defaultTransitionState(decision, draftArtifact, existingPatterns);
  const transition = validateTransition(inputState, decision.resultingState, decision.decisionType);
  transitions.push(transition);
  if (!transition.allowed) {
    throw new Error(transition.validationErrors.join('; '));
  }

  if (decision.decisionType === 'defer' || decision.decisionType === 'reject') {
    terminalRecords.push(buildTerminalRecord(decision));
    return { decision, patterns: [...existing.values()], emittedDrafts, terminalRecords, transitions };
  }

  if (decision.decisionType === 'split') {
    const sourceDraft = findDraft(draftArtifact, decision.inputDraftIds[0]);
    for (const [index, patternId] of decision.resultingPatternIds.entries()) {
      emittedDrafts.push({
        ...sourceDraft,
        patternId,
        draftStatus: index === 0 ? 'review' : 'draft'
      });
      terminalRecords.push(buildTerminalRecord({ ...decision, resultingPatternIds: [patternId] }));
    }
    return { decision, patterns: [...existing.values()], emittedDrafts, terminalRecords, transitions };
  }

  const primaryDraft = findDraft(draftArtifact, decision.inputDraftIds[0]);
  if (decision.decisionType === 'merge') {
    const targetPatternId = decision.resultingPatternIds[0];
    const merged = materializePatternCardVersion({
      decision,
      draft: primaryDraft,
      patternId: targetPatternId,
      state: 'promoted',
      parentPatternIds: decision.inputPatternIds
    });
    existing.set(targetPatternId, merged);
    return { decision, patterns: [...existing.values()].sort((a, b) => a.patternId.localeCompare(b.patternId)), emittedDrafts, terminalRecords, transitions };
  }

  if (decision.decisionType === 'supersede') {
    const supersededPatternId = decision.inputPatternIds[0];
    const supersededPattern = existing.get(supersededPatternId);
    if (!supersededPattern) {
      throw new Error(`Supersede decision references missing promoted pattern: ${supersededPatternId}`);
    }

    const supersededCard = materializePatternCardVersion({
      decision,
      draft: primaryDraft,
      patternId: supersededPattern.patternId,
      state: 'superseded',
      previous: supersededPattern,
      supersededBy: decision.resultingPatternIds[0]
    });
    existing.set(supersededPattern.patternId, supersededCard);

    const replacement = materializePatternCardVersion({
      decision,
      draft: primaryDraft,
      patternId: decision.resultingPatternIds[0],
      state: 'promoted',
      supersedes: supersededPattern.patternId,
      parentPatternIds: [supersededPattern.patternId]
    });
    existing.set(replacement.patternId, replacement);
    terminalRecords.push(buildTerminalRecord({ ...decision, resultingState: 'superseded', resultingPatternIds: [supersededPattern.patternId] }));
    return { decision, patterns: [...existing.values()].sort((a, b) => a.patternId.localeCompare(b.patternId)), emittedDrafts, terminalRecords, transitions };
  }

  const promotedPattern = materializePatternCardVersion({
    decision,
    draft: primaryDraft,
    patternId: decision.resultingPatternIds[0],
    state: 'promoted',
    parentPatternIds: decision.inputPatternIds
  });
  existing.set(promotedPattern.patternId, promotedPattern);

  return { decision, patterns: [...existing.values()].sort((a, b) => a.patternId.localeCompare(b.patternId)), emittedDrafts, terminalRecords, transitions };
};

export const buildPromotionDecisionArtifact = (input: { originCycleId: string; createdAt: string; decisions: PromotionDecision[] }): DecisionBatch => ({
  schemaVersion: '1.0',
  kind: 'playbook-promotion-decision-batch',
  batchId: `promotion-decisions:${input.originCycleId}:${createHash('sha256').update(JSON.stringify(input.decisions)).digest('hex').slice(0, 12)}`,
  originCycleId: input.originCycleId,
  createdAt: input.createdAt,
  decisions: [...input.decisions].sort((a, b) => a.sequence - b.sequence || a.decisionId.localeCompare(b.decisionId))
});

export const buildPatternCardCollectionArtifact = (input: { originCycleId: string; createdAt: string; cards: PatternCard[] }) => ({
  schemaVersion: '1.0' as const,
  kind: 'playbook-pattern-cards' as const,
  artifactId: `pattern-cards:${input.originCycleId}:${createHash('sha256').update(JSON.stringify(input.cards)).digest('hex').slice(0, 12)}`,
  originCycleId: input.originCycleId,
  createdAt: input.createdAt,
  cards: [...input.cards].sort((a, b) => a.patternId.localeCompare(b.patternId))
});
