import { describe, expect, it } from 'vitest';
import { mergeSessionSnapshots } from '../src/sessions/merge.js';
import { SessionSnapshot } from '../src/sessions/schema.js';

const base = (overrides: Partial<SessionSnapshot>): SessionSnapshot => ({
  sessionId: 's',
  source: { kind: 'chat-text', hash: 'h' },
  createdAt: '2026-03-05T00:00:00.000Z',
  decisions: [],
  constraints: [],
  openQuestions: [],
  artifacts: [],
  nextSteps: [],
  tags: [],
  ...overrides
});

describe('session merge', () => {
  it('deduplicates and sorts merged fields deterministically', () => {
    const merged = mergeSessionSnapshots([
      base({
        sessionId: 'b',
        decisions: [{ id: 'x', decision: 'Use pnpm' }],
        constraints: ['Offline only', 'No network'],
        artifacts: ['docs/ARCHITECTURE.md'],
        tags: ['cli', 'docs']
      }),
      base({
        sessionId: 'a',
        decisions: [{ id: 'y', decision: ' use PNPM ' }],
        constraints: ['offline only'],
        artifacts: ['docs/architecture.md'],
        tags: ['cli']
      })
    ]);

    expect(merged.mergedSnapshot.decisions).toHaveLength(1);
    expect(merged.mergedSnapshot.constraints).toEqual(['No network', 'offline only']);
    expect(merged.mergedSnapshot.tags).toEqual(['cli', 'docs']);
    expect(merged.mergedSnapshot.artifacts).toContain('docs/architecture.md');
  });

  it('emits decision conflicts when normalized decisions differ materially', () => {
    const merged = mergeSessionSnapshots([
      base({
        sessionId: 'a',
        decisions: [{ id: 'a', decision: 'Use pnpm', rationale: 'Fast install' }]
      }),
      base({
        sessionId: 'b',
        decisions: [{ id: 'b', decision: ' use pnpm ', rationale: 'Monorepo consistency' }]
      })
    ]);

    expect(merged.conflicts).toHaveLength(1);
    expect(merged.conflicts[0]?.type).toBe('decision');
    expect(merged.conflicts[0]?.resolution).toBe('manual');
  });
});
