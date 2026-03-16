import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  queryRepositoryEvents,
  queryRepositoryEventsByRelatedArtifact,
  queryRepositoryEventsByRunId,
  queryRepositoryEventsByType
} from './events.js';

const createRepo = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-memory-events-'));

const writeEvent = (repo: string, name: string, payload: Record<string, unknown>): void => {
  const eventsDir = path.join(repo, '.playbook', 'memory', 'events');
  fs.mkdirSync(eventsDir, { recursive: true });
  fs.writeFileSync(path.join(eventsDir, `${name}.json`), JSON.stringify(payload, null, 2));
};

describe('repository memory query helpers', () => {
  it('filters by event type deterministically', () => {
    const repo = createRepo();
    writeEvent(repo, 'a-route', {
      schemaVersion: '1.0',
      event_type: 'route_decision',
      event_id: 'a-route',
      timestamp: '2026-01-01T00:00:00.000Z',
      subsystem: 'repository_memory',
      subject: 'route/docs',
      related_artifacts: [],
      payload: {}
    });
    writeEvent(repo, 'b-worker', {
      schemaVersion: '1.0',
      event_type: 'worker_assignment',
      event_id: 'b-worker',
      timestamp: '2026-01-01T00:00:00.000Z',
      subsystem: 'repository_memory',
      subject: 'lane-1',
      related_artifacts: [],
      payload: {}
    });

    const result = queryRepositoryEventsByType(repo, 'route_decision', { order: 'asc' });
    expect(result).toHaveLength(1);
    expect(result[0]?.event_type).toBe('route_decision');

    fs.rmSync(repo, { recursive: true, force: true });
  });

  it('filters by run id', () => {
    const repo = createRepo();
    writeEvent(repo, 'a-run-1', {
      schemaVersion: '1.0',
      event_type: 'lane_transition',
      event_id: 'a-run-1',
      timestamp: '2026-01-01T00:00:00.000Z',
      subsystem: 'repository_memory',
      subject: 'lane-1',
      run_id: 'run-1',
      related_artifacts: [],
      payload: {}
    });
    writeEvent(repo, 'b-run-2', {
      schemaVersion: '1.0',
      event_type: 'lane_transition',
      event_id: 'b-run-2',
      timestamp: '2026-01-01T00:01:00.000Z',
      subsystem: 'repository_memory',
      subject: 'lane-2',
      run_id: 'run-2',
      related_artifacts: [],
      payload: {}
    });

    const result = queryRepositoryEventsByRunId(repo, 'run-1');
    expect(result).toHaveLength(1);
    expect(result[0]?.run_id).toBe('run-1');

    fs.rmSync(repo, { recursive: true, force: true });
  });

  it('filters by related artifact', () => {
    const repo = createRepo();
    writeEvent(repo, 'a-artifact', {
      schemaVersion: '1.0',
      event_type: 'improvement_signal',
      event_id: 'a-artifact',
      timestamp: '2026-01-01T00:00:00.000Z',
      subsystem: 'knowledge_lifecycle',
      subject: 'cand-1',
      related_artifacts: [{ path: '.playbook/plan.json' }],
      payload: {}
    });
    writeEvent(repo, 'b-artifact', {
      schemaVersion: '1.0',
      event_type: 'improvement_signal',
      event_id: 'b-artifact',
      timestamp: '2026-01-01T00:01:00.000Z',
      subsystem: 'knowledge_lifecycle',
      subject: 'cand-2',
      related_artifacts: [{ path: '.playbook/findings.json' }],
      payload: {}
    });

    const result = queryRepositoryEventsByRelatedArtifact(repo, '.playbook/plan.json');
    expect(result).toHaveLength(1);
    expect(result[0]?.event_id).toBe('a-artifact');

    fs.rmSync(repo, { recursive: true, force: true });
  });

  it('returns empty results when no events match filters', () => {
    const repo = createRepo();
    writeEvent(repo, 'a-route', {
      schemaVersion: '1.0',
      event_type: 'route_decision',
      event_id: 'a-route',
      timestamp: '2026-01-01T00:00:00.000Z',
      subsystem: 'repository_memory',
      subject: 'route/docs',
      related_artifacts: [],
      payload: {}
    });

    const result = queryRepositoryEvents(repo, { runId: 'missing-run' });
    expect(result).toEqual([]);

    fs.rmSync(repo, { recursive: true, force: true });
  });

  it('produces stable ordered JSON payloads for identical queries', () => {
    const repo = createRepo();
    writeEvent(repo, 'a', {
      schemaVersion: '1.0',
      event_type: 'lane_transition',
      event_id: 'evt-a',
      timestamp: '2026-01-01T00:00:00.000Z',
      subsystem: 'repository_memory',
      subject: 'lane-1',
      run_id: 'run-1',
      related_artifacts: [],
      payload: {}
    });
    writeEvent(repo, 'b', {
      schemaVersion: '1.0',
      event_type: 'lane_transition',
      event_id: 'evt-b',
      timestamp: '2026-01-01T00:01:00.000Z',
      subsystem: 'repository_memory',
      subject: 'lane-2',
      run_id: 'run-1',
      related_artifacts: [],
      payload: {}
    });

    const first = JSON.stringify(queryRepositoryEvents(repo, { runId: 'run-1', order: 'asc' }));
    const second = JSON.stringify(queryRepositoryEvents(repo, { runId: 'run-1', order: 'asc' }));

    expect(first).toBe(second);

    fs.rmSync(repo, { recursive: true, force: true });
  });
});
