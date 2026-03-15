import {
  normalizeOutcomeTelemetryArtifact,
  normalizeProcessTelemetryArtifact,
  type OutcomeTelemetryArtifact,
  type ProcessTelemetryArtifact
} from './outcomeTelemetry.js';
import type { TaskExecutionProfileArtifact } from '../routing/executionRouter.js';

export const LEARNING_STATE_SCHEMA_VERSION = '1.0';

type ArtifactAvailability = {
  available: boolean;
  recordCount: number;
  artifactPath: string;
};

export type LearningStateSnapshotArtifact = {
  schemaVersion: typeof LEARNING_STATE_SCHEMA_VERSION;
  kind: 'learning-state-snapshot';
  generatedAt: string;
  proposalOnly: true;
  sourceArtifacts: {
    outcomeTelemetry: ArtifactAvailability;
    processTelemetry: ArtifactAvailability;
    taskExecutionProfile: ArtifactAvailability;
  };
  metrics: {
    sample_size: number;
    first_pass_yield: number;
    retry_pressure: Record<string, number>;
    validation_load_ratio: number;
    route_efficiency_score: Record<string, number>;
    smallest_sufficient_route_score: number;
    pattern_family_effectiveness_score: Record<string, number>;
    portability_confidence: number;
  };
  confidenceSummary: {
    sample_size_score: number;
    coverage_score: number;
    evidence_completeness_score: number;
    overall_confidence: number;
    open_questions: string[];
  };
};

export type DeriveLearningStateInput = {
  outcomeTelemetry?: OutcomeTelemetryArtifact;
  processTelemetry?: ProcessTelemetryArtifact;
  taskExecutionProfile?: TaskExecutionProfileArtifact;
  generatedAt?: string;
};

const round4 = (value: number): number => Number(value.toFixed(4));

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const sortEntriesByKey = (values: Record<string, number>): Record<string, number> =>
  Object.fromEntries(Object.entries(values).sort((left, right) => left[0].localeCompare(right[0])));

const computeRouteEfficiency = (records: ProcessTelemetryArtifact['records']): Record<string, number> => {
  const byFamily = new Map<string, { count: number; totalRetry: number; firstPass: number }>();

  for (const record of records) {
    const aggregate = byFamily.get(record.task_family) ?? { count: 0, totalRetry: 0, firstPass: 0 };
    aggregate.count += 1;
    aggregate.totalRetry += record.retry_count;
    aggregate.firstPass += record.first_pass_success ? 1 : 0;
    byFamily.set(record.task_family, aggregate);
  }

  const scores: Record<string, number> = {};
  for (const [family, aggregate] of byFamily.entries()) {
    const firstPass = aggregate.count === 0 ? 0 : aggregate.firstPass / aggregate.count;
    const retryPenalty = aggregate.count === 0 ? 0 : aggregate.totalRetry / aggregate.count;
    scores[family] = round4(clamp01(firstPass - retryPenalty * 0.2));
  }

  return sortEntriesByKey(scores);
};

export const deriveLearningStateSnapshot = (input: DeriveLearningStateInput): LearningStateSnapshotArtifact => {
  const outcome = input.outcomeTelemetry ? normalizeOutcomeTelemetryArtifact(input.outcomeTelemetry) : undefined;
  const process = input.processTelemetry ? normalizeProcessTelemetryArtifact(input.processTelemetry) : undefined;
  const profiles = input.taskExecutionProfile;

  const processRecords = process?.records ?? [];
  const totalProcessRecords = processRecords.length;

  const firstPassCount = processRecords.filter((record) => record.first_pass_success).length;
  const totalValidatorsRun = processRecords.reduce((sum, record) => sum + record.validators_run.length, 0);
  const totalRetryCount = processRecords.reduce((sum, record) => sum + record.retry_count, 0);

  const retryPressureByTaskFamily = sortEntriesByKey(
    processRecords.reduce<Record<string, number>>((accumulator, record) => {
      accumulator[record.task_family] = round4((accumulator[record.task_family] ?? 0) + record.retry_count);
      return accumulator;
    }, {})
  );

  const routeEfficiency = computeRouteEfficiency(processRecords);

  const docsOnlyScore = routeEfficiency.docs_only ?? 0;
  const contractsSchemaScore = routeEfficiency.contracts_schema ?? 0;
  const smallestSufficientRouteScore =
    totalProcessRecords === 0
      ? 0
      : round4(
          clamp01(
            docsOnlyScore * 0.55 +
              (1 - Math.min(1, (routeEfficiency.engine_scoring ?? 0) * 0.5)) * 0.15 +
              (1 - Math.min(1, contractsSchemaScore * 0.5)) * 0.3
          )
        );

  const outcomeBreakagePenalty = outcome ? Math.min(1, outcome.summary.sum_contract_breakage / Math.max(1, outcome.summary.total_records)) : 0;

  const patternEffectiveness = sortEntriesByKey(
    Object.fromEntries(
      Object.entries(routeEfficiency).map(([taskFamily, score]) => {
        const adjustment = taskFamily === 'pattern_learning' ? 0.15 : 0;
        return [taskFamily, round4(clamp01(score + adjustment - outcomeBreakagePenalty * 0.2))];
      })
    )
  );

  const crossRepoCount = processRecords.filter((record) => record.reasoning_scope === 'cross-repo').length;
  const profileCoverage = profiles?.profiles.length ?? 0;
  const portabilityConfidence =
    totalProcessRecords === 0
      ? 0
      : round4(
          clamp01(crossRepoCount / totalProcessRecords * 0.6 + (profileCoverage > 0 ? 0.25 : 0) + (outcome ? 0.15 : 0))
        );

  const availableSourceCount = [Boolean(outcome), Boolean(process), Boolean(profiles)].filter(Boolean).length;
  const sampleSizeScore = round4(clamp01(totalProcessRecords / 10));
  const coverageScore = round4(clamp01(Object.keys(routeEfficiency).length / 5));
  const evidenceCompletenessScore = round4(clamp01(availableSourceCount / 3));
  const overallConfidence = round4(clamp01(sampleSizeScore * 0.4 + coverageScore * 0.3 + evidenceCompletenessScore * 0.3));

  const openQuestions = new Set<string>();
  if (!outcome) {
    openQuestions.add('Outcome telemetry missing: cannot cross-check efficiency against verified outcomes.');
  }
  if (!process) {
    openQuestions.add('Process telemetry missing: route-level efficiency and retry pressure are under-specified.');
  }
  if (!profiles) {
    openQuestions.add('Task execution profile missing: route suitability confidence remains conservative.');
  }
  if (totalProcessRecords < 3) {
    openQuestions.add('Low sample size: expand telemetry window before promoting routing proposals.');
  }
  if (Object.keys(routeEfficiency).length < 2) {
    openQuestions.add('Limited route coverage: compare at least two task families before policy proposals.');
  }

  const generatedAtCandidates = [input.generatedAt, outcome?.generatedAt, process?.generatedAt, profiles?.generatedAt].filter(
    (value): value is string => Boolean(value)
  );

  return {
    schemaVersion: LEARNING_STATE_SCHEMA_VERSION,
    kind: 'learning-state-snapshot',
    generatedAt: generatedAtCandidates.sort((left, right) => right.localeCompare(left))[0] ?? new Date(0).toISOString(),
    proposalOnly: true,
    sourceArtifacts: {
      outcomeTelemetry: {
        available: Boolean(outcome),
        recordCount: outcome?.records.length ?? 0,
        artifactPath: '.playbook/outcome-telemetry.json'
      },
      processTelemetry: {
        available: Boolean(process),
        recordCount: process?.records.length ?? 0,
        artifactPath: '.playbook/process-telemetry.json'
      },
      taskExecutionProfile: {
        available: Boolean(profiles),
        recordCount: profiles?.profiles.length ?? 0,
        artifactPath: '.playbook/task-execution-profile.json'
      }
    },
    metrics: {
      sample_size: totalProcessRecords,
      first_pass_yield: totalProcessRecords === 0 ? 0 : round4(firstPassCount / totalProcessRecords),
      retry_pressure: retryPressureByTaskFamily,
      validation_load_ratio: totalProcessRecords === 0 ? 0 : round4(totalValidatorsRun / totalProcessRecords),
      route_efficiency_score: routeEfficiency,
      smallest_sufficient_route_score: smallestSufficientRouteScore,
      pattern_family_effectiveness_score: patternEffectiveness,
      portability_confidence: portabilityConfidence
    },
    confidenceSummary: {
      sample_size_score: sampleSizeScore,
      coverage_score: coverageScore,
      evidence_completeness_score: evidenceCompletenessScore,
      overall_confidence: overallConfidence,
      open_questions: [...openQuestions].sort((left, right) => left.localeCompare(right))
    }
  };
};
