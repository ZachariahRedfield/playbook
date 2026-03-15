import {
  normalizeOutcomeTelemetryArtifact,
  normalizeProcessTelemetryArtifact,
  type OutcomeTelemetryArtifact,
  type ProcessTelemetryArtifact
} from './outcomeTelemetry.js';
import type { TaskExecutionProfileArtifact, TaskExecutionProfileProposal } from '../routing/executionRouter.js';

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
    parallel_safety_realized: number;
    router_fit_score: number;
    reasoning_scope_efficiency: number;
    validation_cost_pressure: number;
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
  const byFamily = new Map<string, { count: number; totalRetry: number; firstPass: number; validationPressure: number; intervention: number }>();

  for (const record of records) {
    const aggregate = byFamily.get(record.task_family) ?? {
      count: 0,
      totalRetry: 0,
      firstPass: 0,
      validationPressure: 0,
      intervention: 0
    };
    aggregate.count += 1;
    aggregate.totalRetry += record.retry_count;
    aggregate.firstPass += record.first_pass_success ? 1 : 0;
    aggregate.validationPressure += record.over_validation_signal ? 1 : 0;
    aggregate.intervention += record.human_intervention_required ? 1 : 0;
    byFamily.set(record.task_family, aggregate);
  }

  const scores: Record<string, number> = {};
  for (const [family, aggregate] of byFamily.entries()) {
    const firstPass = aggregate.count === 0 ? 0 : aggregate.firstPass / aggregate.count;
    const retryPenalty = aggregate.count === 0 ? 0 : aggregate.totalRetry / aggregate.count;
    const validationPenalty = aggregate.count === 0 ? 0 : aggregate.validationPressure / aggregate.count;
    const interventionPenalty = aggregate.count === 0 ? 0 : aggregate.intervention / aggregate.count;
    scores[family] = round4(clamp01(firstPass - retryPenalty * 0.2 - validationPenalty * 0.15 - interventionPenalty * 0.1));
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
      : round4(clamp01(docsOnlyScore * 0.6 + (1 - (routeEfficiency.engine_scoring ?? 0)) * 0.2 + (1 - contractsSchemaScore) * 0.2));

  const recordsWithLaneEvidence = processRecords.filter((record) => typeof record.parallel_lane_count === 'number' && record.parallel_lane_count > 0);
  const safeParallelRecords = recordsWithLaneEvidence.filter(
    (record) => (record.parallel_lane_count ?? 0) > 1 && record.actual_merge_conflict === false
  );
  const parallelSafetyRealized =
    recordsWithLaneEvidence.length === 0 ? 0 : round4(clamp01(safeParallelRecords.length / recordsWithLaneEvidence.length));

  const recordsWithValidationDuration = processRecords.filter((record) => typeof record.validation_duration_ms === 'number');
  const totalValidationDuration = recordsWithValidationDuration.reduce((sum, record) => sum + (record.validation_duration_ms ?? 0), 0);
  const totalTaskDuration = processRecords.reduce((sum, record) => sum + record.task_duration_ms, 0);
  const validationDurationRatio =
    totalTaskDuration === 0 || recordsWithValidationDuration.length === 0 ? 0 : clamp01(totalValidationDuration / totalTaskDuration);
  const overValidationCount = processRecords.filter((record) => record.over_validation_signal).length;
  const underValidationCount = processRecords.filter((record) => record.under_validation_signal).length;
  const validationCostPressure =
    totalProcessRecords === 0
      ? 0
      : round4(
          clamp01(
            validationDurationRatio * 0.55 +
              (overValidationCount / totalProcessRecords) * 0.35 +
              (underValidationCount / totalProcessRecords) * 0.1
          )
        );

  const repoScopeRecords = processRecords.filter((record) => record.reasoning_scope === 'repository' || record.reasoning_scope === 'cross-repo').length;
  const crossRepoCount = processRecords.filter((record) => record.reasoning_scope === 'cross-repo').length;
  const reasoningScopeEfficiency =
    totalProcessRecords === 0
      ? 0
      : round4(
          clamp01(
            firstPassCount / totalProcessRecords -
              (crossRepoCount / totalProcessRecords) * 0.2 -
              (repoScopeRecords / totalProcessRecords) * 0.1 +
              (process ? 0.1 : 0)
          )
        );

  const profileByFamily = new Map<string, TaskExecutionProfileProposal>((profiles?.profiles ?? []).map((profile) => [profile.task_family, profile]));
  const recordsWithRouteSignals = processRecords.filter((record) =>
    Boolean(
      record.task_profile_id ||
        record.route_id ||
        record.rule_packs_selected ||
        record.required_validations_selected ||
        record.optional_validations_selected ||
        typeof record.validation_duration_ms === 'number' ||
        typeof record.planning_duration_ms === 'number' ||
        typeof record.apply_duration_ms === 'number'
    )
  );
  const routeFitEvidenceScore =
    recordsWithRouteSignals.length === 0
      ? 0
      : recordsWithRouteSignals.reduce((sum, record) => {
          const profile = profileByFamily.get(record.task_family);
          let recordScore = 0.35;
          if (record.route_id) {
            recordScore += 0.1;
          }
          if (record.rule_packs_selected && record.rule_packs_selected.length > 0) {
            recordScore += 0.1;
          }
          if (record.required_validations_selected && record.required_validations_selected.length > 0) {
            recordScore += 0.1;
          }
          if (record.first_pass_success) {
            recordScore += 0.15;
          }
          if ((record.retry_count ?? 0) === 0) {
            recordScore += 0.1;
          }

          if (profile) {
            const requiredSelected = new Set(record.required_validations_selected ?? []);
            const requiredCoverage =
              profile.required_validations.length === 0
                ? 1
                : profile.required_validations.filter((validation) => requiredSelected.has(validation)).length /
                  profile.required_validations.length;
            const rulePackSelected = new Set(record.rule_packs_selected ?? []);
            const rulePackCoverage =
              profile.rule_packs.length === 0
                ? 1
                : profile.rule_packs.filter((rulePack) => rulePackSelected.has(rulePack)).length / profile.rule_packs.length;
            recordScore += requiredCoverage * 0.1 + rulePackCoverage * 0.1;
          }

          return sum + clamp01(recordScore);
        }, 0) / recordsWithRouteSignals.length;

  const routerFitScore =
    totalProcessRecords === 0
      ? 0
      : round4(
          clamp01(
            routeFitEvidenceScore * 0.55 +
              smallestSufficientRouteScore * 0.2 +
              parallelSafetyRealized * 0.1 +
              (1 - validationCostPressure) * 0.15
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

  const profileCoverage = profiles?.profiles.length ?? 0;
  const portabilityConfidence =
    totalProcessRecords === 0
      ? 0
      : round4(clamp01(crossRepoCount / totalProcessRecords * 0.5 + (profileCoverage > 0 ? 0.2 : 0) + (outcome ? 0.15 : 0) + reasoningScopeEfficiency * 0.15));

  const availableSourceCount = [Boolean(outcome), Boolean(process), Boolean(profiles)].filter(Boolean).length;
  const sampleSizeScore = round4(clamp01(totalProcessRecords / 10));
  const coverageScore = round4(clamp01(Object.keys(routeEfficiency).length / 5));

  const enrichedSignalCount = [
    recordsWithRouteSignals.length > 0,
    recordsWithValidationDuration.length > 0,
    recordsWithLaneEvidence.length > 0,
    processRecords.some((record) => record.over_validation_signal || record.under_validation_signal),
    Boolean(outcome?.summary.task_family_counts && Object.keys(outcome.summary.task_family_counts).length > 0)
  ].filter(Boolean).length;

  const evidenceCompletenessScore = round4(clamp01(availableSourceCount / 3 * 0.7 + (enrichedSignalCount / 5) * 0.3));
  const overallConfidence = round4(
    clamp01(sampleSizeScore * 0.3 + coverageScore * 0.2 + evidenceCompletenessScore * 0.3 + routerFitScore * 0.2)
  );

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
  if (recordsWithRouteSignals.length < Math.max(1, Math.floor(totalProcessRecords * 0.5))) {
    openQuestions.add('Limited enriched route signals: collect route/profile/validation-selection telemetry before adjusting router policy.');
  }
  if (recordsWithValidationDuration.length === 0) {
    openQuestions.add('Validation duration evidence missing: validation_cost_pressure currently relies on coarse validator counts.');
  }
  if (recordsWithLaneEvidence.length === 0) {
    openQuestions.add('Parallel lane evidence missing: parallel_safety_realized remains low-confidence.');
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
      parallel_safety_realized: parallelSafetyRealized,
      router_fit_score: routerFitScore,
      reasoning_scope_efficiency: reasoningScopeEfficiency,
      validation_cost_pressure: validationCostPressure,
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
