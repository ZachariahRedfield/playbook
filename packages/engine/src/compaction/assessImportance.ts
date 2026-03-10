import type { CompactionCandidate } from './candidateTypes.js';
import type { ImportanceAssessment, ImportanceLevel, RecurrenceSignal, RelationAssessment } from './bucketTypes.js';

const hasAny = (values: string[], patterns: RegExp[]): boolean => values.some((value) => patterns.some((pattern) => pattern.test(value)));

const toRecurrence = (count: number): RecurrenceSignal => {
  if (count <= 0) return 'none';
  if (count === 1) return 'weak';
  if (count <= 3) return 'medium';
  return 'strong';
};

const toLevel = (score: number): ImportanceLevel => {
  if (score >= 0.75) return 'high';
  if (score >= 0.4) return 'medium';
  return 'low';
};

export const assessImportance = (input: {
  candidate: CompactionCandidate;
  recurrenceCount: number;
  bestRelation?: RelationAssessment;
}): ImportanceAssessment => {
  const { candidate, recurrenceCount, bestRelation } = input;

  const highRiskPatterns = [/high/i, /critical/i, /security/i, /incident/i, /breaking/i];
  const mediumRiskPatterns = [/warn/i, /ownership/i, /drift/i, /stale/i, /failure/i];

  let riskScore = 0.2;
  if (candidate.sourceKind === 'verify' || candidate.sourceKind === 'analyze-pr') riskScore += 0.2;
  if (hasAny(candidate.related.riskSignals, highRiskPatterns)) riskScore += 0.5;
  else if (hasAny(candidate.related.riskSignals, mediumRiskPatterns)) riskScore += 0.25;

  const recurrenceSignal = toRecurrence(recurrenceCount);

  const noveltyScore = (() => {
    if (!bestRelation) return 1;
    if (bestRelation.relationKind === 'same-pattern-different-evidence') return 0.15;
    if (bestRelation.relationKind === 'same-mechanism') return 0.35;
    if (bestRelation.relationKind === 'overlap') return 0.55;
    return 0.9;
  })();

  let transferabilityScore = 0.2;
  if (candidate.related.modules.length > 1 || candidate.subjectKind === 'repository' || candidate.subjectKind === 'rule') transferabilityScore += 0.5;
  else if (candidate.related.modules.length === 1 || candidate.subjectKind === 'module' || candidate.subjectKind === 'docs') transferabilityScore += 0.3;
  if (candidate.mechanism.length > 80) transferabilityScore += 0.1;

  let actionabilityScore = 0.1;
  if ((candidate.response ?? '').length >= 20) actionabilityScore += 0.45;
  if (/\b(run|apply|add|update|fix|align|review)\b/i.test(candidate.response ?? '')) actionabilityScore += 0.25;
  if ((candidate.invariant ?? '').length >= 20) actionabilityScore += 0.1;

  return {
    riskLevel: toLevel(riskScore),
    recurrenceSignal,
    noveltyLevel: toLevel(noveltyScore),
    transferabilityLevel: toLevel(transferabilityScore),
    actionabilityLevel: toLevel(actionabilityScore)
  };
};
