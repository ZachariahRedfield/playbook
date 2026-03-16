export type CycleResult = 'success' | 'failed';

export type CycleHistoryRecord = {
  cycle_id: string;
  started_at: string;
  result: CycleResult;
  failed_step?: string;
  duration_ms: number;
};

export type CycleHistoryArtifact = {
  history_version: number;
  repo: string;
  cycles: CycleHistoryRecord[];
};

export type CycleStateStep = {
  name: string;
  status: 'success' | 'failure';
  duration_ms: number;
};

export type CycleStateArtifact = {
  cycle_version: number;
  repo: string;
  cycle_id: string;
  started_at: string;
  result: CycleResult;
  failed_step?: string;
  steps: CycleStateStep[];
  artifacts_written?: string[];
};

export type CycleTelemetryRecentCycle = {
  cycle_id: string;
  started_at: string;
  result: CycleResult;
  failed_step?: string;
  duration_ms: number;
};

export type CycleTelemetrySummary = {
  cycles_total: number;
  cycles_success: number;
  cycles_failed: number;
  success_rate: number;
  average_duration_ms: number;
  most_common_failed_step: string | null;
  failure_distribution: Record<string, number>;
  recent_cycles: CycleTelemetryRecentCycle[];
  latest_cycle_state?: {
    cycle_id: string;
    started_at: string;
    result: CycleResult;
    failed_step?: string;
    duration_ms: number;
  };
};

const toRate = (numerator: number, denominator: number): number => {
  if (denominator <= 0) {
    return 0;
  }

  return Number((numerator / denominator).toFixed(4));
};

const toAverage = (values: number[]): number => {
  if (values.length === 0) {
    return 0;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return Number((total / values.length).toFixed(2));
};

const summarizeFailureDistribution = (cycles: CycleHistoryRecord[]): Record<string, number> => {
  const failures = new Map<string, number>();

  for (const cycle of cycles) {
    if (cycle.result !== 'failed' || !cycle.failed_step) {
      continue;
    }

    failures.set(cycle.failed_step, (failures.get(cycle.failed_step) ?? 0) + 1);
  }

  return Object.fromEntries([...failures.entries()].sort(([left], [right]) => left.localeCompare(right)));
};

const mostCommonFailedStep = (distribution: Record<string, number>): string | null => {
  const entries = Object.entries(distribution);
  if (entries.length === 0) {
    return null;
  }

  entries.sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1];
    }

    return left[0].localeCompare(right[0]);
  });

  return entries[0]?.[0] ?? null;
};

const toLatestStateSummary = (state: CycleStateArtifact): CycleTelemetrySummary['latest_cycle_state'] => {
  const durationMs = state.steps.reduce((sum, step) => sum + step.duration_ms, 0);
  return {
    cycle_id: state.cycle_id,
    started_at: state.started_at,
    result: state.result,
    ...(state.failed_step ? { failed_step: state.failed_step } : {}),
    duration_ms: durationMs
  };
};

export const summarizeCycleTelemetry = (input: {
  cycleHistory?: CycleHistoryArtifact;
  cycleState?: CycleStateArtifact;
  recentLimit?: number;
}): CycleTelemetrySummary => {
  const recentLimit = input.recentLimit ?? 5;
  const cycles = [...(input.cycleHistory?.cycles ?? [])];

  cycles.sort((left, right) => {
    const delta = Date.parse(right.started_at) - Date.parse(left.started_at);
    if (Number.isNaN(delta) || delta === 0) {
      return left.cycle_id.localeCompare(right.cycle_id);
    }

    return delta;
  });

  const cyclesTotal = cycles.length;
  const cyclesSuccess = cycles.filter((cycle) => cycle.result === 'success').length;
  const cyclesFailed = cyclesTotal - cyclesSuccess;
  const failureDistribution = summarizeFailureDistribution(cycles);

  const summary: CycleTelemetrySummary = {
    cycles_total: cyclesTotal,
    cycles_success: cyclesSuccess,
    cycles_failed: cyclesFailed,
    success_rate: toRate(cyclesSuccess, cyclesTotal),
    average_duration_ms: toAverage(cycles.map((cycle) => cycle.duration_ms)),
    most_common_failed_step: mostCommonFailedStep(failureDistribution),
    failure_distribution: failureDistribution,
    recent_cycles: cycles.slice(0, recentLimit).map((cycle) => ({
      cycle_id: cycle.cycle_id,
      started_at: cycle.started_at,
      result: cycle.result,
      ...(cycle.failed_step ? { failed_step: cycle.failed_step } : {}),
      duration_ms: cycle.duration_ms
    }))
  };

  if (input.cycleState) {
    summary.latest_cycle_state = toLatestStateSummary(input.cycleState);
  }

  return summary;
};
