import { readPatternReviewQueue, readPromotedPatterns, type PatternReviewQueueArtifact, type PromotedPatternsArtifact } from '../compaction/promotionQueue.js';

export const queryPatternReviewQueue = (repoRoot: string): PatternReviewQueueArtifact => readPatternReviewQueue(repoRoot);

export const queryPromotedPatterns = (repoRoot: string): PromotedPatternsArtifact => readPromotedPatterns(repoRoot);
