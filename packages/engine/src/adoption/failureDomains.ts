import type { BootstrapProofCheck, BootstrapProofFailureCategory, BootstrapProofResult } from './bootstrapProof.js';

export type CanonicalFailureDomain =
  | 'contract_validation'
  | 'runtime_execution'
  | 'ci_bootstrap'
  | 'sync_drift'
  | 'governance_planning';

export type FailureDomainBlocker = {
  domain: CanonicalFailureDomain;
  signal: string;
  summary: string;
};

export type FailureDomainNextAction = {
  domain: CanonicalFailureDomain;
  action: string;
};

export type FailureDomainSummary = {
  failureDomains: CanonicalFailureDomain[];
  primaryFailureDomain: CanonicalFailureDomain | null;
  domainBlockers: FailureDomainBlocker[];
  domainNextActions: FailureDomainNextAction[];
};

const DOMAIN_PRIORITY: CanonicalFailureDomain[] = [
  'contract_validation',
  'runtime_execution',
  'ci_bootstrap',
  'sync_drift',
  'governance_planning'
];

const PROOF_CATEGORY_DOMAIN: Record<BootstrapProofFailureCategory, CanonicalFailureDomain> = {
  runtime_unavailable: 'runtime_execution',
  binary_resolution_failed: 'ci_bootstrap',
  repo_not_initialized: 'ci_bootstrap',
  required_docs_missing: 'ci_bootstrap',
  required_artifacts_missing: 'ci_bootstrap',
  execution_state_missing: 'runtime_execution',
  governance_contract_failed: 'governance_planning'
};

const SIGNAL_DOMAIN_RULES: Array<{ domain: CanonicalFailureDomain; pattern: RegExp }> = [
  { domain: 'contract_validation', pattern: /(contract|schema|request|receipt|shape|invalid contract|schema mismatch)/i },
  { domain: 'runtime_execution', pattern: /(runtime|execution|health|node runtime|pnpm runtime|execution-state|stuck|failed execution|interop runtime)/i },
  { domain: 'ci_bootstrap', pattern: /(bootstrap|install|init|binary resolution|tooling|composite action|repo-index missing|required bootstrap doc|docs audit unavailable)/i },
  { domain: 'sync_drift', pattern: /(drift|sync mismatch|guard conflict|diverge|release drift|contract drift|mismatch)/i },
  { domain: 'governance_planning', pattern: /(governance|verify|policy|plan|blocked|docs audit|rule)/i }
];

const dedupe = <T>(items: T[]): T[] => [...new Set(items)];

const pickPrimaryDomain = (domains: CanonicalFailureDomain[]): CanonicalFailureDomain | null =>
  DOMAIN_PRIORITY.find((domain) => domains.includes(domain)) ?? null;

const inferDomainFromText = (text: string): CanonicalFailureDomain | null =>
  SIGNAL_DOMAIN_RULES.find((rule) => rule.pattern.test(text))?.domain ?? null;

const mapProofCheckToDomain = (check: BootstrapProofCheck): CanonicalFailureDomain | null => {
  if (check.category) {
    return PROOF_CATEGORY_DOMAIN[check.category];
  }
  return inferDomainFromText(`${check.id} ${check.summary} ${check.diagnostics.join(' ')}`);
};

export const classifyProofFailureDomains = (
  proof: BootstrapProofResult,
  parallelWork?: { blockers?: string[]; decision?: string; next_action?: string }
): FailureDomainSummary => {
  const failedChecks = proof.diagnostics.checks.filter((check) => check.status === 'fail');
  const blockers: FailureDomainBlocker[] = [];
  const nextActions: FailureDomainNextAction[] = [];

  for (const check of failedChecks) {
    const domain = mapProofCheckToDomain(check);
    if (!domain) continue;
    blockers.push({
      domain,
      signal: check.id,
      summary: check.diagnostics[0] ?? check.summary
    });
    if (check.next_action) {
      nextActions.push({ domain, action: check.next_action });
    }
  }

  const parallelBlockers = parallelWork?.blockers ?? [];
  for (const blocker of parallelBlockers) {
    const domain = inferDomainFromText(blocker);
    if (!domain) continue;
    blockers.push({ domain, signal: 'parallel_work.blockers', summary: blocker });
  }

  if (typeof parallelWork?.decision === 'string' && /guard_conflicted|drift|mismatch/i.test(parallelWork.decision)) {
    blockers.push({ domain: 'sync_drift', signal: 'parallel_work.decision', summary: parallelWork.decision });
    if (parallelWork.next_action) {
      nextActions.push({ domain: 'sync_drift', action: parallelWork.next_action });
    }
  }

  const domains = dedupe(blockers.map((entry) => entry.domain));
  return {
    failureDomains: domains,
    primaryFailureDomain: pickPrimaryDomain(domains),
    domainBlockers: blockers,
    domainNextActions: dedupe(nextActions.map((entry) => `${entry.domain}::${entry.action}`)).map((serialized) => {
      const [domain, action] = serialized.split('::');
      return { domain: domain as CanonicalFailureDomain, action };
    })
  };
};

export const classifySignalFailureDomains = (
  signals: Array<{ signal: string; summary: string; nextAction?: string | null }>
): FailureDomainSummary => {
  const blockers: FailureDomainBlocker[] = [];
  const nextActions: FailureDomainNextAction[] = [];

  for (const signal of signals) {
    const domain = inferDomainFromText(`${signal.signal} ${signal.summary}`);
    if (!domain) continue;
    blockers.push({ domain, signal: signal.signal, summary: signal.summary });
    if (signal.nextAction && signal.nextAction.trim().length > 0) {
      nextActions.push({ domain, action: signal.nextAction });
    }
  }

  const domains = dedupe(blockers.map((entry) => entry.domain));
  return {
    failureDomains: domains,
    primaryFailureDomain: pickPrimaryDomain(domains),
    domainBlockers: blockers,
    domainNextActions: dedupe(nextActions.map((entry) => `${entry.domain}::${entry.action}`)).map((serialized) => {
      const [domain, action] = serialized.split('::');
      return { domain: domain as CanonicalFailureDomain, action };
    })
  };
};
