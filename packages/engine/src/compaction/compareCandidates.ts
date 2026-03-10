import type { CompactionCandidate } from './candidateTypes.js';
import type { BucketTarget, RelationAssessment } from './bucketTypes.js';
import { assessRelation } from './assessRelation.js';

const relationPriority = (relation: RelationAssessment): number => {
  if (relation.relationKind === 'same-pattern-different-evidence') return 4;
  if (relation.relationKind === 'same-mechanism') return 3;
  if (relation.relationKind === 'overlap') return 2;
  return 1;
};

const byRelationRank = (left: RelationAssessment, right: RelationAssessment): number =>
  relationPriority(right) - relationPriority(left) || right.similarityScore - left.similarityScore || left.targetId.localeCompare(right.targetId);

export const compareCandidateToTargets = (candidate: CompactionCandidate, targets: BucketTarget[]): { best?: RelationAssessment; all: RelationAssessment[] } => {
  if (targets.length === 0) return { all: [] };
  const all = targets.map((target) => assessRelation(candidate, target)).sort(byRelationRank);
  return { best: all[0], all };
};
