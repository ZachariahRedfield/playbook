import { describe, expect, it } from 'vitest';
import {
  assertPatternEligibleForDoctrineTransform,
  buildPatternStoryDoctrineTransform,
} from './doctrineTransforms.js';
import type { PromotedPatternRecord } from './promotion.js';

const basePattern: PromotedPatternRecord = {
  id: 'pattern.shared-read-model',
  pattern_family: 'shared-read-model',
  title: 'Shared read model',
  description: 'Use one shared read aggregation boundary.',
  storySeed: {
    title: 'Adopt the shared read model doctrine',
    summary: 'Promoted doctrine suggests converging read fanout behind one shared boundary.',
    acceptance: ['Document the shared boundary.', 'Route follow-up work through pattern learning.']
  },
  source_artifact: '.playbook/pattern-candidates.json',
  signals: ['fanout'],
  confidence: 0.91,
  evidence_refs: ['docs/ARCHITECTURE.md'],
  status: 'active',
  provenance: {
    source_ref: 'global/pattern-candidates/shared-read-model',
    candidate_id: 'shared-read-model',
    candidate_fingerprint: 'candidate-fingerprint',
    promoted_at: '2026-03-20T00:00:00.000Z'
  },
  superseded_by: null,
  supersedes: [],
  retired_at: null,
  retirement_reason: null,
  demoted_at: null,
  demotion_reason: null,
  recalled_at: null,
  recall_reason: null,
  compatibility: null,
  risk_class: null,
  known_failure_modes: [],
  transferred_from: null,
  lifecycle_events: []
};

describe('doctrine transforms', () => {
  it('builds a provenance-linked story proposal from active promoted doctrine', () => {
    const proposal = buildPatternStoryDoctrineTransform(basePattern, {
      targetRepoId: 'repo-a',
      generatedAt: '2026-03-21T00:00:00.000Z'
    });

    expect(proposal.transform_kind).toBe('pattern_to_story_seed');
    expect(proposal.source.pattern_id).toBe(basePattern.id);
    expect(proposal.target.kind).toBe('story-candidate');
    expect(proposal.target.title).toContain('shared read model');
    expect(proposal.governance.mutation_allowed).toBe(false);
    expect(proposal.evidence).toContain('.playbook/patterns.json');
  });

  it('rejects non-active patterns from influencing proposal surfaces', () => {
    expect(() => assertPatternEligibleForDoctrineTransform({ ...basePattern, status: 'superseded' })).toThrow(
      'Doctrine transforms require active promoted patterns.'
    );
  });
});
