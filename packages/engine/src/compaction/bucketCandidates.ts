import type { CompactionCandidate } from './candidateTypes.js';
import type { BucketTarget, BucketedCandidateEntry } from './bucketTypes.js';
import { compareCandidateToTargets } from './compareCandidates.js';
import { assessImportance } from './assessImportance.js';
import { decideBucket } from './bucketDecision.js';

type BucketInput = {
  candidates: CompactionCandidate[];
  existingTargets?: BucketTarget[];
};

const byCandidateOrder = (left: CompactionCandidate, right: CompactionCandidate): number =>
  left.sourceKind.localeCompare(right.sourceKind) ||
  left.subjectKind.localeCompare(right.subjectKind) ||
  left.subjectRef.localeCompare(right.subjectRef) ||
  left.canonical.fingerprint.localeCompare(right.canonical.fingerprint);

const fallbackDistinctRelation = (candidate: CompactionCandidate) => ({
  targetId: `${candidate.candidateId}:none`,
  relationKind: 'distinct' as const,
  similarityScore: 0,
  mechanismMatch: false,
  invariantMatch: 'unknown' as const,
  responseMatch: 'unknown' as const,
  evidenceOnlyDifference: false,
  synergySignal: false
});

export const bucketCompactionCandidates = (input: BucketInput): BucketedCandidateEntry[] => {
  const candidates = [...input.candidates].sort(byCandidateOrder);
  const existingTargets = [...(input.existingTargets ?? [])].sort((a, b) => a.targetId.localeCompare(b.targetId));
  const recurrenceByFingerprint = new Map<string, number>();

  for (const candidate of candidates) {
    recurrenceByFingerprint.set(candidate.canonical.fingerprint, (recurrenceByFingerprint.get(candidate.canonical.fingerprint) ?? 0) + 1);
  }

  const entries: BucketedCandidateEntry[] = [];
  const runTargets: BucketTarget[] = [...existingTargets];

  for (const candidate of candidates) {
    const { best } = compareCandidateToTargets(candidate, runTargets);
    const importance = assessImportance({
      candidate,
      recurrenceCount: recurrenceByFingerprint.get(candidate.canonical.fingerprint) ?? 1,
      bestRelation: best
    });
    const decision = decideBucket({ candidate, bestRelation: best, importance });
    const selectedTarget = decision.targetId ? runTargets.find((target) => target.targetId === decision.targetId) : undefined;

    const notes = [
      decision.deferredGeneralizationCandidate ? 'deferred generalization candidate flagged for later lifecycle stage' : 'no generalization required in this stage'
    ];

    const entry: BucketedCandidateEntry = {
      candidateId: candidate.candidateId,
      candidateFingerprint: candidate.canonical.fingerprint,
      bucket: decision.bucket,
      reason: decision.reason,
      targetId: decision.targetId,
      targetOrigin: selectedTarget?.origin,
      deferredGeneralizationCandidate: decision.deferredGeneralizationCandidate,
      relation: best ?? fallbackDistinctRelation(candidate),
      importance,
      notes,
      candidate
    };

    entries.push(entry);

    if (decision.bucket === 'add' || decision.bucket === 'merge') {
      runTargets.push({
        targetId: `draft:${candidate.candidateId}`,
        origin: 'same-run-draft',
        candidate
      });
    }
  }

  return entries;
};
