import { architectureAuditChecks } from './checks/architectureChecks.js';
import type { ArchitectureAuditReport, ArchitectureAuditResult, ArchitectureAuditSummaryStatus } from './types.js';

const sortResults = (results: ArchitectureAuditResult[]): ArchitectureAuditResult[] =>
  [...results].sort((left, right) => left.id.localeCompare(right.id));

const summarizeStatus = (warnCount: number, failCount: number): ArchitectureAuditSummaryStatus => {
  if (failCount > 0) {
    return 'fail';
  }
  return warnCount > 0 ? 'warn' : 'pass';
};

const buildNextActions = (results: ArchitectureAuditResult[]): string[] => {
  const actions = results
    .filter((result) => result.status !== 'pass')
    .map((result) => `${result.id}: ${result.recommendation}`);

  return actions.length > 0 ? actions : ['No action required. Architecture guardrails satisfy deterministic checks.'];
};

export const runArchitectureAudit = (repoRoot: string): ArchitectureAuditReport => {
  const audits = sortResults(architectureAuditChecks.map((check) => check.run({ repoRoot })));
  const pass = audits.filter((result) => result.status === 'pass').length;
  const warn = audits.filter((result) => result.status === 'warn').length;
  const fail = audits.filter((result) => result.status === 'fail').length;

  return {
    schemaVersion: '1.0',
    command: 'audit-architecture',
    ok: fail === 0,
    summary: {
      status: summarizeStatus(warn, fail),
      checks: audits.length,
      pass,
      warn,
      fail
    },
    audits,
    nextActions: buildNextActions(audits)
  };
};
