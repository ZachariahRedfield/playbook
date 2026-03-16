import { describe, expect, it } from 'vitest';
import { buildPolicyPreflight } from './preflight.js';
import type { PolicyEvaluationEntry } from './proposalEvaluator.js';

const entry = (overrides: Partial<PolicyEvaluationEntry>): PolicyEvaluationEntry => ({
  proposal_id: 'proposal-1',
  decision: 'safe',
  reason: 'reason',
  evidence: {
    frequency: 1,
    confidence: 0.9,
    signals: []
  },
  ...overrides
});

describe('buildPolicyPreflight', () => {
  it('returns empty buckets when no proposals exist', () => {
    const result = buildPolicyPreflight([]);

    expect(result.eligible).toEqual([]);
    expect(result.requires_review).toEqual([]);
    expect(result.blocked).toEqual([]);
    expect(result.summary).toEqual({ eligible: 0, requires_review: 0, blocked: 0, total: 0 });
  });

  it('categorizes all safe proposals as eligible', () => {
    const result = buildPolicyPreflight([
      entry({ proposal_id: 'proposal-b', decision: 'safe' }),
      entry({ proposal_id: 'proposal-a', decision: 'safe' })
    ]);

    expect(result.eligible.map((p) => p.proposal_id)).toEqual(['proposal-a', 'proposal-b']);
    expect(result.requires_review).toEqual([]);
    expect(result.blocked).toEqual([]);
    expect(result.summary).toEqual({ eligible: 2, requires_review: 0, blocked: 0, total: 2 });
  });

  it('handles mixed decision states with deterministic ordering', () => {
    const result = buildPolicyPreflight([
      entry({ proposal_id: 'proposal-z', decision: 'blocked' }),
      entry({ proposal_id: 'proposal-b', decision: 'requires_review' }),
      entry({ proposal_id: 'proposal-a', decision: 'safe' })
    ]);

    expect(result.eligible.map((p) => p.proposal_id)).toEqual(['proposal-a']);
    expect(result.requires_review.map((p) => p.proposal_id)).toEqual(['proposal-b']);
    expect(result.blocked.map((p) => p.proposal_id)).toEqual(['proposal-z']);
    expect(result.summary).toEqual({ eligible: 1, requires_review: 1, blocked: 1, total: 3 });
  });
});
