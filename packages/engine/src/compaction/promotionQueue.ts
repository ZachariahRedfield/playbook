import fs from 'node:fs';
import path from 'node:path';
import type { PatternCompactionArtifact } from './compactPatterns.js';
import { scorePatternCandidate } from './scorePatternCandidate.js';
import type { AttractorScoreBreakdown } from './scorePatternCandidate.js';
import type { PatternConvergenceArtifact, PatternConvergenceCluster } from '../learning/patternConvergence.js';
import { PATTERN_CONVERGENCE_RELATIVE_PATH } from '../learning/patternConvergence.js';

export type ConvergencePrioritySuggestion = {
  proposalOnly: true;
  suggestedPriority: 'low' | 'medium' | 'high';
  weightedScore: number;
  weightingFactors: {
    basePromotionScore: number;
    convergenceConfidence: number;
    convergenceMemberCount: number;
    clusterMatch: boolean;
  };
  rationale: string;
  matchedClusterId: string | null;
};

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
  attractorScoreBreakdown: AttractorScoreBreakdown;
  convergencePrioritySuggestion: ConvergencePrioritySuggestion;
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
const DOCTRINE_CANDIDATES_RELATIVE_PATH = '.playbook/doctrine-candidates.json' as const;
const MIN_RECURRENCE_FOR_REVIEW = 2;
const MIN_SCORE_FOR_REVIEW = 0.55;

const DOCTRINE_MIN_STRENGTH = 0.85;
const DOCTRINE_MIN_EVIDENCE_REFS = 3;
const DOCTRINE_MIN_INSTANCES = 3;
const DOCTRINE_MIN_OUTCOME_CONFIDENCE = 0.6;

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

export type DoctrineCandidate = {
  candidateId: string;
  sourcePatternId: string;
  title: string;
  guidance: string;
  metrics: {
    strength: number;
    evidence_refs: number;
    instances: number;
    outcome_confidence: number;
  };
  evidenceRefs: string[];
  reviewState: 'review_required';
};

export type DoctrineCandidatesArtifact = {
  schemaVersion: '1.0';
  kind: 'playbook-doctrine-candidates';
  generatedAt: string;
  promotionCriteria: {
    strength: number;
    evidence_refs: number;
    instances: number;
    outcome_confidence: number;
  };
  reviewOnly: true;
  candidates: DoctrineCandidate[];
};

const readJsonIfExists = <T>(filePath: string): T | null => {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
};

const readConvergenceArtifactIfPresent = (repoRoot?: string): PatternConvergenceArtifact | null => {
  if (!repoRoot) return null;
  const artifactPath = path.join(repoRoot, PATTERN_CONVERGENCE_RELATIVE_PATH);
  return readJsonIfExists<PatternConvergenceArtifact>(artifactPath);
};

const toCanonicalPatternName = (id: string): string => id.replace(/_/g, ' ').toLowerCase();

const buildWhyItExists = (patternId: string, recurrenceCount: number): string =>
  `Pattern ${patternId} recurs ${recurrenceCount} times across deterministic compaction inputs and warrants explicit review before durable promotion.`;

const buildReusableMeaning = (patternId: string): string =>
  `Reusable engineering meaning: ${patternId} captures a recurring remediation and governance signal that can guide future deterministic analysis.`;

const findBestConvergenceCluster = (patternId: string, clusters: PatternConvergenceCluster[]): PatternConvergenceCluster | null => {
  const normalizedId = patternId.toLowerCase();
  return clusters.find((cluster) => {
    const clusterText = `${cluster.clusterId} ${cluster.intent} ${cluster.constraint_class} ${cluster.resolution_strategy}`.toLowerCase();
    return normalizedId.split('_').some((token) => token.length > 2 && clusterText.includes(token));
  }) ?? null;
};

const buildConvergencePrioritySuggestion = (patternId: string, promotionScore: number, clusters: PatternConvergenceCluster[]): ConvergencePrioritySuggestion => {
  const matchedCluster = findBestConvergenceCluster(patternId, clusters);
  const convergenceConfidence = matchedCluster?.convergence_confidence ?? 0;
  const convergenceMemberCount = matchedCluster?.members.length ?? 0;
  const weightedScore = Number((promotionScore * 0.8 + convergenceConfidence * 0.2).toFixed(4));
  const suggestedPriority = weightedScore >= 0.8 ? 'high' : weightedScore >= 0.65 ? 'medium' : 'low';

  return {
    proposalOnly: true,
    suggestedPriority,
    weightedScore,
    weightingFactors: {
      basePromotionScore: Number(promotionScore.toFixed(4)),
      convergenceConfidence: Number(convergenceConfidence.toFixed(4)),
      convergenceMemberCount,
      clusterMatch: Boolean(matchedCluster)
    },
    rationale: matchedCluster
      ? `Proposal-only weighting: convergence cluster ${matchedCluster.clusterId} contributes advisory priority signal without changing promotion confidence or lifecycle state.`
      : 'Proposal-only weighting: no convergence cluster match found; base promotion score remains the primary advisory input.',
    matchedClusterId: matchedCluster?.clusterId ?? null
  };
};

export const buildPatternReviewQueue = (
  patternsArtifact: PatternCompactionArtifact,
  generatedAt?: string,
  options?: { repoRoot?: string }
): PatternReviewQueueArtifact => {
  const convergenceArtifact = readConvergenceArtifactIfPresent(options?.repoRoot);
  const convergenceClusters = convergenceArtifact?.clusters ?? [];
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
        attractorScoreBreakdown: score.attractorScoreBreakdown,
        convergencePrioritySuggestion: buildConvergencePrioritySuggestion(pattern.id, score.promotionScore, convergenceClusters),
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

export const buildDoctrineCandidatesArtifact = (queue: PatternReviewQueueArtifact): DoctrineCandidatesArtifact => {
  const candidates: DoctrineCandidate[] = queue.candidates
    .filter((candidate) => {
      const strength = candidate.attractorScoreBreakdown.attractor_score;
      const evidenceRefs = candidate.examples.length;
      const instances = candidate.recurrenceCount;
      const outcomeConfidence = candidate.confidence;

      return (
        strength >= DOCTRINE_MIN_STRENGTH &&
        evidenceRefs >= DOCTRINE_MIN_EVIDENCE_REFS &&
        instances >= DOCTRINE_MIN_INSTANCES &&
        outcomeConfidence >= DOCTRINE_MIN_OUTCOME_CONFIDENCE
      );
    })
    .map((candidate) => ({
      candidateId: candidate.id,
      sourcePatternId: candidate.sourcePatternId,
      title: candidate.canonicalPatternName,
      guidance: candidate.reusableEngineeringMeaning,
      metrics: {
        strength: candidate.attractorScoreBreakdown.attractor_score,
        evidence_refs: candidate.examples.length,
        instances: candidate.recurrenceCount,
        outcome_confidence: candidate.confidence
      },
      evidenceRefs: [...candidate.examples],
      reviewState: 'review_required' as const
    }))
    .sort((left, right) => right.metrics.strength - left.metrics.strength || left.candidateId.localeCompare(right.candidateId));

  return {
    schemaVersion: '1.0',
    kind: 'playbook-doctrine-candidates',
    generatedAt: queue.generatedAt,
    promotionCriteria: {
      strength: DOCTRINE_MIN_STRENGTH,
      evidence_refs: DOCTRINE_MIN_EVIDENCE_REFS,
      instances: DOCTRINE_MIN_INSTANCES,
      outcome_confidence: DOCTRINE_MIN_OUTCOME_CONFIDENCE
    },
    reviewOnly: true,
    candidates
  };
};

export const writeDoctrineCandidatesArtifact = (repoRoot: string, artifact: DoctrineCandidatesArtifact): string => {
  const outputPath = path.join(repoRoot, DOCTRINE_CANDIDATES_RELATIVE_PATH);
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
export const DOCTRINE_CANDIDATES_ARTIFACT_RELATIVE_PATH = DOCTRINE_CANDIDATES_RELATIVE_PATH;
