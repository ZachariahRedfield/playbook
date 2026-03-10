export const META_PROPOSAL_SCHEMA_VERSION = '1.0' as const;

export type MetaImprovementProposal = {
  proposalId: string;
  sourceFindingId: string;
  createdAt: string;
  kind: 'playbook-meta-improvement-proposal';
  status: 'draft';
  title: string;
  summary: string;
  actions: string[];
  governedReviewRequired: true;
  mutationPolicy: 'proposal-only';
  guardrail: 'meta-proposals-cannot-mutate-doctrine';
  evidenceArtifactRefs: string[];
  supportingMetrics: Record<string, number>;
};

export type MetaProposalsArtifact = {
  schemaVersion: typeof META_PROPOSAL_SCHEMA_VERSION;
  kind: 'playbook-meta-proposals';
  createdAt: string;
  proposals: MetaImprovementProposal[];
};
