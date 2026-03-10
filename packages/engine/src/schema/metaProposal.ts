export const META_PROPOSAL_SCHEMA_VERSION = '1.0' as const;

export type MetaProposal = {
  proposalId: string;
  sourceFindingIds: string[];
  proposalType: string;
  proposedChange: string;
  reason: string;
  supportingMetrics: Record<string, number>;
  status: 'draft' | 'proposed' | 'accepted' | 'rejected';
  createdAt: string;
};

export type MetaProposalsArtifact = {
  schemaVersion: typeof META_PROPOSAL_SCHEMA_VERSION;
  kind: 'playbook-meta-proposals';
  createdAt: string;
  proposals: MetaProposal[];
};
