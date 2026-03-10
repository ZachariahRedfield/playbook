import type { CompactionCandidate } from './candidateTypes.js';
import type { BucketTarget, RelationAssessment, RelationKind } from './bucketTypes.js';

const tokenize = (value?: string): string[] =>
  (value ?? '')
    .split(/[^a-z0-9]+/i)
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length >= 3);

const jaccard = (left: string[], right: string[]): number => {
  if (left.length === 0 && right.length === 0) return 1;
  if (left.length === 0 || right.length === 0) return 0;
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  let intersection = 0;
  for (const token of leftSet) {
    if (rightSet.has(token)) intersection += 1;
  }
  const union = new Set([...leftSet, ...rightSet]).size;
  return union === 0 ? 0 : intersection / union;
};

const arrayOverlap = (left: string[], right: string[]): number => {
  if (left.length === 0 && right.length === 0) return 1;
  if (left.length === 0 || right.length === 0) return 0;
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  let overlap = 0;
  for (const value of leftSet) {
    if (rightSet.has(value)) overlap += 1;
  }
  return overlap / Math.max(leftSet.size, rightSet.size);
};

const compareOptional = (left?: string, right?: string): boolean | 'unknown' => {
  if (!left || !right) return 'unknown';
  return left.trim().toLowerCase() === right.trim().toLowerCase();
};

const bounded = (value: number): number => Math.max(0, Math.min(1, Number(value.toFixed(3))));

const relationKindFromSignals = (input: {
  mechanismMatch: boolean;
  invariantMatch: boolean | 'unknown';
  responseMatch: boolean | 'unknown';
  evidenceOnlyDifference: boolean;
  similarityScore: number;
}): RelationKind => {
  if (input.mechanismMatch && input.evidenceOnlyDifference) return 'same-pattern-different-evidence';
  if (input.mechanismMatch) return 'same-mechanism';
  if (input.similarityScore >= 0.45) return 'overlap';
  return 'distinct';
};

export const assessRelation = (candidate: CompactionCandidate, target: BucketTarget): RelationAssessment => {
  const triggerSimilarity = jaccard(tokenize(candidate.canonical.normalizedTrigger), tokenize(target.candidate.canonical.normalizedTrigger));
  const mechanismSimilarity = jaccard(tokenize(candidate.canonical.normalizedMechanism), tokenize(target.candidate.canonical.normalizedMechanism));
  const subjectSimilarity = candidate.canonical.normalizedSubject === target.candidate.canonical.normalizedSubject ? 1 : 0;
  const responseSimilarity = jaccard(tokenize(candidate.response), tokenize(target.candidate.response));

  const moduleOverlap = arrayOverlap(candidate.related.modules, target.candidate.related.modules);
  const ruleOverlap = arrayOverlap(candidate.related.rules, target.candidate.related.rules);
  const docsOverlap = arrayOverlap(candidate.related.docs, target.candidate.related.docs);
  const ownersOverlap = arrayOverlap(candidate.related.owners, target.candidate.related.owners);
  const testsOverlap = arrayOverlap(candidate.related.tests, target.candidate.related.tests);
  const riskOverlap = arrayOverlap(candidate.related.riskSignals, target.candidate.related.riskSignals);

  const exactMechanismMatch = candidate.canonical.normalizedMechanism === target.candidate.canonical.normalizedMechanism;
  const mechanismMatch = mechanismSimilarity >= 0.86;
  const invariantMatch = compareOptional(candidate.invariant, target.candidate.invariant);
  const responseMatch = compareOptional(candidate.response, target.candidate.response);

  const evidenceOnlyDifference =
    exactMechanismMatch &&
    (invariantMatch === true || invariantMatch === 'unknown') &&
    (responseMatch === true || responseMatch === 'unknown') &&
    triggerSimilarity >= 0.6;

  const similarityScore = bounded(
    mechanismSimilarity * 0.45 +
      triggerSimilarity * 0.15 +
      responseSimilarity * 0.15 +
      subjectSimilarity * 0.1 +
      ((moduleOverlap + ruleOverlap + docsOverlap + ownersOverlap + testsOverlap + riskOverlap) / 6) * 0.15
  );

  const relationKind = relationKindFromSignals({ mechanismMatch, invariantMatch, responseMatch, evidenceOnlyDifference, similarityScore });
  const synergySignal = relationKind === 'overlap' && !evidenceOnlyDifference && (moduleOverlap > 0 || ruleOverlap > 0 || riskOverlap > 0);

  return {
    targetId: target.targetId,
    relationKind,
    similarityScore,
    mechanismMatch,
    invariantMatch,
    responseMatch,
    evidenceOnlyDifference,
    synergySignal
  };
};
