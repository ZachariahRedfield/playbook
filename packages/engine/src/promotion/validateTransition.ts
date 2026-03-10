import type { PromotionDecisionType, PromotionState, PromotionStateTransition } from '../schema/promotionDecision.js';

const ALLOWED: Record<PromotionState, PromotionState[]> = {
  draft: ['hold', 'review', 'promoted', 'rejected'],
  hold: ['review'],
  review: ['promoted', 'deferred', 'rejected'],
  deferred: ['review'],
  rejected: [],
  promoted: ['superseded'],
  superseded: []
};

const DECISION_TO_TARGET: Record<PromotionDecisionType, PromotionState[]> = {
  promote: ['promoted'],
  defer: ['deferred'],
  reject: ['rejected'],
  merge: ['promoted'],
  split: ['draft', 'review'],
  supersede: ['superseded', 'promoted']
};

export const validateTransition = (fromState: PromotionState, toState: PromotionState, decisionType: PromotionDecisionType): PromotionStateTransition => {
  const validationErrors: string[] = [];
  if (!ALLOWED[fromState]?.includes(toState)) {
    validationErrors.push(`Invalid state transition: ${fromState} -> ${toState}`);
  }
  if (!DECISION_TO_TARGET[decisionType]?.includes(toState)) {
    validationErrors.push(`Decision type ${decisionType} cannot produce ${toState}`);
  }
  return {
    fromState,
    toState,
    allowed: validationErrors.length === 0,
    validationErrors
  };
};
