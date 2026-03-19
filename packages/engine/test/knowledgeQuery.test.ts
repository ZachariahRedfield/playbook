import fs from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  knowledgeCompareQuery,
  knowledgeInspect,
  knowledgeList,
  knowledgeProvenance,
  knowledgeQuery,
  knowledgeStale,
  knowledgeSupersession,
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
      const listed = knowledgeList(root);
      expect(listed.command).toBe('knowledge-list');
      expect(listed.summary.byType).toEqual({ evidence: 2, candidate: 2, promoted: 1, superseded: 1 });
      expect(listed.summary.byStatus).toEqual({ observed: 2, active: 2, stale: 1, retired: 0, superseded: 1 });
      expect(listed.summary.byLifecycle).toEqual({ observed: 2, candidate: 1, active: 1, stale: 1, retired: 0, superseded: 1, demoted: 0 });
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
      expect(inspected.status).toBe('active');

      const provenance = knowledgeProvenance(root, 'pattern-live');
      expect(provenance.provenance.record.id).toBe('pattern-live');
      expect(provenance.provenance.evidence.map((record) => record.id)).toEqual(['event-1']);
      expect(provenance.provenance.relatedRecords.map((record) => record.id)).toEqual(['cand-live']);

      const supersededProvenance = knowledgeProvenance(root, 'pattern-old');
      expect(supersededProvenance.provenance.record.type).toBe('superseded');
      expect(supersededProvenance.provenance.relatedRecords.map((record) => record.id)).toEqual(['pattern-live', 'cand-stale']);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('includes global reusable patterns with lifecycle-aware filtering and supersession views', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-19T00:00:00.000Z'));
    const root = createSeededKnowledgeFixtureRepo({ prefix: 'playbook-knowledge-global-' });
    const playbookHome = `${root}/playbook-home`;
    fs.mkdirSync(`${playbookHome}/.playbook`, { recursive: true });
    fs.writeFileSync(`${playbookHome}/patterns.json`, JSON.stringify({
      schemaVersion: '1.0',
      kind: 'promoted-patterns',
      patterns: [
        {
          id: 'pattern.global.active',
          title: 'Active global pattern',
          description: 'Reusable globally',
          status: 'active',
          confidence: 0.9,
          evidence_refs: ['event-1'],
          provenance: { candidate_id: 'cand-live', promoted_at: '2026-03-01T00:00:00.000Z' }
        },
        {
          id: 'pattern.global.demoted',
          title: 'Demoted global pattern',
          description: 'Old guidance',
          status: 'demoted',
          confidence: 0.4,
          evidence_refs: ['event-2'],
          provenance: { candidate_id: 'cand-stale', promoted_at: '2025-01-01T00:00:00.000Z' },
          demoted_at: '2026-03-10T00:00:00.000Z',
          demotion_reason: 'Obsolete'
        }
      ]
    }, null, 2));
    process.env.PLAYBOOK_HOME = playbookHome;

    try {
      const listed = knowledgeList(root, { lifecycle: 'demoted' });
      expect(listed.knowledge.map((record) => record.id)).toEqual(['pattern.global.demoted']);
      expect(listed.summary.byLifecycle.demoted).toBe(1);

      const compared = knowledgeCompareQuery(root, 'pattern.global.active', 'pattern-live');
      expect(compared.comparison.left.lifecycle.state).toBe('active');

      const supersession = knowledgeSupersession(root, 'pattern.global.demoted');
      expect(supersession.supersession.record.lifecycle.state).toBe('demoted');
      expect(supersession.supersession.record.lifecycle.warnings[0]).toContain('demoted');
    } finally {
      delete process.env.PLAYBOOK_HOME;
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
