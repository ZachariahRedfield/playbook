import type { MetaFinding } from '../schema/metaFinding.js';
import type { MetaProposal, MetaProposalsArtifact } from '../schema/metaProposal.js';

const proposalTypeByFinding: Record<MetaFinding['findingType'], string> = {
  promotion_latency: 'queue-optimization',
  duplicate_pattern_pressure: 'deduplication',
  unresolved_draft_age: 'draft-resolution-policy',
  supersede_rate: 'promotion-gate-tuning',
  entropy_trend: 'compaction-and-reuse',
  contract_mutation_frequency: 'mutation-budgeting'
};

const toProposal = (finding: MetaFinding, createdAt: string): MetaProposal => ({
  proposalId: `meta-proposal:${finding.findingType}`,
  sourceFindingIds: [finding.findingId],
  proposalType: proposalTypeByFinding[finding.findingType],
  proposedChange: `Run governed review for ${finding.findingType} and stage deterministic process experiment only.`,
  reason: finding.description,
  supportingMetrics: finding.supportingMetrics,
  status: 'draft',
  createdAt
});

export const buildMetaProposals = (findings: MetaFinding[], createdAt: string): MetaProposalsArtifact => ({
  schemaVersion: '1.0',
  kind: 'playbook-meta-proposals',
  createdAt,
  proposals: findings.map((finding) => toProposal(finding, createdAt)).sort((a, b) => a.proposalId.localeCompare(b.proposalId))
});
