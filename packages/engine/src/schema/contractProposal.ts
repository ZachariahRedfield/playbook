export const CONTRACT_MUTATION_TYPES = ['add_rule', 'modify_rule', 'deprecate_rule', 'replace_rule'] as const;
export const CONTRACT_PROPOSAL_VERIFICATION_STATES = ['pending', 'passed', 'failed'] as const;
export const CONTRACT_PROPOSAL_DECISION_STATES = ['pending', 'accepted', 'rejected'] as const;

export type ContractMutationType = (typeof CONTRACT_MUTATION_TYPES)[number];
export type ContractProposalVerificationStatus = (typeof CONTRACT_PROPOSAL_VERIFICATION_STATES)[number];
export type ContractProposalDecisionStatus = (typeof CONTRACT_PROPOSAL_DECISION_STATES)[number];

export type ContractVersionRef = {
  contractId: string;
  version: number;
  artifactPath: string;
  createdAt: string;
  supersedes?: string;
  supersededBy?: string;
};

export type ContractMutation = {
  mutationType: ContractMutationType;
  ruleTarget: string;
  ruleChange: Record<string, unknown>;
};

export type ContractProposal = {
  schemaVersion: '1.0';
  kind: 'playbook-contract-proposal';
  proposalId: string;
  originCycleId: string;
  patternId: string;
  mutationType: ContractMutationType;
  ruleTarget: string;
  ruleChange: Record<string, unknown>;
  evidenceRefs: string[];
  sourceZettelIds: string[];
  sourceGroupIds: string[];
  verificationStatus: ContractProposalVerificationStatus;
  decisionStatus: ContractProposalDecisionStatus;
};
