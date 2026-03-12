import { readCompactedPatterns, type PatternCompactionArtifact } from '../compaction/compactPatterns.js';

export const queryPatterns = (repoRoot: string): PatternCompactionArtifact => readCompactedPatterns(repoRoot);
