import { describe, expect, it } from 'vitest';
import { computeLaneOutcomeScore } from './laneScoring.js';

describe('laneScoring', () => {
  it('scores a successful lane with no retries', () => {
    const score = computeLaneOutcomeScore({
      laneId: 'lane-success',
      executionDurationMs: 15_000,
      retryCount: 0,
      successRate: 1
    });

    expect(score).toEqual({
      lane_id: 'lane-success',
      execution_duration: 15000,
      retry_count: 0,
      success_rate: 1,
      score: 0.75
    });
  });

  it('scores a failed lane as low quality', () => {
    const score = computeLaneOutcomeScore({
      laneId: 'lane-failed',
      executionDurationMs: 12_000,
      retryCount: 0,
      successRate: 0
    });

    expect(score.score).toBe(0);
    expect(score.success_rate).toBe(0);
  });

  it('penalizes retry-heavy lanes deterministically', () => {
    const score = computeLaneOutcomeScore({
      laneId: 'lane-retry-heavy',
      executionDurationMs: 20_000,
      retryCount: 4,
      successRate: 1
    });

    expect(score).toEqual({
      lane_id: 'lane-retry-heavy',
      execution_duration: 20000,
      retry_count: 4,
      success_rate: 1,
      score: 0
    });
  });
});
