import fs from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildKnowledgeSummary,
  getKnowledgeById,
  getKnowledgeProvenance,
  getKnowledgeTimeline,
  getStaleKnowledge,
  listKnowledge,
  queryKnowledge
} from '../src/knowledge/store.js';
import { createSeededKnowledgeFixtureRepo } from '../../../test/fixtures/knowledge/seededKnowledgeFixture.js';

describe('knowledge store inspection', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('lists knowledge across all record types with deterministic ordering', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-13T00:00:00.000Z'));
    const root = createSeededKnowledgeFixtureRepo({ prefix: 'playbook-knowledge-store-' });

    try {
      const records = listKnowledge(root);

      expect(records.map((record) => record.id)).toEqual([
        'pattern-live',
        'cand-live',
        'event-2',
        'event-1',
        'pattern-old',
        'cand-stale'
      ]);

      expect(buildKnowledgeSummary(records)).toEqual({
        total: 6,
        byType: { evidence: 2, candidate: 2, promoted: 1, superseded: 1 },
        byStatus: { observed: 2, active: 2, stale: 1, retired: 0, superseded: 1 }
      });
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('filters by type, status, module, and text query', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-13T00:00:00.000Z'));
    const root = createSeededKnowledgeFixtureRepo({ prefix: 'playbook-knowledge-filters-' });

    try {
      expect(queryKnowledge(root, { type: 'candidate' }).map((record) => record.id)).toEqual(['cand-live', 'cand-stale']);
      expect(queryKnowledge(root, { status: 'superseded' }).map((record) => record.id)).toEqual(['pattern-old']);
      expect(queryKnowledge(root, { module: 'module-a' }).map((record) => record.id)).toContain('pattern-live');
      expect(queryKnowledge(root, { text: 'Old guidance' }).map((record) => record.id)).toEqual(['pattern-old']);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('builds timelines, direct lookups, provenance, and stale views', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-13T00:00:00.000Z'));
    const root = createSeededKnowledgeFixtureRepo({ prefix: 'playbook-knowledge-links-' });

    try {
      expect(getKnowledgeById(root, 'pattern-live')?.type).toBe('promoted');
      expect(getKnowledgeTimeline(root, { order: 'asc', limit: 2 }).map((record) => record.id)).toEqual(['cand-stale', 'pattern-old']);
      expect(getStaleKnowledge(root).map((record) => record.id)).toEqual(['pattern-old', 'cand-stale']);

      const provenance = getKnowledgeProvenance(root, 'pattern-live');
      expect(provenance?.record.id).toBe('pattern-live');
      expect(provenance?.evidence.map((record) => record.id)).toEqual(['event-1']);
      expect(provenance?.relatedRecords.map((record) => record.id)).toEqual(['cand-live']);
      expect(provenance?.record.provenance.relatedRecordIds).toEqual(['cand-live']);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
