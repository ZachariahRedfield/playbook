export const PATTERN_BUCKETS = ['architecture', 'testing', 'dependency', 'documentation', 'governance'] as const;

export type PatternBucket = (typeof PATTERN_BUCKETS)[number];

export const resolvePatternBucket = (patternId: string): PatternBucket => {
  if (patternId.includes('TEST')) {
    return 'testing';
  }

  if (patternId.includes('DEPENDENCY')) {
    return 'dependency';
  }

  if (patternId.includes('DOC')) {
    return 'documentation';
  }

  if (patternId.includes('GOVERNANCE') || patternId.includes('NOTES')) {
    return 'governance';
  }

  return 'architecture';
};
