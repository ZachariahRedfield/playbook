import fs from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  knowledgeInspect,
  knowledgeList,
  knowledgeProvenance,
  knowledgeQuery,
  knowledgeStale,
  knowledgeTimeline
} from '../src/query/knowledge.js';
import { createSeededKnowledgeFixtureRepo } from '../../../test/fixtures/knowledge/seededKnowledgeFixture.js';

describe('knowledge query services', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns stable payloads for list, query, timeline, and stale views', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-13T00:00:00.000Z'));
    const root = createSeededKnowledgeFixtureRepo({ prefix: 'playbook-knowledge-query-' });

    try {
      expect(knowledgeList(root).command).toBe('knowledge-list');
      expect(knowledgeQuery(root, { type: 'candidate' }).knowledge.map((record) => record.id)).toEqual(['cand-live', 'cand-stale']);
      expect(knowledgeTimeline(root, { order: 'asc', limit: 4 }).knowledge.map((record) => record.id)).toEqual([
        'cand-stale',
        'pattern-old',
        'event-1',
        'event-2'
      ]);
      expect(knowledgeStale(root).knowledge.map((record) => record.id)).toEqual(['pattern-old', 'cand-stale']);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('inspects records and resolves provenance linkages deterministically', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-13T00:00:00.000Z'));
    const root = createSeededKnowledgeFixtureRepo({ prefix: 'playbook-knowledge-provenance-' });

    try {
      const inspected = knowledgeInspect(root, 'pattern-live').knowledge;
      expect(inspected.type).toBe('promoted');
      expect(inspected.metadata.summary).toBe('Reusable guidance');
      expect(inspected.provenance.relatedRecordIds).toEqual(['cand-live']);

      const provenance = knowledgeProvenance(root, 'pattern-live');
      expect(provenance.provenance.record.id).toBe('pattern-live');
      expect(provenance.provenance.evidence.map((record) => record.id)).toEqual(['event-1']);
      expect(provenance.provenance.relatedRecords.map((record) => record.id)).toEqual(['cand-live']);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
