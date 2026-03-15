import type { LaneOutcomeScore } from '@zachariahredfield/playbook-core';

const round4 = (value: number): number => Number(value.toFixed(4));

const clamp01 = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
};

const asNonNegativeInt = (value: number): number => {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Math.trunc(value);
};

const asNonNegative = (value: number): number => {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }
  return value;
};

export type LaneScoringSignalInput = {
  laneId: string;
  executionDurationMs: number;
  retryCount: number;
  successRate: number;
};

export const computeLaneOutcomeScore = (input: LaneScoringSignalInput): LaneOutcomeScore => {
  const executionDuration = asNonNegative(input.executionDurationMs);
  const retryCount = asNonNegativeInt(input.retryCount);
  const successRate = clamp01(input.successRate);
  const retryPressure = clamp01(retryCount / 5);
  const normalizedDuration = clamp01(executionDuration / 60_000);
  const score = clamp01(successRate - retryPressure - normalizedDuration);

  return {
    lane_id: input.laneId,
    execution_duration: Math.round(executionDuration),
    retry_count: retryCount,
    success_rate: round4(successRate),
    score: round4(score)
  };
};

export type LaneScoreSummary = {
  total_lanes: number;
  average_score: number;
  best_lane_id?: string;
  best_score?: number;
  worst_lane_id?: string;
  worst_score?: number;
};

export const summarizeLaneOutcomeScores = (scores: LaneOutcomeScore[]): LaneScoreSummary => {
  if (scores.length === 0) {
    return {
      total_lanes: 0,
      average_score: 0
    };
  }

  const ordered = [...scores].sort((left, right) => left.lane_id.localeCompare(right.lane_id));
  const total = ordered.reduce((sum, entry) => sum + entry.score, 0);
  const best = [...ordered].sort((left, right) => right.score - left.score || left.lane_id.localeCompare(right.lane_id))[0] ?? ordered[0];
  const worst = [...ordered].sort((left, right) => left.score - right.score || left.lane_id.localeCompare(right.lane_id))[0] ?? ordered[0];

  return {
    total_lanes: ordered.length,
    average_score: round4(total / ordered.length),
    best_lane_id: best?.lane_id,
    best_score: best?.score,
    worst_lane_id: worst?.lane_id,
    worst_score: worst?.score
  };
};
