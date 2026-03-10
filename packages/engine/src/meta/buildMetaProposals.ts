import type { MetaFinding } from '../schema/metaFinding.js';
import type { MetaImprovementProposal, MetaProposalsArtifact } from '../schema/metaProposal.js';

const toProposal = (finding: MetaFinding, createdAt: string): MetaImprovementProposal => ({
  proposalId: `meta-proposal:${finding.type}`,
  sourceFindingId: finding.findingId,
  createdAt,
  kind: 'playbook-meta-improvement-proposal',
  status: 'draft',
  title: `Improve ${finding.type.replaceAll('_', ' ')}`,
  summary: finding.recommendation,
  actions: [
    'review source finding and evidence artifacts',
    'design deterministic remediation experiment with success criteria',
    'submit through doctrine governance commands without automatic mutation'
  ],
  governedReviewRequired: true,
  mutationPolicy: 'proposal-only',
  guardrail: 'meta-proposals-cannot-mutate-doctrine',
  evidenceArtifactRefs: [...finding.artifactRefs].sort((a, b) => a.localeCompare(b)),
  supportingMetrics: finding.supportingMetrics
});

export const buildMetaProposals = (findings: MetaFinding[], createdAt: string): MetaProposalsArtifact => ({
  schemaVersion: '1.0',
  kind: 'playbook-meta-proposals',
  createdAt,
  proposals: findings
    .filter((finding) => finding.severity !== 'low')
    .map((finding) => toProposal(finding, createdAt))
    .sort((a, b) => a.proposalId.localeCompare(b.proposalId))
});
