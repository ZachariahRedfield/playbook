import type { PolicyEvaluationEntry } from './proposalEvaluator.js';

export const POLICY_PREFLIGHT_SCHEMA_VERSION = '1.0' as const;

export type PolicyPreflightProposal = {
  proposal_id: string;
  decision: 'safe' | 'requires_review' | 'blocked';
  reason: string;
};

export type PolicyPreflightArtifact = {
  schemaVersion: typeof POLICY_PREFLIGHT_SCHEMA_VERSION;
  eligible: PolicyPreflightProposal[];
  requires_review: PolicyPreflightProposal[];
  blocked: PolicyPreflightProposal[];
  summary: {
    eligible: number;
    requires_review: number;
    blocked: number;
    total: number;
  };
};

export const buildPolicyPreflight = (entries: PolicyEvaluationEntry[]): PolicyPreflightArtifact => {
  const sortedEntries = [...entries].sort((left, right) => left.proposal_id.localeCompare(right.proposal_id));
  const eligible: PolicyPreflightProposal[] = [];
  const requiresReview: PolicyPreflightProposal[] = [];
  const blocked: PolicyPreflightProposal[] = [];

  for (const entry of sortedEntries) {
    const proposal: PolicyPreflightProposal = {
      proposal_id: entry.proposal_id,
      decision: entry.decision,
      reason: entry.reason
    };

    if (entry.decision === 'safe') {
      eligible.push(proposal);
      continue;
    }

    if (entry.decision === 'requires_review') {
      requiresReview.push(proposal);
      continue;
    }

    blocked.push(proposal);
  }

  return {
    schemaVersion: POLICY_PREFLIGHT_SCHEMA_VERSION,
    eligible,
    requires_review: requiresReview,
    blocked,
    summary: {
      eligible: eligible.length,
      requires_review: requiresReview.length,
      blocked: blocked.length,
      total: sortedEntries.length
    }
  };
};
