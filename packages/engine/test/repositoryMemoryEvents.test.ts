import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  recordImprovementCandidate,
  recordLaneOutcome,
  recordLaneTransition,
  recordRouteDecision,
  recordWorkerAssignment
} from '../src/index.js';

const readJson = <T>(filePath: string): T => JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;

describe('repository memory events', () => {
  it('records append-only deterministic events and updates index totals', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-repository-events-'));

    const route = recordRouteDecision(root, {
      timestamp: '2026-02-01T00:00:00.000Z',
      task_text: 'Route a deterministic task',
      task_family: 'governance',
      route_id: 'proposal-only',
      confidence: 0.9234567
    });

    const laneTransition = recordLaneTransition(root, {
      timestamp: '2026-02-01T00:00:01.000Z',
      lane_id: 'lane-a',
      from_state: 'planned',
      to_state: 'ready'
    });

    const assignment = recordWorkerAssignment(root, {
      timestamp: '2026-02-01T00:00:02.000Z',
      lane_id: 'lane-a',
      worker_id: 'worker-lane-a',
      assignment_status: 'assigned',
      assigned_prompt: '.playbook/prompts/lane-a.md'
    });

    const outcome = recordLaneOutcome(root, {
      timestamp: '2026-02-01T00:00:03.000Z',
      lane_id: 'lane-a',
      outcome: 'success',
      summary: 'worker completed deterministic handoff'
    });

    const improvement = recordImprovementCandidate(root, {
      timestamp: '2026-02-01T00:00:04.000Z',
      candidate_id: 'candidate-1',
      source: 'patterns.candidates',
      summary: 'Detected reusable deterministic improvement candidate',
      confidence: 0.7777777
    });

    const eventsDir = path.join(root, '.playbook', 'memory', 'events');
    const events = fs.readdirSync(eventsDir).filter((entry) => entry.endsWith('.json')).sort((a, b) => a.localeCompare(b));
    expect(events.length).toBe(5);

    const routePayload = readJson<{ confidence: number; event_type: string }>(path.join(eventsDir, `${route.event_id}.json`));
    expect(routePayload.event_type).toBe('route_decision');
    expect(routePayload.confidence).toBe(0.923457);

    const index = readJson<{
      total_events: number;
      by_event_type: Record<string, { count: number; latest_timestamp: string | null }>;
    }>(path.join(root, '.playbook', 'memory', 'index.json'));

    expect(index.total_events).toBe(5);
    expect(index.by_event_type.route_decision).toEqual({ count: 1, latest_timestamp: '2026-02-01T00:00:00.000Z' });
    expect(index.by_event_type.lane_transition).toEqual({ count: 1, latest_timestamp: '2026-02-01T00:00:01.000Z' });
    expect(index.by_event_type.worker_assignment).toEqual({ count: 1, latest_timestamp: '2026-02-01T00:00:02.000Z' });
    expect(index.by_event_type.lane_outcome).toEqual({ count: 1, latest_timestamp: '2026-02-01T00:00:03.000Z' });
    expect(index.by_event_type.improvement_candidate).toEqual({ count: 1, latest_timestamp: '2026-02-01T00:00:04.000Z' });

    expect(laneTransition.event_type).toBe('lane_transition');
    expect(assignment.event_type).toBe('worker_assignment');
    expect(outcome.event_type).toBe('lane_outcome');
    expect(improvement.event_type).toBe('improvement_candidate');
  });
});
