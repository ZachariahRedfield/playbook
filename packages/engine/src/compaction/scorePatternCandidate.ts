import type { CompactedPattern } from './compactPatterns.js';

export type PatternCandidateScore = {
  recurrenceCount: number;
  repoSurfaceBreadth: number;
  remediationUsefulness: number;
  canonicalClarity: number;
  falsePositiveRisk: number;
  promotionScore: number;
  confidence: number;
};

const clamp = (value: number, min = 0, max = 1): number => Math.min(max, Math.max(min, value));

const computeRepoSurfaceBreadth = (pattern: CompactedPattern): number => {
  const tokenBreadth = new Set(pattern.examples.join(' ').toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 3)).size;
  return clamp(tokenBreadth / 12);
};

const computeRemediationUsefulness = (pattern: CompactedPattern): number => {
  if (pattern.bucket === 'governance' || pattern.bucket === 'testing') return 0.85;
  if (pattern.bucket === 'architecture') return 0.8;
  return 0.65;
};

const computeCanonicalClarity = (pattern: CompactedPattern): number => {
  const idSignal = /^[A-Z0-9_]+$/.test(pattern.id) ? 0.65 : 0.5;
  const exampleSignal = pattern.examples.length > 0 ? 0.25 : 0;
  const lengthSignal = pattern.id.length <= 80 ? 0.1 : 0;
  return clamp(idSignal + exampleSignal + lengthSignal);
};

const computeFalsePositiveRisk = (pattern: CompactedPattern): number => {
  const noisyTokens = ['misc', 'other', 'unknown', 'general'];
  const hasNoisyToken = noisyTokens.some((token) => pattern.id.toLowerCase().includes(token));
  return clamp((hasNoisyToken ? 0.4 : 0.15) + (pattern.occurrences <= 1 ? 0.35 : 0));
};

export const scorePatternCandidate = (pattern: CompactedPattern): PatternCandidateScore => {
  const recurrenceCount = pattern.occurrences;
  const recurrenceSignal = clamp(recurrenceCount / 5);
  const repoSurfaceBreadth = computeRepoSurfaceBreadth(pattern);
  const remediationUsefulness = computeRemediationUsefulness(pattern);
  const canonicalClarity = computeCanonicalClarity(pattern);
  const falsePositiveRisk = computeFalsePositiveRisk(pattern);

  const promotionScore = clamp(
    recurrenceSignal * 0.32 +
      repoSurfaceBreadth * 0.2 +
      remediationUsefulness * 0.22 +
      canonicalClarity * 0.18 +
      (1 - falsePositiveRisk) * 0.08
  );

  const confidence = clamp(promotionScore * 0.85 + recurrenceSignal * 0.15);

  return {
    recurrenceCount,
    repoSurfaceBreadth,
    remediationUsefulness,
    canonicalClarity,
    falsePositiveRisk,
    promotionScore,
    confidence
  };
};
