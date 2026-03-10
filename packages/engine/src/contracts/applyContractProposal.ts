import type { ContractProposal } from '../schema/contractProposal.js';
import type { ContractRule, VersionedContract } from './versioning.js';

type VerifyGateResult = {
  ok: boolean;
  errors?: string[];
};

export type VerifyProposedContract = (input: { proposal: ContractProposal; proposedContract: VersionedContract }) => VerifyGateResult;

export type ApplyContractProposalInput = {
  proposal: ContractProposal;
  currentContract: VersionedContract;
  verifyGate?: VerifyProposedContract;
  appliedAt?: string;
};

export type ApplyContractProposalResult = {
  accepted: boolean;
  proposal: ContractProposal;
  nextContract?: VersionedContract;
  verification: VerifyGateResult;
};

const toRule = (ruleTarget: string, ruleChange: Record<string, unknown>): ContractRule => ({
  ruleId: ruleTarget,
  status: 'active',
  ...ruleChange
});

const applyMutation = (proposal: ContractProposal, existingRules: ContractRule[]): ContractRule[] => {
  if (proposal.mutationType === 'add_rule') {
    if (existingRules.some((rule) => rule.ruleId === proposal.ruleTarget)) {
      throw new Error(`Cannot add existing rule: ${proposal.ruleTarget}`);
    }
    return [...existingRules, toRule(proposal.ruleTarget, proposal.ruleChange)];
  }

  if (proposal.mutationType === 'modify_rule') {
    const target = existingRules.find((rule) => rule.ruleId === proposal.ruleTarget);
    if (!target) throw new Error(`Cannot modify missing rule: ${proposal.ruleTarget}`);
    return existingRules.map((rule) => (rule.ruleId === proposal.ruleTarget ? { ...rule, ...proposal.ruleChange } : rule));
  }

  if (proposal.mutationType === 'deprecate_rule') {
    const target = existingRules.find((rule) => rule.ruleId === proposal.ruleTarget);
    if (!target) throw new Error(`Cannot deprecate missing rule: ${proposal.ruleTarget}`);
    return existingRules.map((rule) => (rule.ruleId === proposal.ruleTarget ? { ...rule, status: 'deprecated' as const } : rule));
  }

  const replacementRuleId = typeof proposal.ruleChange.replacementRuleId === 'string'
    ? proposal.ruleChange.replacementRuleId
    : `${proposal.ruleTarget}.replacement`;

  const nextRules = existingRules.map((rule) => (rule.ruleId === proposal.ruleTarget ? { ...rule, status: 'deprecated' as const } : rule));
  if (!nextRules.some((rule) => rule.ruleId === proposal.ruleTarget)) {
    throw new Error(`Cannot replace missing rule: ${proposal.ruleTarget}`);
  }
  if (nextRules.some((rule) => rule.ruleId === replacementRuleId)) {
    throw new Error(`Replacement rule already exists: ${replacementRuleId}`);
  }

  return [...nextRules, toRule(replacementRuleId, proposal.ruleChange)];
};

export const applyContractProposal = ({ proposal, currentContract, verifyGate, appliedAt }: ApplyContractProposalInput): ApplyContractProposalResult => {
  const mutatedRules = applyMutation(proposal, currentContract.rules).sort((left, right) => left.ruleId.localeCompare(right.ruleId));
  const nextContract: VersionedContract = {
    ...currentContract,
    version: currentContract.version + 1,
    createdAt: appliedAt ?? new Date().toISOString(),
    supersedes: `${currentContract.contractId}@v${currentContract.version}`,
    rules: mutatedRules
  };

  const verification = verifyGate ? verifyGate({ proposal, proposedContract: nextContract }) : { ok: true };
  if (!verification.ok) {
    return {
      accepted: false,
      proposal: { ...proposal, verificationStatus: 'failed', decisionStatus: 'rejected' },
      verification
    };
  }

  return {
    accepted: true,
    proposal: { ...proposal, verificationStatus: 'passed', decisionStatus: 'accepted' },
    nextContract,
    verification
  };
};

export const replayAcceptedContractProposals = (input: {
  initialContract: VersionedContract;
  acceptedProposals: ContractProposal[];
  verifyGate?: VerifyProposedContract;
}): VersionedContract[] => {
  const history: VersionedContract[] = [input.initialContract];
  let current = input.initialContract;
  for (const proposal of input.acceptedProposals) {
    const result = applyContractProposal({ proposal, currentContract: current, verifyGate: input.verifyGate });
    if (!result.accepted || !result.nextContract) {
      throw new Error(`Replay failed for proposal: ${proposal.proposalId}`);
    }
    current = {
      ...result.nextContract,
      supersedes: `${history[history.length - 1].contractId}@v${history[history.length - 1].version}`
    };
    history[history.length - 1] = {
      ...history[history.length - 1],
      supersededBy: `${current.contractId}@v${current.version}`
    };
    history.push(current);
  }
  return history;
};
