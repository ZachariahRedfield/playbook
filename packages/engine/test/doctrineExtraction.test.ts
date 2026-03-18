import { describe, expect, it } from 'vitest';
import { extractDoctrineFromSummary } from '../src/learn/doctrine.js';

describe('extractDoctrineFromSummary', () => {
  it('returns stable report-only doctrine for seeded pilot fixtures', () => {
    const payload = extractDoctrineFromSummary({
      summary: [
        'Artifact governance / staged promotion hardened the workflow-promotion contract.',
        'This change also reinforced a shared aggregation boundary for reads and targeted invalidation with centralized recompute for writes.'
      ].join('\n'),
      changedFiles: ['docs/CHANGELOG.md', 'docs/commands/README.md']
    });

    expect(payload.command).toBe('learn-doctrine');
    expect(payload.mode).toBe('report-only');
    expect(payload.learned.rules.map((entry) => entry.statement)).toContain(
      'Generated artifacts must be produced in staging and promoted only after validation succeeds.'
    );
    expect(payload.learned.patterns.map((entry) => entry.statement)).toContain(
      'Mutation path -> affected canonical IDs -> centralized recompute.'
    );
    expect(payload.learned.failureModes.map((entry) => entry.statement)).toContain(
      'Ad hoc workflow promotion metadata fragments governance semantics and makes higher-level reasoning inconsistent.'
    );
    expect(payload.candidateFutureChecks.map((entry) => entry.name)).toContain('workflow-promotion-shape-regression');
  });

  it('falls back to repository-wide doctrine when no seeded example matches', () => {
    const payload = extractDoctrineFromSummary({
      summary: 'Adjusted copy in a way that should still produce reusable learning output.'
    });

    expect(payload.learned.rules[0]?.statement).toBe(
      'Post-merge learning should extract reusable doctrine from real code changes.'
    );
    expect(payload.learned.failureModes[0]?.statement).toBe(
      'Valuable engineering doctrine remains trapped in conversations and PR context unless extracted into reusable system knowledge.'
    );
    expect(payload.candidateFutureChecks[0]?.name).toBe('post-merge-doctrine-coverage');
  });
});
