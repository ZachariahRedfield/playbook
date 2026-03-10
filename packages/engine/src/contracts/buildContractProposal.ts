import { createHash } from 'node:crypto';
import type { PatternCard } from '../schema/patternCard.js';
import type { ContractMutationType, ContractProposal } from '../schema/contractProposal.js';

const uniqueSorted = (values: string[]): string[] => [...new Set(values)].sort((left, right) => left.localeCompare(right));

const defaultMutationType = (pattern: PatternCard): ContractMutationType => {
  if (pattern.state === 'superseded' && pattern.versionRef.supersededBy) {
    return 'replace_rule';
  }
  if (pattern.state === 'superseded') {
    return 'deprecate_rule';
  }
  if (pattern.linkedContractRefs.length === 0) {
    return 'add_rule';
  }
  return 'modify_rule';
};

const createProposalId = (input: {
  originCycleId: string;
  patternId: string;
  mutationType: ContractMutationType;
  ruleTarget: string;
  evidenceRefs: string[];
}): string => {
  const digest = createHash('sha256')
    .update(input.originCycleId)
    .update('|')
    .update(input.patternId)
    .update('|')
    .update(input.mutationType)
    .update('|')
    .update(input.ruleTarget)
    .update('|')
    .update(input.evidenceRefs.join(','))
    .digest('hex')
    .slice(0, 12);
  return `proposal:${input.originCycleId}:${input.patternId}:${digest}`;
};

export type BuildContractProposalInput = {
  pattern: PatternCard;
  originCycleId?: string;
  mutationType?: ContractMutationType;
  ruleTarget?: string;
};

export const buildContractProposal = ({ pattern, originCycleId, mutationType, ruleTarget }: BuildContractProposalInput): ContractProposal => {
  const resolvedMutationType = mutationType ?? defaultMutationType(pattern);
  const resolvedOriginCycleId = originCycleId ?? pattern.lineage.originCycleIds[0] ?? 'unknown-cycle';
  const resolvedRuleTarget = ruleTarget ?? pattern.linkedContractRefs[0] ?? `rule:${pattern.patternId}`;

  const evidenceRefs = uniqueSorted(pattern.lineage.evidenceRefs);

  return {
    schemaVersion: '1.0',
    kind: 'playbook-contract-proposal',
    proposalId: createProposalId({
      originCycleId: resolvedOriginCycleId,
      patternId: pattern.patternId,
      mutationType: resolvedMutationType,
      ruleTarget: resolvedRuleTarget,
      evidenceRefs
    }),
    originCycleId: resolvedOriginCycleId,
    patternId: pattern.patternId,
    mutationType: resolvedMutationType,
    ruleTarget: resolvedRuleTarget,
    ruleChange: {
      canonicalKey: pattern.canonicalKey,
      title: pattern.title,
      summary: pattern.summary,
      mechanism: pattern.mechanism,
      invariant: pattern.invariant
    },
    evidenceRefs,
    sourceZettelIds: uniqueSorted(pattern.lineage.sourceZettelIds),
    sourceGroupIds: uniqueSorted(pattern.lineage.sourceGroupIds),
    verificationStatus: 'pending',
    decisionStatus: 'pending'
  };
};
