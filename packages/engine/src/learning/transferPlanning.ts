import { createHash } from 'node:crypto';
import path from 'node:path';
import type { TransferPlanArtifact, TransferPlanRecord } from '@zachariahredfield/playbook-core';
import { ROUTER_RECOMMENDATIONS_RELATIVE_PATH, type RouterRecommendationsArtifact } from '../improvement/candidateEngine.js';
import { readJsonIfExists, writeDeterministicJsonAtomic } from './io.js';
import { LEARNING_COMPACTION_RELATIVE_PATH, type LearningCompactionArtifact } from './learningCompaction.js';
import { PATTERN_PORTABILITY_RELATIVE_PATH, type PatternPortabilityArtifact } from './patternPortability.js';
import { PORTABILITY_CONFIDENCE_RELATIVE_PATH, type PortabilityConfidenceArtifact } from './portabilityConfidence.js';

export const TRANSFER_PLANS_SCHEMA_VERSION = '1.0' as const;
export const TRANSFER_PLANS_RELATIVE_PATH = '.playbook/transfer-plans.json' as const;
const CROSS_REPO_PATTERNS_RELATIVE_PATH = '.playbook/cross-repo-patterns.json' as const;

const HIGH_CONFIDENCE_THRESHOLD = 0.7;

type CrossRepoPatternsArtifact = {
  generatedAt?: string;
  aggregates?: Array<{ pattern_id?: string; portability_score?: number }>;
};

const round4 = (value: number): number => Number(value.toFixed(4));
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const derivePatternFamily = (value: string): string => {
  const normalized = value.trim().toLowerCase();
  for (const subsystem of ['knowledge_lifecycle', 'improvement_engine', 'routing_engine']) {
    if (normalized.includes(subsystem)) return subsystem;
  }

  if (normalized.includes('.')) {
    const [head] = normalized.split('.');
    return head || 'unknown-family';
  }

  const tokens = normalized.split('_').filter(Boolean);
  if (tokens.length >= 2) {
    return `${tokens[tokens.length - 2]}_${tokens[tokens.length - 1]}`;
  }

  return normalized || 'unknown-family';
};

const inferSubsystems = (patternId: string, taskFamily?: string): string[] => {
  const value = `${patternId} ${taskFamily ?? ''}`.toLowerCase();
  const subsystems = new Set<string>();
  if (value.includes('knowledge')) subsystems.add('knowledge_lifecycle');
  if (value.includes('improvement') || value.includes('doctrine')) subsystems.add('improvement_engine');
  if (value.includes('routing') || value.includes('router') || value.includes('lane')) subsystems.add('routing_engine');
  if (subsystems.size === 0) subsystems.add('routing_engine');
  return [...subsystems].sort((left, right) => left.localeCompare(right));
};

const buildTransferPlanId = (input: { patternId: string; sourceRepo: string; targetRepo: string }): string => {
  const digest = createHash('sha256').update(JSON.stringify(input), 'utf8').digest('hex').slice(0, 16);
  return `transfer-${digest}`;
};

const maxGeneratedAt = (...values: Array<string | undefined>): string =>
  [...values].filter((value): value is string => typeof value === 'string').sort((left, right) => right.localeCompare(left))[0] ?? '1970-01-01T00:00:00.000Z';

export const generateTransferPlansArtifact = (repoRoot: string): TransferPlanArtifact => {
  const portability = readJsonIfExists<PatternPortabilityArtifact>(path.join(repoRoot, PATTERN_PORTABILITY_RELATIVE_PATH));
  const crossRepo = readJsonIfExists<CrossRepoPatternsArtifact>(path.join(repoRoot, CROSS_REPO_PATTERNS_RELATIVE_PATH));
  const confidence = readJsonIfExists<PortabilityConfidenceArtifact>(path.join(repoRoot, PORTABILITY_CONFIDENCE_RELATIVE_PATH));
  const router = readJsonIfExists<RouterRecommendationsArtifact>(path.join(repoRoot, ROUTER_RECOMMENDATIONS_RELATIVE_PATH));
  const compaction = readJsonIfExists<LearningCompactionArtifact>(path.join(repoRoot, LEARNING_COMPACTION_RELATIVE_PATH));

  const crossRepoByPattern = new Map<string, number>();
  for (const aggregate of crossRepo?.aggregates ?? []) {
    if (typeof aggregate.pattern_id !== 'string' || typeof aggregate.portability_score !== 'number') continue;
    crossRepoByPattern.set(aggregate.pattern_id, clamp01(aggregate.portability_score));
  }

  const confidenceByGroup = new Map<string, PortabilityConfidenceArtifact['summaries'][number]>();
  for (const summary of confidence?.summaries ?? []) {
    const key = `${summary.source_pattern_family}::${summary.source_repo}::${summary.target_repo}`;
    confidenceByGroup.set(key, summary);
  }

  const recommendationsById = new Map<string, RouterRecommendationsArtifact['recommendations'][number]>();
  for (const recommendation of router?.recommendations ?? []) {
    recommendationsById.set(recommendation.recommendation_id, recommendation);
  }

  const plans = new Map<string, TransferPlanRecord>();

  for (const run of portability?.runs ?? []) {
    for (const score of run.scores ?? []) {
      const family = derivePatternFamily(score.pattern_id);
      const confidenceKey = `${family}::${score.source_repo}::${score.target_repo}`;
      const confidenceSummary = confidenceByGroup.get(confidenceKey);
      const crossRepoScore = crossRepoByPattern.get(score.pattern_id);
      const blendedConfidence = clamp01(
        score.confidence_score * 0.55 +
          (confidenceSummary?.recalibrated_confidence ?? score.confidence_score) * 0.3 +
          (crossRepoScore ?? score.confidence_score) * 0.15
      );

      if (blendedConfidence < HIGH_CONFIDENCE_THRESHOLD) continue;

      const recommendation = recommendationsById.get(score.pattern_id);
      const touchedSubsystems = inferSubsystems(score.pattern_id, recommendation?.task_family);
      const readiness = clamp01(
        (1 - score.governance_risk) * 0.45 +
          (compaction?.summary?.confidence ?? 0.5) * 0.25 +
          (recommendation ? recommendation.confidence_score : 0.5) * 0.2 +
          (score.dependency_compatibility ?? 0.5) * 0.1
      );

      const requiredArtifacts = [
        PATTERN_PORTABILITY_RELATIVE_PATH,
        PORTABILITY_CONFIDENCE_RELATIVE_PATH,
        CROSS_REPO_PATTERNS_RELATIVE_PATH,
        ROUTER_RECOMMENDATIONS_RELATIVE_PATH,
        LEARNING_COMPACTION_RELATIVE_PATH
      ].sort((left, right) => left.localeCompare(right));

      const requiredValidations = [
        ...new Set([
          ...(compaction?.summary.validation_patterns.map((entry) => entry.validation_key) ?? []),
          recommendation?.recommended_strategy ? `router-strategy:${recommendation.recommended_strategy}` : undefined,
          'verify-portability-assumptions',
          'proposal-review-checkpoint'
        ].filter((value): value is string => typeof value === 'string'))
      ].sort((left, right) => left.localeCompare(right));

      const riskSignals = [
        `governance_risk:${round4(score.governance_risk)}`,
        `dependency_compatibility:${round4(score.dependency_compatibility)}`,
        confidenceSummary ? `recalibration_adjustment:${round4(confidenceSummary.recommended_adjustment)}` : 'recalibration_adjustment:missing',
        recommendation ? `router_gate:${recommendation.gating_tier}` : 'router_gate:unknown'
      ].sort((left, right) => left.localeCompare(right));

      const openQuestions = [
        ...(confidenceSummary?.open_questions ?? []),
        ...(compaction?.summary.open_questions ?? []),
        ...(recommendation ? [] : ['No matching router recommendation found for this pattern in target repo context.'])
      ]
        .filter((value) => value.trim().length > 0)
        .filter((value, index, values) => values.indexOf(value) === index)
        .sort((left, right) => left.localeCompare(right));

      if (score.evidence_runs < 3) {
        openQuestions.push('Sparse transfer evidence for this pattern; gather additional outcomes before adoption escalation.');
      }

      const blockers = [
        ...(readiness < 0.55 ? ['Target readiness is below preferred threshold for confident adoption.'] : []),
        ...(score.governance_risk > 0.45 ? ['Governance risk remains elevated; route through governance review before adoption.'] : [])
      ].sort((left, right) => left.localeCompare(right));

      const gatingTier: TransferPlanRecord['gating_tier'] =
        blockers.length > 0 || score.governance_risk > 0.35 ? 'GOVERNANCE' : 'CONVERSATIONAL';

      const adoptionSteps = [
        'Review transfer plan with target-repo maintainers and confirm proposal-only execution intent.',
        `Validate portability assumptions for pattern ${score.pattern_id} using current target-repo evidence artifacts.`,
        'Draft target-repo implementation proposal with subsystem owners and required validation checkpoints.',
        'Run deterministic verify/plan workflow in target repo and compare with this transfer plan before any mutation.',
        'Record decision outcome and follow-up telemetry in portability outcomes artifacts.'
      ];

      const plan: TransferPlanRecord = {
        transfer_plan_id: buildTransferPlanId({ patternId: score.pattern_id, sourceRepo: score.source_repo, targetRepo: score.target_repo }),
        pattern_id: score.pattern_id,
        source_repo: score.source_repo,
        target_repo: score.target_repo,
        portability_confidence: round4(blendedConfidence),
        target_readiness: round4(readiness),
        touched_subsystems: touchedSubsystems,
        required_artifacts: requiredArtifacts,
        required_validations: requiredValidations,
        adoption_steps: adoptionSteps,
        risk_signals: riskSignals,
        blockers,
        open_questions: openQuestions.sort((left, right) => left.localeCompare(right)),
        gating_tier: gatingTier
      };

      plans.set(`${plan.pattern_id}::${plan.source_repo}::${plan.target_repo}`, plan);
    }
  }

  const orderedPlans = [...plans.values()].sort(
    (left, right) =>
      right.portability_confidence - left.portability_confidence ||
      left.pattern_id.localeCompare(right.pattern_id) ||
      left.source_repo.localeCompare(right.source_repo) ||
      left.target_repo.localeCompare(right.target_repo)
  );

  return {
    schemaVersion: TRANSFER_PLANS_SCHEMA_VERSION,
    kind: 'transfer-plans',
    generatedAt: maxGeneratedAt(
      portability?.generatedAt,
      crossRepo?.generatedAt,
      confidence?.generatedAt,
      router?.generatedAt,
      compaction?.generatedAt
    ),
    proposalOnly: true,
    nonAutonomous: true,
    sourceArtifacts: {
      patternPortabilityPath: PATTERN_PORTABILITY_RELATIVE_PATH,
      crossRepoPatternsPath: CROSS_REPO_PATTERNS_RELATIVE_PATH,
      portabilityConfidencePath: PORTABILITY_CONFIDENCE_RELATIVE_PATH,
      routerRecommendationsPath: ROUTER_RECOMMENDATIONS_RELATIVE_PATH,
      learningCompactionPath: LEARNING_COMPACTION_RELATIVE_PATH
    },
    plans: orderedPlans
  };
};

export const writeTransferPlansArtifact = (repoRoot: string, artifact: TransferPlanArtifact): string => {
  const targetPath = path.join(repoRoot, TRANSFER_PLANS_RELATIVE_PATH);
  writeDeterministicJsonAtomic(targetPath, artifact);
  return targetPath;
};
