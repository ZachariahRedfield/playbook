import { describe, expect, it } from 'vitest';
import { createKnowledgeArtifactId, serializeCanonicalKnowledgeShape } from '../src/knowledge/knowledge-id.js';
import {
  compactCandidate,
  createCandidate,
  markSupersededArtifacts,
  promoteKnowledge,
  retireKnowledge,
  withLinkedEvidence
} from '../src/knowledge/knowledge-lifecycle.js';
import {
  knowledgeCandidateFixture,
  knowledgeCandidateWithExtraEvidenceFixture,
  knowledgeCompactedFixture,
  knowledgePromotedFixture,
  knowledgePromotedWithSupersedesFixture,
  knowledgeRetiredFixture
} from '../src/knowledge/knowledge-test-fixtures.js';

describe('knowledge lifecycle internal model', () => {
  it('generates deterministic IDs from canonicalized representation', () => {
    const a = serializeCanonicalKnowledgeShape({ b: 2, a: 1, nested: { z: true, c: ['x', 'y'] } });
    const b = serializeCanonicalKnowledgeShape({ nested: { c: ['x', 'y'], z: true }, a: 1, b: 2 });

    expect(a).toBe(b);
    expect(createKnowledgeArtifactId('pattern:test', a)).toBe(createKnowledgeArtifactId('pattern:test', b));
  });

  it('supports deterministic lifecycle transitions candidate -> compacted -> promoted -> retired', () => {
    expect(knowledgeCandidateFixture.lifecycleState).toBe('candidate');
    expect(knowledgeCompactedFixture.lifecycleState).toBe('compacted');
    expect(knowledgePromotedFixture.lifecycleState).toBe('promoted');
    expect(knowledgeRetiredFixture.lifecycleState).toBe('retired');
    expect(knowledgeRetiredFixture.supersededByArtifactId).toBe('knowledge-successor-0001');

    expect(() => compactCandidate(knowledgePromotedFixture as never, { compactedAt: 1 })).toThrow(
      'Invalid lifecycle transition: promoted -> compacted. Expected current state candidate.'
    );
  });

  it('links evidence deterministically', () => {
    expect(knowledgeCandidateWithExtraEvidenceFixture.evidence).toEqual([
      {
        type: 'observation',
        source: 'packages/engine/test/knowledge.compaction.test.ts',
        timestamp: 1710000000000
      },
      {
        type: 'rule',
        source: 'docs/PLAYBOOK_PRODUCT_ROADMAP.md',
        timestamp: 1710000001500
      }
    ]);

    const linkedAgain = withLinkedEvidence(knowledgeCandidateWithExtraEvidenceFixture, {
      type: 'remediation',
      source: 'playbook plan output',
      timestamp: 1710000003500
    });
    expect(linkedAgain.evidence.map((item) => item.type)).toEqual(['observation', 'remediation', 'rule']);
  });

  it('tracks supersede relationships deterministically', () => {
    expect(knowledgePromotedWithSupersedesFixture.supersedesArtifactIds).toEqual([
      'knowledge-legacy-0001',
      'knowledge-legacy-0002'
    ]);

    const updated = markSupersededArtifacts(knowledgePromotedWithSupersedesFixture, ['knowledge-legacy-0002', 'knowledge-legacy-0003']);
    expect(updated.supersedesArtifactIds).toEqual(['knowledge-legacy-0001', 'knowledge-legacy-0002', 'knowledge-legacy-0003']);
  });

  it('preserves id stability across transitions for same canonical representation', () => {
    const candidate = createCandidate({
      canonicalKey: 'pattern:stable-id',
      canonicalShape: { mechanism: 'same' },
      createdAt: 1
    });
    const compacted = compactCandidate(candidate, { compactedAt: 2 });
    const promoted = promoteKnowledge(compacted, { promotedAt: 3 });
    const retired = retireKnowledge(promoted, { retiredAt: 4 });

    expect(candidate.id).toBe(compacted.id);
    expect(compacted.id).toBe(promoted.id);
    expect(promoted.id).toBe(retired.id);
  });
});
