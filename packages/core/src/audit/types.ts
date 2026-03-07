export type ArchitectureAuditStatus = 'pass' | 'warn' | 'fail';
export type ArchitectureAuditSeverity = 'low' | 'medium' | 'high';

export type ArchitectureAuditResult = {
  id: string;
  title: string;
  status: ArchitectureAuditStatus;
  severity: ArchitectureAuditSeverity;
  evidence: string[];
  recommendation: string;
};

export type ArchitectureAuditSummaryStatus = 'pass' | 'warn' | 'fail';

export type ArchitectureAuditSummary = {
  status: ArchitectureAuditSummaryStatus;
  checks: number;
  pass: number;
  warn: number;
  fail: number;
};

export type ArchitectureAuditReport = {
  schemaVersion: '1.0';
  command: 'audit-architecture';
  ok: boolean;
  summary: ArchitectureAuditSummary;
  audits: ArchitectureAuditResult[];
  nextActions: string[];
};

export type ArchitectureAuditCheckContext = {
  repoRoot: string;
};

export type ArchitectureAuditCheck = {
  id: string;
  title: string;
  run: (context: ArchitectureAuditCheckContext) => ArchitectureAuditResult;
};
