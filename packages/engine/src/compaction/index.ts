import type { RepositoryGraph } from '../graph/repoGraph.js';
import type { RepositoryIndex } from '../indexer/repoIndexer.js';
import { assessImportance } from './assessImportance.js';
import { assessRelation } from './assessRelation.js';
import { bucketCompactionCandidates } from './bucketCandidates.js';
import { buildPatternCardsFromBuckets } from './patternCardFromBucket.js';
import { decideBucket } from './bucketDecision.js';
import { compactionBucketArtifactSchema } from './bucketSchema.js';
import { extractCompactionCandidates } from './extractCandidates.js';
import { buildCompactionBucketArtifact, COMPACTION_BUCKET_ARTIFACT_RELATIVE_PATH, writeCompactionBucketArtifact } from './writeBucketArtifact.js';
import { COMPACTION_CANDIDATE_ARTIFACT_RELATIVE_PATH, buildCompactionCandidateArtifact, writeCompactionCandidateArtifact } from './writeCandidateArtifact.js';
import { readPatternCards, toExistingPatternTargets, writePatternCards } from './patternCardStore.js';
import { COMPACTION_REVIEW_DRAFT_RELATIVE_PATH, writeCompactionReviewDraftArtifact } from './reviewDraftWriter.js';

export const generateCompactionCandidateArtifact = (input: { repoRoot: string; index?: RepositoryIndex; graph?: RepositoryGraph }) => {
  const candidates = extractCompactionCandidates(input);
  const artifact = buildCompactionCandidateArtifact(candidates);
  const artifactPath = writeCompactionCandidateArtifact(input.repoRoot, candidates);
  const existingCards = readPatternCards(input.repoRoot);
  const bucketEntries = bucketCompactionCandidates({ candidates, existingTargets: toExistingPatternTargets(existingCards) });
  const bucketArtifact = buildCompactionBucketArtifact(bucketEntries, candidates.length);
  const bucketArtifactPath = writeCompactionBucketArtifact(input.repoRoot, bucketEntries, candidates.length);
  const patternCardResult = buildPatternCardsFromBuckets({ entries: bucketEntries, existingCards });
  const patternCardPaths = writePatternCards(input.repoRoot, patternCardResult.cards);
  const reviewDraftPath = writeCompactionReviewDraftArtifact(input.repoRoot, patternCardResult.reviewDraftArtifact);

  return {
    artifactPath,
    artifact,
    artifactRelativePath: COMPACTION_CANDIDATE_ARTIFACT_RELATIVE_PATH,
    bucketArtifactPath,
    bucketArtifact,
    bucketArtifactRelativePath: COMPACTION_BUCKET_ARTIFACT_RELATIVE_PATH,
    reviewDraftPath,
    reviewDraftArtifact: patternCardResult.reviewDraftArtifact,
    reviewDraftRelativePath: COMPACTION_REVIEW_DRAFT_RELATIVE_PATH,
    patternCardPaths
  };
};

export { extractCompactionCandidates } from './extractCandidates.js';
export { canonicalizeCandidate } from './canonicalizeCandidate.js';
export { createCandidateFingerprint } from './candidateFingerprint.js';
export { compactionCandidateArtifactSchema } from './candidateSchema.js';
export { bucketCompactionCandidates } from './bucketCandidates.js';
export { assessRelation } from './assessRelation.js';
export { assessImportance } from './assessImportance.js';
export { decideBucket } from './bucketDecision.js';
export { compactionBucketArtifactSchema } from './bucketSchema.js';
export type { CompactionCandidate, CompactionCandidateArtifact, CandidateSourceKind, CandidateSubjectKind } from './candidateTypes.js';
export type {
  BucketDecision,
  BucketTarget,
  BucketedCandidateEntry,
  CompactionBucketArtifact,
  CompactionBucketKind,
  ImportanceAssessment,
  ImportanceLevel,
  RecurrenceSignal,
  RelationAssessment,
  RelationKind
} from './bucketTypes.js';

export { buildCompactionCandidateArtifact, writeCompactionCandidateArtifact, COMPACTION_CANDIDATE_ARTIFACT_RELATIVE_PATH } from './writeCandidateArtifact.js';
export { buildCompactionBucketArtifact, writeCompactionBucketArtifact, COMPACTION_BUCKET_ARTIFACT_RELATIVE_PATH } from './writeBucketArtifact.js';

export { patternCardSchema, patternCardReviewDraftSchema } from './patternCardSchema.js';
export { createPatternCardId } from './patternCardIds.js';
export { buildPatternCardsFromBuckets } from './patternCardFromBucket.js';
export { readPatternCards, writePatternCards, toExistingPatternTargets, PATTERN_CARD_DIRECTORY_RELATIVE_PATH } from './patternCardStore.js';
export { COMPACTION_REVIEW_DRAFT_RELATIVE_PATH, writeCompactionReviewDraftArtifact } from './reviewDraftWriter.js';
export type { PatternCard, PatternCardReviewDraftArtifact, PatternCardReviewDraftEntry } from './patternCardTypes.js';
