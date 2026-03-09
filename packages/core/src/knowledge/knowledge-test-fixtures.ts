import {
  compactCandidate,
  createCandidate,
  markSupersededArtifacts,
  promoteKnowledge,
  retireKnowledge,
  withLinkedEvidence
} from './knowledge-lifecycle.js';
import type { EvidenceReference } from './knowledge-types.js';

const baseEvidence: EvidenceReference = {
  type: 'observation',
  source: 'packages/engine/test/knowledge.compaction.test.ts',
  timestamp: 1710000000000
};

export const knowledgeCandidateFixture = createCandidate({
  canonicalKey: 'pattern:deterministic-compaction',
  canonicalShape: {
    mechanism: 'canonicalize-before-comparison',
    scope: ['knowledge', 'compaction']
  },
  createdAt: 1710000001000,
  evidence: [baseEvidence]
});

export const knowledgeCompactedFixture = compactCandidate(knowledgeCandidateFixture, { compactedAt: 1710000002000 });
export const knowledgePromotedFixture = promoteKnowledge(knowledgeCompactedFixture, { promotedAt: 1710000003000 });
export const knowledgeRetiredFixture = retireKnowledge(knowledgePromotedFixture, {
  retiredAt: 1710000004000,
  supersededByArtifactId: 'knowledge-successor-0001'
});

export const knowledgeCandidateWithExtraEvidenceFixture = withLinkedEvidence(knowledgeCandidateFixture, {
  type: 'rule',
  source: 'docs/PLAYBOOK_PRODUCT_ROADMAP.md',
  timestamp: 1710000001500
});

export const knowledgePromotedWithSupersedesFixture = markSupersededArtifacts(knowledgePromotedFixture, [
  'knowledge-legacy-0001',
  'knowledge-legacy-0002'
]);
