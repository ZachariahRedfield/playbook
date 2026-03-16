import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  readRepositoryEventIndex,
  readRepositoryEvents,
  recordExecutionOutcome,
  recordImprovementSignal,
  recordLaneTransition,
  recordRouteDecision,
  recordWorkerAssignment
} from '../src/index.js';

const readJson = <T>(filePath: string): T => JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;

describe('repository memory events', () => {
  it('records normalized deterministic events and updates index totals', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-repository-events-'));

    const route = recordRouteDecision(root, {
      timestamp: '2026-02-01T00:00:00.000Z',
      task_text: 'Route a deterministic task',
      task_family: 'governance',
      route_id: 'proposal-only',
      confidence: 0.9234567,
      related_artifacts: ['.playbook/execution-plan.json']
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

    const outcome = recordExecutionOutcome(root, {
      timestamp: '2026-02-01T00:00:03.000Z',
      lane_id: 'lane-a',
      outcome: 'success',
      summary: 'worker completed deterministic handoff'
    });

    const improvement = recordImprovementSignal(root, {
      timestamp: '2026-02-01T00:00:04.000Z',
      candidate_id: 'candidate-1',
      source: 'patterns.candidates',
      summary: 'Detected reusable deterministic improvement candidate',
      confidence: 0.7777777
    });

    const eventsDir = path.join(root, '.playbook', 'memory', 'events');
    const events = fs.readdirSync(eventsDir).filter((entry) => entry.endsWith('.json')).sort((a, b) => a.localeCompare(b));
    expect(events.length).toBe(5);

    const routePayload = readJson<{ event_type: string; subsystem: string; subject: { id: string }; payload: { confidence: number } }>(
      path.join(eventsDir, `${route.event_id}.json`)
    );
    expect(routePayload.event_type).toBe('route_decision');
    expect(routePayload.subsystem).toBe('repository_memory');
    expect(routePayload.subject.id).toBe('Route a deterministic task');
    expect(routePayload.payload.confidence).toBe(0.923457);

    const index = readJson<{
      total_events: number;
      by_event_type: Record<string, { count: number; latest_timestamp: string | null }>;
    }>(path.join(root, '.playbook', 'memory', 'index.json'));

    expect(index.total_events).toBe(5);
    expect(index.by_event_type.route_decision).toEqual({ count: 1, latest_timestamp: '2026-02-01T00:00:00.000Z' });
    expect(index.by_event_type.lane_transition).toEqual({ count: 1, latest_timestamp: '2026-02-01T00:00:01.000Z' });
    expect(index.by_event_type.worker_assignment).toEqual({ count: 1, latest_timestamp: '2026-02-01T00:00:02.000Z' });
    expect(index.by_event_type.execution_outcome).toEqual({ count: 1, latest_timestamp: '2026-02-01T00:00:03.000Z' });
    expect(index.by_event_type.improvement_signal).toEqual({ count: 1, latest_timestamp: '2026-02-01T00:00:04.000Z' });

    expect(laneTransition.event_type).toBe('lane_transition');
    expect(assignment.event_type).toBe('worker_assignment');
    expect(outcome.event_type).toBe('execution_outcome');
    expect(improvement.event_type).toBe('improvement_signal');
  });

  it('returns deterministic ordering and supports query filters', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-repository-query-'));

    recordRouteDecision(root, {
      timestamp: '2026-02-02T00:00:02.000Z',
      task_text: 'second',
      task_family: 'docs_only',
      route_id: 'docs-default',
      confidence: 0.7,
      run_id: 'run-1'
    });
    recordRouteDecision(root, {
      timestamp: '2026-02-02T00:00:01.000Z',
      task_text: 'first',
      task_family: 'docs_only',
      route_id: 'docs-default',
      confidence: 0.6,
      run_id: 'run-1'
    });

    const asc = readRepositoryEvents(root, { order: 'asc', eventType: 'route_decision', runId: 'run-1' });
    expect(asc.map((event) => event.payload.task_text)).toEqual(['first', 'second']);

    const desc = readRepositoryEvents(root, { order: 'desc', eventType: 'route_decision', runId: 'run-1' });
    expect(desc.map((event) => event.payload.task_text)).toEqual(['second', 'first']);
  });

  it('handles missing optional fields safely', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-repository-optional-'));

    const transition = recordLaneTransition(root, {
      timestamp: '2026-02-03T00:00:00.000Z',
      lane_id: 'lane-b',
      from_state: 'planned',
      to_state: 'ready'
    });

    expect(transition.run_id).toBeUndefined();
    expect(transition.related_artifacts).toEqual([]);
    expect(transition.payload.reason).toBeUndefined();

    const index = readRepositoryEventIndex(root);
    expect(index.total_events).toBe(1);
    expect(index.by_event_type.lane_transition.count).toBe(1);
  });
});
