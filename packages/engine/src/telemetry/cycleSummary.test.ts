import { describe, expect, it } from 'vitest';
import { summarizeCycleTelemetry } from './cycleSummary.js';

describe('cycle telemetry summary', () => {
  it('computes deterministic summary metrics from governed cycle history', () => {
    const summary = summarizeCycleTelemetry({
      cycleHistory: {
        history_version: 1,
        repo: '/repo',
        cycles: [
          {
            cycle_id: 'cycle-001',
            started_at: '2026-03-15T00:00:00.000Z',
            result: 'success',
            duration_ms: 1000
          },
          {
            cycle_id: 'cycle-002',
            started_at: '2026-03-15T01:00:00.000Z',
            result: 'failed',
            failed_step: 'verify',
            duration_ms: 2000
          },
          {
            cycle_id: 'cycle-003',
            started_at: '2026-03-15T02:00:00.000Z',
            result: 'failed',
            failed_step: 'execute',
            duration_ms: 4000
          },
          {
            cycle_id: 'cycle-004',
            started_at: '2026-03-15T03:00:00.000Z',
            result: 'failed',
            failed_step: 'execute',
            duration_ms: 3000
          }
        ]
      }
    });

    expect(summary.cycles_total).toBe(4);
    expect(summary.cycles_success).toBe(1);
    expect(summary.cycles_failed).toBe(3);
    expect(summary.success_rate).toBe(0.25);
    expect(summary.average_duration_ms).toBe(2500);
    expect(summary.failure_distribution).toEqual({
      execute: 2,
      verify: 1
    });
    expect(summary.most_common_failed_step).toBe('execute');
    expect(summary.recent_cycles[0]?.cycle_id).toBe('cycle-004');
  });

  it('returns stable empty summary when no cycle history exists', () => {
    const summary = summarizeCycleTelemetry({});

    expect(summary).toEqual({
      cycles_total: 0,
      cycles_success: 0,
      cycles_failed: 0,
      success_rate: 0,
      average_duration_ms: 0,
      most_common_failed_step: null,
      failure_distribution: {},
      recent_cycles: []
    });
  });

  it('includes latest cycle-state snapshot when present', () => {
    const summary = summarizeCycleTelemetry({
      cycleHistory: {
        history_version: 1,
        repo: '/repo',
        cycles: []
      },
      cycleState: {
        cycle_version: 1,
        repo: '/repo',
        cycle_id: 'cycle-live',
        started_at: '2026-03-16T00:00:00.000Z',
        result: 'failed',
        failed_step: 'telemetry',
        steps: [
          { name: 'verify', status: 'success', duration_ms: 25 },
          { name: 'telemetry', status: 'failure', duration_ms: 75 }
        ]
      }
    });

    expect(summary.latest_cycle_state).toEqual({
      cycle_id: 'cycle-live',
      started_at: '2026-03-16T00:00:00.000Z',
      result: 'failed',
      failed_step: 'telemetry',
      duration_ms: 100
    });
  });
});
