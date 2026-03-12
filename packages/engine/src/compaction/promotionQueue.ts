import fs from 'node:fs';
import path from 'node:path';
import type { PatternCompactionArtifact } from './compactPatterns.js';
import { scorePatternCandidate } from './scorePatternCandidate.js';

type CandidatePattern = {
  id: string;
  sourcePatternId: string;
  canonicalPatternName: string;
  whyItExists: string;
  examples: string[];
  confidence: number;
  reusableEngineeringMeaning: string;
  recurrenceCount: number;
  repoSurfaceBreadth: number;
  remediationUsefulness: number;
  canonicalClarity: number;
  falsePositiveRisk: number;
  promotionScore: number;
  stage: 'candidate' | 'review';
};

type PromotionDecision = {
  candidateId: string;
  decision: 'approve' | 'reject';
  decidedBy: 'human-reviewed-local';
  decidedAt: string;
  rationale: string;
};

type PromotionReviewRecord = {
  candidateId: string;
  canonicalPatternName: string;
  whyItExists: string;
  examples: string[];
  confidence: number;
  reusableEngineeringMeaning: string;
  decision: PromotionDecision;
};

type PromotedPattern = {
  id: string;
  sourceCandidateId: string;
  canonicalPatternName: string;
  whyItExists: string;
  examples: string[];
  confidence: number;
  reusableEngineeringMeaning: string;
  promotedAt: string;
  reviewRecord: PromotionReviewRecord;
};

const REVIEW_QUEUE_RELATIVE_PATH = '.playbook/pattern-review-queue.json' as const;
const PROMOTED_PATTERNS_RELATIVE_PATH = '.playbook/patterns-promoted.json' as const;
const MIN_RECURRENCE_FOR_REVIEW = 2;
const MIN_SCORE_FOR_REVIEW = 0.55;

export type PatternReviewQueueArtifact = {
  schemaVersion: '1.0';
  kind: 'playbook-pattern-review-queue';
  generatedAt: string;
  candidates: CandidatePattern[];
};

export type PromotedPatternsArtifact = {
  schemaVersion: '1.0';
  kind: 'playbook-promoted-patterns';
  promotedPatterns: PromotedPattern[];
};

const readJsonIfExists = <T>(filePath: string): T | null => {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
};

const toCanonicalPatternName = (id: string): string => id.replace(/_/g, ' ').toLowerCase();

const buildWhyItExists = (patternId: string, recurrenceCount: number): string =>
  `Pattern ${patternId} recurs ${recurrenceCount} times across deterministic compaction inputs and warrants explicit review before durable promotion.`;

const buildReusableMeaning = (patternId: string): string =>
  `Reusable engineering meaning: ${patternId} captures a recurring remediation and governance signal that can guide future deterministic analysis.`;

export const buildPatternReviewQueue = (patternsArtifact: PatternCompactionArtifact, generatedAt?: string): PatternReviewQueueArtifact => {
  const candidates = patternsArtifact.patterns
    .map((pattern): CandidatePattern | null => {
      const score = scorePatternCandidate(pattern);
      if (score.recurrenceCount < MIN_RECURRENCE_FOR_REVIEW || score.promotionScore < MIN_SCORE_FOR_REVIEW) {
        return null;
      }

      return {
        id: `candidate-${pattern.id.toLowerCase()}`,
        sourcePatternId: pattern.id,
        canonicalPatternName: toCanonicalPatternName(pattern.id),
        whyItExists: buildWhyItExists(pattern.id, score.recurrenceCount),
        examples: pattern.examples,
        confidence: Number(score.confidence.toFixed(4)),
        reusableEngineeringMeaning: buildReusableMeaning(pattern.id),
        recurrenceCount: score.recurrenceCount,
        repoSurfaceBreadth: Number(score.repoSurfaceBreadth.toFixed(4)),
        remediationUsefulness: Number(score.remediationUsefulness.toFixed(4)),
        canonicalClarity: Number(score.canonicalClarity.toFixed(4)),
        falsePositiveRisk: Number(score.falsePositiveRisk.toFixed(4)),
        promotionScore: Number(score.promotionScore.toFixed(4)),
        stage: 'review'
      };
    })
    .filter((entry): entry is CandidatePattern => entry !== null)
    .sort((left, right) => right.promotionScore - left.promotionScore || left.id.localeCompare(right.id));

  return {
    schemaVersion: '1.0',
    kind: 'playbook-pattern-review-queue',
    generatedAt: generatedAt ?? new Date().toISOString(),
    candidates
  };
};

export const writePatternReviewQueue = (repoRoot: string, artifact: PatternReviewQueueArtifact): string => {
  const outputPath = path.join(repoRoot, REVIEW_QUEUE_RELATIVE_PATH);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  return outputPath;
};

export const readPatternReviewQueue = (repoRoot: string): PatternReviewQueueArtifact => {
  const filePath = path.join(repoRoot, REVIEW_QUEUE_RELATIVE_PATH);
  const artifact = readJsonIfExists<PatternReviewQueueArtifact>(filePath);
  if (!artifact) {
    throw new Error('playbook query pattern-review: missing artifact at .playbook/pattern-review-queue.json. Run "playbook verify" first.');
  }
  return artifact;
};

export const readPromotedPatterns = (repoRoot: string): PromotedPatternsArtifact => {
  const filePath = path.join(repoRoot, PROMOTED_PATTERNS_RELATIVE_PATH);
  const artifact = readJsonIfExists<PromotedPatternsArtifact>(filePath);
  if (!artifact) {
    return { schemaVersion: '1.0', kind: 'playbook-promoted-patterns', promotedPatterns: [] };
  }
  return artifact;
};

export const promotePatternCandidate = (
  repoRoot: string,
  input: { id: string; decision: 'approve' | 'reject'; rationale?: string; decidedAt?: string }
): PromotionReviewRecord => {
  const queue = readPatternReviewQueue(repoRoot);
  const candidate = queue.candidates.find((entry) => entry.id === input.id);
  if (!candidate) {
    throw new Error(`playbook patterns promote: unknown candidate id "${input.id}".`);
  }

  const decision: PromotionDecision = {
    candidateId: candidate.id,
    decision: input.decision,
    decidedBy: 'human-reviewed-local',
    decidedAt: input.decidedAt ?? new Date().toISOString(),
    rationale:
      (input.rationale?.trim() || '') ||
      (input.decision === 'approve'
        ? 'Approved through explicit deterministic local review boundary.'
        : 'Rejected through explicit deterministic local review boundary.')
  };

  const reviewRecord: PromotionReviewRecord = {
    candidateId: candidate.id,
    canonicalPatternName: candidate.canonicalPatternName,
    whyItExists: candidate.whyItExists,
    examples: candidate.examples,
    confidence: candidate.confidence,
    reusableEngineeringMeaning: candidate.reusableEngineeringMeaning,
    decision
  };

  const remaining = queue.candidates.filter((entry) => entry.id !== input.id);
  writePatternReviewQueue(repoRoot, { ...queue, candidates: remaining });

  if (decision.decision === 'approve') {
    const promoted = readPromotedPatterns(repoRoot);
    const promotedPattern: PromotedPattern = {
      id: candidate.sourcePatternId,
      sourceCandidateId: candidate.id,
      canonicalPatternName: candidate.canonicalPatternName,
      whyItExists: candidate.whyItExists,
      examples: candidate.examples,
      confidence: candidate.confidence,
      reusableEngineeringMeaning: candidate.reusableEngineeringMeaning,
      promotedAt: decision.decidedAt,
      reviewRecord
    };

    const nextPromotedPatterns = [...promoted.promotedPatterns.filter((entry) => entry.id !== promotedPattern.id), promotedPattern].sort(
      (left, right) => left.id.localeCompare(right.id)
    );

    const outputPath = path.join(repoRoot, PROMOTED_PATTERNS_RELATIVE_PATH);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(
      outputPath,
      `${JSON.stringify({ schemaVersion: '1.0', kind: 'playbook-promoted-patterns', promotedPatterns: nextPromotedPatterns }, null, 2)}\n`,
      'utf8'
    );
  }

  return reviewRecord;
};

export const PATTERN_REVIEW_QUEUE_RELATIVE_PATH = REVIEW_QUEUE_RELATIVE_PATH;
export const PROMOTED_PATTERNS_ARTIFACT_RELATIVE_PATH = PROMOTED_PATTERNS_RELATIVE_PATH;
