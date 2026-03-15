export const OUTCOME_TELEMETRY_SCHEMA_VERSION = '1.0';
export const PROCESS_TELEMETRY_SCHEMA_VERSION = '1.0';

export type OutcomeTelemetryRecord = {
  id: string;
  recordedAt: string;
  plan_churn: number;
  apply_retries: number;
  dependency_drift: number;
  contract_breakage: number;
  docs_mismatch: boolean;
  ci_failure_categories: string[];
  task_profile_id?: string;
  task_family?: string;
  affected_surfaces?: string[];
  estimated_change_surface?: number;
  actual_change_surface?: number;
  files_changed_count?: number;
  post_apply_verify_passed?: boolean;
  post_apply_ci_passed?: boolean;
  regression_categories?: string[];
  pattern_families_implicated?: string[];
};

export type OutcomeTelemetrySummary = {
  total_records: number;
  sum_plan_churn: number;
  sum_apply_retries: number;
  sum_dependency_drift: number;
  sum_contract_breakage: number;
  docs_mismatch_count: number;
  ci_failure_category_counts: Record<string, number>;
  task_family_counts?: Record<string, number>;
  affected_surface_counts?: Record<string, number>;
  regression_category_counts?: Record<string, number>;
  pattern_family_implicated_counts?: Record<string, number>;
  post_apply_verify_passed_count?: number;
  post_apply_ci_passed_count?: number;
  sum_estimated_change_surface?: number;
  sum_actual_change_surface?: number;
  sum_files_changed_count?: number;
};

export type OutcomeTelemetryArtifact = {
  schemaVersion: typeof OUTCOME_TELEMETRY_SCHEMA_VERSION;
  kind: 'outcome-telemetry';
  generatedAt: string;
  records: OutcomeTelemetryRecord[];
  summary: OutcomeTelemetrySummary;
};

export type ProcessReasoningScope = 'narrow' | 'module' | 'repository' | 'cross-repo';

export type ProcessTelemetryRecord = {
  id: string;
  recordedAt: string;
  task_family: string;
  task_profile_id?: string;
  route_id?: string;
  task_duration_ms: number;
  files_touched: string[];
  validators_run: string[];
  rule_packs_selected?: string[];
  required_validations_selected?: string[];
  optional_validations_selected?: string[];
  validation_duration_ms?: number;
  planning_duration_ms?: number;
  apply_duration_ms?: number;
  retry_count: number;
  merge_conflict_risk: number;
  actual_merge_conflict?: boolean;
  first_pass_success: boolean;
  human_intervention_required?: boolean;
  parallel_lane_count?: number;
  over_validation_signal?: boolean;
  under_validation_signal?: boolean;
  prompt_size: number;
  reasoning_scope: ProcessReasoningScope;
};

export type ProcessTelemetrySummary = {
  total_records: number;
  total_task_duration_ms: number;
  average_task_duration_ms: number;
  total_retry_count: number;
  first_pass_success_count: number;
  average_merge_conflict_risk: number;
  total_files_touched_unique: number;
  total_validators_run_unique: number;
  task_family_counts: Record<string, number>;
  validators_run_counts: Record<string, number>;
  reasoning_scope_counts: Record<ProcessReasoningScope, number>;
  route_id_counts: Record<string, number>;
  task_profile_id_counts: Record<string, number>;
  rule_packs_selected_counts: Record<string, number>;
  required_validations_selected_counts: Record<string, number>;
  optional_validations_selected_counts: Record<string, number>;
  total_validation_duration_ms: number;
  total_planning_duration_ms: number;
  total_apply_duration_ms: number;
  human_intervention_required_count: number;
  actual_merge_conflict_count: number;
  average_parallel_lane_count: number;
  over_validation_signal_count: number;
  under_validation_signal_count: number;
};

export type ProcessTelemetryArtifact = {
  schemaVersion: typeof PROCESS_TELEMETRY_SCHEMA_VERSION;
  kind: 'process-telemetry';
  generatedAt: string;
  records: ProcessTelemetryRecord[];
  summary: ProcessTelemetrySummary;
};

const sortStrings = (values: string[]): string[] => [...new Set(values)].sort((left, right) => left.localeCompare(right));

const sortCountMap = (values: Record<string, number>): Record<string, number> =>
  Object.fromEntries(Object.entries(values).sort((left, right) => left[0].localeCompare(right[0])));

const compareRecords = <T extends { recordedAt: string; id: string }>(left: T, right: T): number =>
  left.recordedAt.localeCompare(right.recordedAt) || left.id.localeCompare(right.id);

const round4 = (value: number): number => Number(value.toFixed(4));

const normalizeDuration = (value: number | undefined): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value) : undefined;

const normalizePositiveInteger = (value: number | undefined, minimum: number): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value >= minimum ? Math.round(value) : undefined;

const normalizeOutcomeRecord = (record: OutcomeTelemetryRecord): OutcomeTelemetryRecord => ({
  ...record,
  ci_failure_categories: sortStrings(record.ci_failure_categories)
});
const asNonNegativeNumber = (value: unknown): number => {
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
    return 0;
  }

  return value;
};

const asInteger = (value: unknown): number => Math.trunc(asNonNegativeNumber(value));

const asBoolean = (value: unknown): boolean => value === true;

const asNonEmptyString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

const normalizeOutcomeRecord = (record: Partial<OutcomeTelemetryRecord>): OutcomeTelemetryRecord => {
  const taskProfileId = asNonEmptyString(record.task_profile_id);
  const taskFamily = asNonEmptyString(record.task_family);
  const postApplyVerifyPassed = record.post_apply_verify_passed === undefined ? undefined : asBoolean(record.post_apply_verify_passed);
  const postApplyCiPassed = record.post_apply_ci_passed === undefined ? undefined : asBoolean(record.post_apply_ci_passed);

  return {
    id: asNonEmptyString(record.id) ?? 'unknown',
    recordedAt: asNonEmptyString(record.recordedAt) ?? new Date(0).toISOString(),
    plan_churn: asInteger(record.plan_churn),
    apply_retries: asInteger(record.apply_retries),
    dependency_drift: asInteger(record.dependency_drift),
    contract_breakage: asInteger(record.contract_breakage),
    docs_mismatch: asBoolean(record.docs_mismatch),
    ci_failure_categories: sortStrings(asStringArray(record.ci_failure_categories)),
    ...(taskProfileId ? { task_profile_id: taskProfileId } : {}),
    ...(taskFamily ? { task_family: taskFamily } : {}),
    affected_surfaces: sortStrings(asStringArray(record.affected_surfaces)),
    estimated_change_surface: asNonNegativeNumber(record.estimated_change_surface),
    actual_change_surface: asNonNegativeNumber(record.actual_change_surface),
    files_changed_count: asInteger(record.files_changed_count),
    ...(postApplyVerifyPassed === undefined ? {} : { post_apply_verify_passed: postApplyVerifyPassed }),
    ...(postApplyCiPassed === undefined ? {} : { post_apply_ci_passed: postApplyCiPassed }),
    regression_categories: sortStrings(asStringArray(record.regression_categories)),
    pattern_families_implicated: sortStrings(asStringArray(record.pattern_families_implicated))
  };
};

const normalizeProcessRecord = (record: ProcessTelemetryRecord): ProcessTelemetryRecord => {
  const normalized: ProcessTelemetryRecord = {
    ...record,
    files_touched: sortStrings(record.files_touched),
    validators_run: sortStrings(record.validators_run),
    merge_conflict_risk: round4(record.merge_conflict_risk)
  };

  if (typeof record.task_profile_id === 'string' && record.task_profile_id.length > 0) {
    normalized.task_profile_id = record.task_profile_id;
  }
  if (typeof record.route_id === 'string' && record.route_id.length > 0) {
    normalized.route_id = record.route_id;
  }

  const normalizedRulePacks = record.rule_packs_selected ? sortStrings(record.rule_packs_selected) : undefined;
  if (normalizedRulePacks) {
    normalized.rule_packs_selected = normalizedRulePacks;
  }

  const normalizedRequired = record.required_validations_selected ? sortStrings(record.required_validations_selected) : undefined;
  if (normalizedRequired) {
    normalized.required_validations_selected = normalizedRequired;
  }

  const normalizedOptional = record.optional_validations_selected ? sortStrings(record.optional_validations_selected) : undefined;
  if (normalizedOptional) {
    normalized.optional_validations_selected = normalizedOptional;
  }

  const validationDuration = normalizeDuration(record.validation_duration_ms);
  if (validationDuration !== undefined) {
    normalized.validation_duration_ms = validationDuration;
  }

  const planningDuration = normalizeDuration(record.planning_duration_ms);
  if (planningDuration !== undefined) {
    normalized.planning_duration_ms = planningDuration;
  }

  const applyDuration = normalizeDuration(record.apply_duration_ms);
  if (applyDuration !== undefined) {
    normalized.apply_duration_ms = applyDuration;
  }

  if (typeof record.actual_merge_conflict === 'boolean') {
    normalized.actual_merge_conflict = record.actual_merge_conflict;
  }
  if (typeof record.human_intervention_required === 'boolean') {
    normalized.human_intervention_required = record.human_intervention_required;
  }

  const parallelLaneCount = normalizePositiveInteger(record.parallel_lane_count, 1);
  if (parallelLaneCount !== undefined) {
    normalized.parallel_lane_count = parallelLaneCount;
  }

  if (typeof record.over_validation_signal === 'boolean') {
    normalized.over_validation_signal = record.over_validation_signal;
  }
  if (typeof record.under_validation_signal === 'boolean') {
    normalized.under_validation_signal = record.under_validation_signal;
  }

  return normalized;
};

export const summarizeOutcomeTelemetry = (records: OutcomeTelemetryRecord[]): OutcomeTelemetrySummary => {
  const ciFailureCategoryCounts = new Map<string, number>();
  const taskFamilyCounts = new Map<string, number>();
  const affectedSurfaceCounts = new Map<string, number>();
  const regressionCategoryCounts = new Map<string, number>();
  const patternFamilyCounts = new Map<string, number>();

  let postApplyVerifyPassedCount = 0;
  let postApplyCiPassedCount = 0;
  let estimatedChangeSurface = 0;
  let actualChangeSurface = 0;
  let filesChangedCount = 0;

  for (const record of records) {
    for (const category of record.ci_failure_categories) {
      ciFailureCategoryCounts.set(category, (ciFailureCategoryCounts.get(category) ?? 0) + 1);
    }

    if (record.task_family) {
      taskFamilyCounts.set(record.task_family, (taskFamilyCounts.get(record.task_family) ?? 0) + 1);
    }

    for (const surface of record.affected_surfaces ?? []) {
      affectedSurfaceCounts.set(surface, (affectedSurfaceCounts.get(surface) ?? 0) + 1);
    }

    for (const category of record.regression_categories ?? []) {
      regressionCategoryCounts.set(category, (regressionCategoryCounts.get(category) ?? 0) + 1);
    }

    for (const family of record.pattern_families_implicated ?? []) {
      patternFamilyCounts.set(family, (patternFamilyCounts.get(family) ?? 0) + 1);
    }

    postApplyVerifyPassedCount += record.post_apply_verify_passed ? 1 : 0;
    postApplyCiPassedCount += record.post_apply_ci_passed ? 1 : 0;
    estimatedChangeSurface += record.estimated_change_surface ?? 0;
    actualChangeSurface += record.actual_change_surface ?? 0;
    filesChangedCount += record.files_changed_count ?? 0;
  }

  return {
    total_records: records.length,
    sum_plan_churn: records.reduce((sum, record) => sum + record.plan_churn, 0),
    sum_apply_retries: records.reduce((sum, record) => sum + record.apply_retries, 0),
    sum_dependency_drift: records.reduce((sum, record) => sum + record.dependency_drift, 0),
    sum_contract_breakage: records.reduce((sum, record) => sum + record.contract_breakage, 0),
    docs_mismatch_count: records.filter((record) => record.docs_mismatch).length,
    ci_failure_category_counts: sortCountMap(Object.fromEntries(ciFailureCategoryCounts)),
    task_family_counts: sortCountMap(Object.fromEntries(taskFamilyCounts)),
    affected_surface_counts: sortCountMap(Object.fromEntries(affectedSurfaceCounts)),
    regression_category_counts: sortCountMap(Object.fromEntries(regressionCategoryCounts)),
    pattern_family_implicated_counts: sortCountMap(Object.fromEntries(patternFamilyCounts)),
    post_apply_verify_passed_count: postApplyVerifyPassedCount,
    post_apply_ci_passed_count: postApplyCiPassedCount,
    sum_estimated_change_surface: round4(estimatedChangeSurface),
    sum_actual_change_surface: round4(actualChangeSurface),
    sum_files_changed_count: filesChangedCount
  };
};

export const summarizeProcessTelemetry = (records: ProcessTelemetryRecord[]): ProcessTelemetrySummary => {
  const taskFamilyCounts = new Map<string, number>();
  const validatorsRunCounts = new Map<string, number>();
  const routeIdCounts = new Map<string, number>();
  const taskProfileIdCounts = new Map<string, number>();
  const rulePackCounts = new Map<string, number>();
  const requiredValidationCounts = new Map<string, number>();
  const optionalValidationCounts = new Map<string, number>();
  const filesTouched = new Set<string>();
  const validatorsTouched = new Set<string>();

  const reasoningScopeCounts: Record<ProcessReasoningScope, number> = {
    narrow: 0,
    module: 0,
    repository: 0,
    'cross-repo': 0
  };

  for (const record of records) {
    taskFamilyCounts.set(record.task_family, (taskFamilyCounts.get(record.task_family) ?? 0) + 1);
    reasoningScopeCounts[record.reasoning_scope] += 1;

    if (record.route_id) {
      routeIdCounts.set(record.route_id, (routeIdCounts.get(record.route_id) ?? 0) + 1);
    }

    if (record.task_profile_id) {
      taskProfileIdCounts.set(record.task_profile_id, (taskProfileIdCounts.get(record.task_profile_id) ?? 0) + 1);
    }

    for (const file of record.files_touched) {
      filesTouched.add(file);
    }
    for (const validator of record.validators_run) {
      validatorsTouched.add(validator);
      validatorsRunCounts.set(validator, (validatorsRunCounts.get(validator) ?? 0) + 1);
    }

    for (const rulePack of record.rule_packs_selected ?? []) {
      rulePackCounts.set(rulePack, (rulePackCounts.get(rulePack) ?? 0) + 1);
    }

    for (const validation of record.required_validations_selected ?? []) {
      requiredValidationCounts.set(validation, (requiredValidationCounts.get(validation) ?? 0) + 1);
    }

    for (const validation of record.optional_validations_selected ?? []) {
      optionalValidationCounts.set(validation, (optionalValidationCounts.get(validation) ?? 0) + 1);
    }
  }

  const totalTaskDurationMs = records.reduce((sum, record) => sum + record.task_duration_ms, 0);
  const totalRetryCount = records.reduce((sum, record) => sum + record.retry_count, 0);
  const mergeConflictRiskTotal = records.reduce((sum, record) => sum + record.merge_conflict_risk, 0);
  const totalValidationDurationMs = records.reduce((sum, record) => sum + (record.validation_duration_ms ?? 0), 0);
  const totalPlanningDurationMs = records.reduce((sum, record) => sum + (record.planning_duration_ms ?? 0), 0);
  const totalApplyDurationMs = records.reduce((sum, record) => sum + (record.apply_duration_ms ?? 0), 0);
  const averageTaskDuration = records.length === 0 ? 0 : totalTaskDurationMs / records.length;
  const averageMergeConflictRisk = records.length === 0 ? 0 : mergeConflictRiskTotal / records.length;
  const averageParallelLaneCount =
    records.length === 0 ? 0 : records.reduce((sum, record) => sum + (record.parallel_lane_count ?? 1), 0) / records.length;

  return {
    total_records: records.length,
    total_task_duration_ms: totalTaskDurationMs,
    average_task_duration_ms: round4(averageTaskDuration),
    total_retry_count: totalRetryCount,
    first_pass_success_count: records.filter((record) => record.first_pass_success).length,
    average_merge_conflict_risk: round4(averageMergeConflictRisk),
    total_files_touched_unique: filesTouched.size,
    total_validators_run_unique: validatorsTouched.size,
    task_family_counts: sortCountMap(Object.fromEntries(taskFamilyCounts)),
    validators_run_counts: sortCountMap(Object.fromEntries(validatorsRunCounts)),
    reasoning_scope_counts: reasoningScopeCounts,
    route_id_counts: sortCountMap(Object.fromEntries(routeIdCounts)),
    task_profile_id_counts: sortCountMap(Object.fromEntries(taskProfileIdCounts)),
    rule_packs_selected_counts: sortCountMap(Object.fromEntries(rulePackCounts)),
    required_validations_selected_counts: sortCountMap(Object.fromEntries(requiredValidationCounts)),
    optional_validations_selected_counts: sortCountMap(Object.fromEntries(optionalValidationCounts)),
    total_validation_duration_ms: totalValidationDurationMs,
    total_planning_duration_ms: totalPlanningDurationMs,
    total_apply_duration_ms: totalApplyDurationMs,
    human_intervention_required_count: records.filter((record) => record.human_intervention_required).length,
    actual_merge_conflict_count: records.filter((record) => record.actual_merge_conflict).length,
    average_parallel_lane_count: round4(averageParallelLaneCount),
    over_validation_signal_count: records.filter((record) => record.over_validation_signal).length,
    under_validation_signal_count: records.filter((record) => record.under_validation_signal).length
  };
};

export const normalizeOutcomeTelemetryArtifact = (artifact: OutcomeTelemetryArtifact): OutcomeTelemetryArtifact => {
  const records = (artifact.records ?? []).map((record) => normalizeOutcomeRecord(record)).sort(compareRecords);
  return {
    ...artifact,
    generatedAt: asNonEmptyString(artifact.generatedAt) ?? new Date(0).toISOString(),
    records,
    summary: summarizeOutcomeTelemetry(records)
  };
};

export const normalizeProcessTelemetryArtifact = (artifact: ProcessTelemetryArtifact): ProcessTelemetryArtifact => {
  const records = artifact.records.map(normalizeProcessRecord).sort(compareRecords);
  return {
    ...artifact,
    generatedAt: asNonEmptyString(artifact.generatedAt) ?? new Date(0).toISOString(),
    records,
    summary: summarizeProcessTelemetry(records)
  };
};

export const summarizeStructuralTelemetry = (outcomes: OutcomeTelemetryArtifact, process: ProcessTelemetryArtifact) => ({
  schemaVersion: '1.0',
  kind: 'telemetry-summary' as const,
  generatedAt: [outcomes.generatedAt, process.generatedAt].sort((left, right) => right.localeCompare(left))[0] ?? new Date(0).toISOString(),
  outcomes: normalizeOutcomeTelemetryArtifact(outcomes).summary,
  process: normalizeProcessTelemetryArtifact(process).summary
});
