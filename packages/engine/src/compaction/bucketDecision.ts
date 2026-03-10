import type { BucketDecision, ImportanceAssessment, RelationAssessment } from './bucketTypes.js';
import type { CompactionCandidate } from './candidateTypes.js';

const isOverSpecificCandidate = (candidate: CompactionCandidate, importance: ImportanceAssessment): boolean => {
  const mechanism = candidate.canonical.normalizedMechanism;
  const hasStableMechanism = mechanism.length >= 15;
  const lowValue =
    importance.transferabilityLevel === 'low' &&
    importance.actionabilityLevel === 'low' &&
    importance.noveltyLevel === 'low' &&
    importance.riskLevel !== 'high';

  return !hasStableMechanism || lowValue;
};

export const decideBucket = (input: {
  candidate: CompactionCandidate;
  bestRelation?: RelationAssessment;
  importance: ImportanceAssessment;
}): BucketDecision => {
  const { candidate, bestRelation, importance } = input;

  if (isOverSpecificCandidate(candidate, importance)) {
    return {
      bucket: 'discard',
      reason: 'candidate is over-specific/noisy with low transferability and actionability',
      deferredGeneralizationCandidate: false
    };
  }

  if (bestRelation && bestRelation.similarityScore >= 0.98 && bestRelation.mechanismMatch && bestRelation.evidenceOnlyDifference) {
    return {
      bucket: 'discard',
      reason: 'candidate is low-value duplicate noise of existing abstraction',
      targetId: bestRelation.targetId,
      deferredGeneralizationCandidate: false
    };
  }

  if (bestRelation?.relationKind === 'same-pattern-different-evidence') {
    return {
      bucket: 'attach',
      reason: 'candidate adds supporting evidence for an existing pattern without abstraction change',
      targetId: bestRelation.targetId,
      deferredGeneralizationCandidate: false
    };
  }

  if (bestRelation?.relationKind === 'same-mechanism') {
    return {
      bucket: 'merge',
      reason: 'candidate and target share mechanism/invariant and should be compressed into one abstraction',
      targetId: bestRelation.targetId,
      deferredGeneralizationCandidate: false
    };
  }

  const deferredGeneralizationCandidate =
    bestRelation?.relationKind === 'overlap' &&
    bestRelation.synergySignal &&
    importance.noveltyLevel !== 'low' &&
    importance.transferabilityLevel !== 'low';

  return {
    bucket: 'add',
    reason: 'candidate contains a distinct mechanism or materially different invariant/response',
    deferredGeneralizationCandidate
  };
};
