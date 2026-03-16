import { createHash } from 'node:crypto';
import path from 'node:path';
import type { CompactedLearningSummary, PatternPortabilityScore } from '@zachariahredfield/playbook-core';
import type { RouterRecommendationsArtifact } from '../improvement/candidateEngine.js';
import { readRepositoryEvents, type RepositoryEvent } from '../memory/events.js';
import { readJsonIfExists, writeDeterministicJsonAtomic } from './io.js';
import { LEARNING_COMPACTION_RELATIVE_PATH, type LearningCompactionArtifact } from './learningCompaction.js';
import { ROUTER_RECOMMENDATIONS_RELATIVE_PATH } from '../improvement/candidateEngine.js';

export const PATTERN_PORTABILITY_SCHEMA_VERSION = '1.0' as const;
export const PATTERN_PORTABILITY_RELATIVE_PATH = '.playbook/pattern-portability.json' as const;


type OutcomeEvent = Extract<RepositoryEvent, { event_type: 'execution_outcome' | 'lane_outcome' }>;

type PortabilitySource = {
  repoId: string;
  summary: CompactedLearningSummary;
  router: RouterRecommendationsArtifact | undefined;
  events: RepositoryEvent[];
};

export type PatternPortabilityRun = {
  run_id: string;
  generatedAt: string;
  source_repo: string;
  target_repo: string;
  evidence_runs: number;
  scores: PatternPortabilityScore[];
};

export type PatternPortabilityArtifact = {
  schemaVersion: typeof PATTERN_PORTABILITY_SCHEMA_VERSION;
  kind: 'pattern-portability';
  generatedAt: string;
  runs: PatternPortabilityRun[];
};

const round4 = (value: number): number => Number(value.toFixed(4));
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const jaccard = (left: Set<string>, right: Set<string>): number => {
  if (left.size === 0 && right.size === 0) return 0;
  const union = new Set([...left, ...right]);
  let shared = 0;
  for (const value of left) {
    if (right.has(value)) shared += 1;
  }
  return shared / Math.max(1, union.size);
};

const readCompaction = (repoRoot: string): LearningCompactionArtifact | undefined =>
  readJsonIfExists<LearningCompactionArtifact>(path.join(repoRoot, LEARNING_COMPACTION_RELATIVE_PATH));

const readRouterRecommendations = (repoRoot: string): RouterRecommendationsArtifact | undefined =>
  readJsonIfExists<RouterRecommendationsArtifact>(path.join(repoRoot, ROUTER_RECOMMENDATIONS_RELATIVE_PATH));

const toSource = (repoRoot: string, repoId: string): PortabilitySource => {
  const compaction = readCompaction(repoRoot);
  if (!compaction?.summary) {
    throw new Error(`playbook pattern portability: missing learning compaction summary at ${LEARNING_COMPACTION_RELATIVE_PATH}`);
  }

  return {
    repoId,
    summary: compaction.summary,
    router: readRouterRecommendations(repoRoot),
    events: readRepositoryEvents(repoRoot, { order: 'asc' })
  };
};

const buildPatternSignals = (source: PortabilitySource): Array<{ patternId: string; family: string; baseConfidence: number }> => {
  const patterns: Array<{ patternId: string; family: string; baseConfidence: number }> = [];

  for (const recommendation of source.router?.recommendations ?? []) {
    patterns.push({
      patternId: recommendation.recommendation_id,
      family: recommendation.task_family,
      baseConfidence: recommendation.confidence_score
    });
  }

  for (const signal of source.summary.recurring_successes) {
    patterns.push({
      patternId: signal.signal_id,
      family: signal.family,
      baseConfidence: signal.confidence
    });
  }

  for (const signal of source.summary.recurring_failures) {
    patterns.push({
      patternId: signal.signal_id,
      family: signal.family,
      baseConfidence: 1 - signal.confidence
    });
  }

  return patterns.sort((left, right) => left.patternId.localeCompare(right.patternId));
};

const computeStructuralSimilarity = (source: PortabilitySource, target: PortabilitySource, family: string): number => {
  const sourceRoutes = new Set(source.summary.route_patterns.filter((entry) => entry.task_family === family).map((entry) => entry.route_id));
  const targetRoutes = new Set(target.summary.route_patterns.filter((entry) => entry.task_family === family).map((entry) => entry.route_id));
  const allSourceRoutes = new Set(source.summary.route_patterns.map((entry) => entry.route_id));
  const allTargetRoutes = new Set(target.summary.route_patterns.map((entry) => entry.route_id));
  const routeSimilarity = sourceRoutes.size > 0 || targetRoutes.size > 0 ? jaccard(sourceRoutes, targetRoutes) : jaccard(allSourceRoutes, allTargetRoutes);

  const sourceLanes = new Set(source.summary.lane_patterns.map((entry) => entry.lane_shape));
  const targetLanes = new Set(target.summary.lane_patterns.map((entry) => entry.lane_shape));
  const laneSimilarity = jaccard(sourceLanes, targetLanes);

  return round4(clamp01(routeSimilarity * 0.65 + laneSimilarity * 0.35));
};

const computeDependencyCompatibility = (source: PortabilitySource, target: PortabilitySource): number => {
  const sourceValidations = new Set(source.summary.validation_patterns.map((entry) => entry.validation_key));
  const targetValidations = new Set(target.summary.validation_patterns.map((entry) => entry.validation_key));
  const validationOverlap = jaccard(sourceValidations, targetValidations);

  const sourceStrategies = new Set((source.router?.recommendations ?? []).map((entry) => entry.recommended_strategy));
  const targetStrategies = new Set((target.router?.recommendations ?? []).map((entry) => entry.recommended_strategy));
  const strategyOverlap = sourceStrategies.size === 0 && targetStrategies.size === 0 ? 0.5 : jaccard(sourceStrategies, targetStrategies);

  return round4(clamp01(validationOverlap * 0.75 + strategyOverlap * 0.25));
};

const computeGovernanceRisk = (target: PortabilitySource): number => {
  const failurePenalty = clamp01(
    target.summary.recurring_failures
      .filter((entry) => entry.family.includes('validation') || entry.signal_id.includes('contract'))
      .reduce((sum, entry) => sum + entry.confidence, 0)
  );

  const rejectedRatio = (() => {
    const total = (target.router?.recommendations.length ?? 0) + (target.router?.rejected_recommendations.length ?? 0);
    if (total === 0) return 0.5;
    return (target.router?.rejected_recommendations.length ?? 0) / total;
  })();

  const lowConfidencePenalty = clamp01(1 - target.summary.confidence);
  return round4(clamp01(failurePenalty * 0.45 + rejectedRatio * 0.35 + lowConfidencePenalty * 0.2));
};

const collectEvidenceRuns = (source: PortabilitySource, target: PortabilitySource): number => {
  const runIds = new Set<string>();
  for (const runId of source.summary.source_run_ids) runIds.add(runId);
  for (const runId of target.summary.source_run_ids) runIds.add(runId);
  for (const event of [...source.events, ...target.events]) {
    if (event.run_id) runIds.add(event.run_id);
  }
  return runIds.size;
};

const computeHistoricalSuccess = (target: PortabilitySource, family: string): number => {
  const relevantOutcomes = target.events.filter((event): event is OutcomeEvent => {
    if (event.event_type !== 'execution_outcome' && event.event_type !== 'lane_outcome') {
      return false;
    }
    return typeof event.subject === 'string' ? event.subject.includes(family) : false;
  });

  if (relevantOutcomes.length === 0) {
    return 0.35;
  }

  const successCount = relevantOutcomes.filter((event) => event.outcome === 'success').length;
  return clamp01(successCount / relevantOutcomes.length);
};

const buildRunId = (input: { sourceRepo: string; targetRepo: string; generatedAt: string; scores: PatternPortabilityScore[] }): string => {
  const digest = createHash('sha256')
    .update(JSON.stringify(input), 'utf8')
    .digest('hex')
    .slice(0, 16);
  return `portability-${digest}`;
};

export const scorePatternPortability = (input: { source: PortabilitySource; target: PortabilitySource }): PatternPortabilityScore[] => {
  const patternSignals = buildPatternSignals(input.source);
  const dependencyCompatibility = computeDependencyCompatibility(input.source, input.target);
  const governanceRisk = computeGovernanceRisk(input.target);
  const evidenceRuns = collectEvidenceRuns(input.source, input.target);
  const evidenceFactor = clamp01(evidenceRuns / 6);

  return patternSignals.map((pattern) => {
    const structuralSimilarity = computeStructuralSimilarity(input.source, input.target, pattern.family);
    const historicalSuccess = computeHistoricalSuccess(input.target, pattern.family);
    const confidence = clamp01(
      pattern.baseConfidence * 0.35 +
        structuralSimilarity * 0.2 +
        dependencyCompatibility * 0.15 +
        historicalSuccess * 0.15 +
        evidenceFactor * 0.1 +
        (1 - governanceRisk) * 0.05
    );

    const conservativeConfidence = evidenceRuns === 0 ? 0.2 : confidence;

    return {
      pattern_id: pattern.patternId,
      source_repo: input.source.repoId,
      target_repo: input.target.repoId,
      evidence_runs: evidenceRuns,
      structural_similarity: structuralSimilarity,
      dependency_compatibility: dependencyCompatibility,
      governance_risk: governanceRisk,
      confidence_score: round4(conservativeConfidence)
    };
  });
};

export const generatePatternPortabilityRun = (input: {
  sourceRepoRoot: string;
  sourceRepoId: string;
  targetRepoRoot: string;
  targetRepoId: string;
}): PatternPortabilityRun => {
  const source = toSource(input.sourceRepoRoot, input.sourceRepoId);
  const target = toSource(input.targetRepoRoot, input.targetRepoId);
  const generatedAt = [source.summary.time_window.end, target.summary.time_window.end].sort((left, right) => right.localeCompare(left))[0] ?? new Date(0).toISOString();
  const scores = scorePatternPortability({ source, target }).sort(
    (left, right) => right.confidence_score - left.confidence_score || left.pattern_id.localeCompare(right.pattern_id)
  );
  const evidenceRuns = scores[0]?.evidence_runs ?? collectEvidenceRuns(source, target);

  return {
    run_id: buildRunId({ sourceRepo: input.sourceRepoId, targetRepo: input.targetRepoId, generatedAt, scores }),
    generatedAt,
    source_repo: input.sourceRepoId,
    target_repo: input.targetRepoId,
    evidence_runs: evidenceRuns,
    scores
  };
};

export const writePatternPortabilityArtifact = (repoRoot: string, run: PatternPortabilityRun): string => {
  const artifactPath = path.join(repoRoot, PATTERN_PORTABILITY_RELATIVE_PATH);
  const existing = readJsonIfExists<PatternPortabilityArtifact>(artifactPath);
  const priorRuns = existing?.schemaVersion === PATTERN_PORTABILITY_SCHEMA_VERSION && Array.isArray(existing.runs) ? existing.runs : [];
  const hasRun = priorRuns.some((entry) => entry.run_id === run.run_id);
  const runs = hasRun ? priorRuns : [...priorRuns, run];

  const artifact: PatternPortabilityArtifact = {
    schemaVersion: PATTERN_PORTABILITY_SCHEMA_VERSION,
    kind: 'pattern-portability',
    generatedAt: run.generatedAt,
    runs
  };

  writeDeterministicJsonAtomic(artifactPath, artifact);
  return artifactPath;
};
