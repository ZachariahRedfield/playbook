import type { BucketedCandidateEntry } from './bucketTypes.js';
import { createPatternCardId } from './patternCardIds.js';
import type { PatternCard, PatternCardReviewDraftArtifact, PatternCardReviewDraftEntry } from './patternCardTypes.js';
import { PATTERN_CARD_SCHEMA_VERSION } from './patternCardTypes.js';

const uniqueSorted = (values: string[]): string[] => Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));

const toPatternCard = (entry: BucketedCandidateEntry & { bucket: 'add' | 'merge' }, supersedes: string[] = []): PatternCard => {
  const invariant = entry.candidate.invariant?.trim() ?? '';
  const response = entry.candidate.response?.trim() ?? '';
  const context = entry.candidate.canonical.normalizedSubject;
  const trigger = entry.candidate.canonical.normalizedTrigger;
  const mechanism = entry.candidate.canonical.normalizedMechanism;
  const implication = response;
  const patternId = createPatternCardId({ trigger, context, mechanism, invariant, implication, response });

  return {
    schemaVersion: PATTERN_CARD_SCHEMA_VERSION,
    kind: 'playbook-pattern-card',
    patternId,
    title: `${entry.candidate.subjectKind}: ${entry.candidate.trigger.trim() || 'candidate pattern'}`,
    status: 'candidate',
    createdFromBucket: entry.bucket,
    trigger,
    context,
    mechanism,
    invariant,
    implication,
    response,
    examples: uniqueSorted([entry.candidate.mechanism.trim(), entry.candidate.trigger.trim()]),
    evidence: uniqueSorted(entry.candidate.evidence.map((evidence) => evidence.summary)),
    sourceKinds: uniqueSorted([entry.candidate.sourceKind]),
    sourceRefs: uniqueSorted([entry.candidate.sourceRef, ...entry.candidate.evidence.map((evidence) => evidence.sourceRef)]),
    relatedModules: [...entry.candidate.related.modules],
    relatedRules: [...entry.candidate.related.rules],
    relatedDocs: [...entry.candidate.related.docs],
    relatedOwners: [...entry.candidate.related.owners],
    relatedTests: [...entry.candidate.related.tests],
    relatedRiskSignals: [...entry.candidate.related.riskSignals],
    relatedGraphNodes: [...entry.candidate.related.graphNodes],
    relatedPatterns: [],
    supersedes: uniqueSorted(supersedes),
    supersededBy: [],
    reviewState: 'pending-review',
    promotionState: 'not-promoted',
    confidence: null,
    notes: entry.notes[0]
  };
};

const upsertEvidence = (card: PatternCard, entry: BucketedCandidateEntry): PatternCard => ({
  ...card,
  createdFromBucket: 'attach',
  evidence: uniqueSorted([...card.evidence, ...entry.candidate.evidence.map((evidence) => evidence.summary)]),
  sourceKinds: uniqueSorted([...card.sourceKinds, entry.candidate.sourceKind]),
  sourceRefs: uniqueSorted([...card.sourceRefs, entry.candidate.sourceRef, ...entry.candidate.evidence.map((evidence) => evidence.sourceRef)]),
  relatedModules: uniqueSorted([...card.relatedModules, ...entry.candidate.related.modules]),
  relatedRules: uniqueSorted([...card.relatedRules, ...entry.candidate.related.rules]),
  relatedDocs: uniqueSorted([...card.relatedDocs, ...entry.candidate.related.docs]),
  relatedOwners: uniqueSorted([...card.relatedOwners, ...entry.candidate.related.owners]),
  relatedTests: uniqueSorted([...card.relatedTests, ...entry.candidate.related.tests]),
  relatedRiskSignals: uniqueSorted([...card.relatedRiskSignals, ...entry.candidate.related.riskSignals]),
  relatedGraphNodes: uniqueSorted([...card.relatedGraphNodes, ...entry.candidate.related.graphNodes]),
  notes: entry.notes[0]
});

const sortReviewEntry = (left: PatternCardReviewDraftEntry, right: PatternCardReviewDraftEntry): number => left.candidateId.localeCompare(right.candidateId);

export const buildPatternCardsFromBuckets = (input: { entries: BucketedCandidateEntry[]; existingCards: PatternCard[] }) => {
  const cardsById = new Map(input.existingCards.map((card) => [card.patternId, card]));
  const sameRunPatternByCandidateId = new Map<string, string>();
  const reviewEntries: PatternCardReviewDraftEntry[] = [];
  const newCards = new Set<string>();

  for (const entry of input.entries) {
    if (entry.bucket === 'discard') {
      reviewEntries.push({ candidateId: entry.candidateId, bucket: 'discard', reason: entry.reason, deferredGeneralizationCandidate: entry.deferredGeneralizationCandidate });
      continue;
    }

    if (entry.bucket === 'attach') {
      const targetPatternId = entry.targetId?.startsWith('draft:') ? sameRunPatternByCandidateId.get(entry.targetId.replace(/^draft:/, '')) : entry.targetId;
      if (targetPatternId && cardsById.has(targetPatternId)) {
        cardsById.set(targetPatternId, upsertEvidence(cardsById.get(targetPatternId) as PatternCard, entry));
      }
      reviewEntries.push({
        candidateId: entry.candidateId,
        bucket: 'attach',
        reason: entry.reason,
        targetPatternId,
        deferredGeneralizationCandidate: entry.deferredGeneralizationCandidate
      });
      continue;
    }

    if (entry.bucket === 'add' || entry.bucket === 'merge') {
      const supersedes = entry.bucket === 'merge' && entry.targetId ? [entry.targetId.replace(/^draft:/, sameRunPatternByCandidateId.get(entry.targetId.replace(/^draft:/, '')) ?? entry.targetId)] : [];
      const card = toPatternCard(entry as BucketedCandidateEntry & { bucket: 'add' | 'merge' }, supersedes);
      cardsById.set(card.patternId, card);
      sameRunPatternByCandidateId.set(entry.candidateId, card.patternId);
      newCards.add(card.patternId);
      reviewEntries.push({
        candidateId: entry.candidateId,
        bucket: entry.bucket,
        reason: entry.reason,
        targetPatternId: supersedes[0],
        draftPatternId: card.patternId,
        deferredGeneralizationCandidate: entry.deferredGeneralizationCandidate
      });
    }
  }

  const attachDecisions = reviewEntries.filter((entry) => entry.bucket === 'attach').sort(sortReviewEntry);
  const mergeDecisions = reviewEntries.filter((entry) => entry.bucket === 'merge').sort(sortReviewEntry);
  const addDecisions = reviewEntries.filter((entry) => entry.bucket === 'add').sort(sortReviewEntry);
  const discarded = reviewEntries.filter((entry) => entry.bucket === 'discard').sort(sortReviewEntry);

  const reviewDraftArtifact: PatternCardReviewDraftArtifact = {
    schemaVersion: '1.0',
    kind: 'playbook-compaction-review-drafts',
    generatedAt: 'deterministic',
    summary: {
      newCardsToReview: newCards.size,
      attach: attachDecisions.length,
      merge: mergeDecisions.length,
      add: addDecisions.length,
      discard: discarded.length,
      deferredGeneralization: reviewEntries.filter((entry) => entry.deferredGeneralizationCandidate).length
    },
    newCardsToReview: [...newCards].sort((a, b) => a.localeCompare(b)),
    attachDecisions,
    mergeDecisions,
    addDecisions,
    discarded
  };

  return {
    cards: Array.from(cardsById.values()).sort((a, b) => a.patternId.localeCompare(b.patternId)),
    reviewDraftArtifact
  };
};
