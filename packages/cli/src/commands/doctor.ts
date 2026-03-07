import { queryRepositoryIndex, queryRisk, runDocsAudit, type RepositoryModule } from '@zachariahredfield/playbook-engine';
import fs from 'node:fs';
import path from 'node:path';
import { ExitCode } from '../lib/cliContract.js';
import { collectVerifyReport } from './verify.js';

type DoctorOptions = {
  format: 'text' | 'json';
  quiet: boolean;
};

export type DoctorFinding = {
  category: 'Architecture' | 'Docs' | 'Testing' | 'Risk';
  severity: 'error' | 'warning' | 'info';
  id: string;
  message: string;
};

export type DoctorReport = {
  schemaVersion: '1.0';
  command: 'doctor';
  status: 'ok' | 'warning' | 'error';
  summary: {
    errors: number;
    warnings: number;
    info: number;
  };
  findings: DoctorFinding[];
};

const severityRank: Record<DoctorFinding['severity'], number> = {
  error: 0,
  warning: 1,
  info: 2
};

const toReportStatus = (summary: DoctorReport['summary']): DoctorReport['status'] => {
  if (summary.errors > 0) {
    return 'error';
  }

  if (summary.warnings > 0) {
    return 'warning';
  }

  return 'ok';
};

const summarizeFindings = (findings: DoctorFinding[]): DoctorReport['summary'] => ({
  errors: findings.filter((finding) => finding.severity === 'error').length,
  warnings: findings.filter((finding) => finding.severity === 'warning').length,
  info: findings.filter((finding) => finding.severity === 'info').length
});

const compareFindings = (left: DoctorFinding, right: DoctorFinding): number => {
  const severityDiff = severityRank[left.severity] - severityRank[right.severity];
  if (severityDiff !== 0) {
    return severityDiff;
  }

  const categoryDiff = left.category.localeCompare(right.category);
  if (categoryDiff !== 0) {
    return categoryDiff;
  }

  const idDiff = left.id.localeCompare(right.id);
  if (idDiff !== 0) {
    return idDiff;
  }

  return left.message.localeCompare(right.message);
};

const getRiskSeverity = (riskLevel: 'high' | 'medium' | 'low'): DoctorFinding['severity'] => {
  if (riskLevel === 'high') {
    return 'error';
  }

  if (riskLevel === 'medium') {
    return 'warning';
  }

  return 'info';
};

export const collectDoctorReport = async (cwd: string): Promise<DoctorReport> => {
  const findings: DoctorFinding[] = [];
  const repoIndexPath = path.join(cwd, '.playbook', 'repo-index.json');
  const hasRepoIndex = fs.existsSync(repoIndexPath);

  if (hasRepoIndex) {
    findings.push({
      category: 'Architecture',
      severity: 'info',
      id: 'doctor.architecture.repo-index.present',
      message: 'Repository intelligence index is present.'
    });
  } else {
    findings.push({
      category: 'Architecture',
      severity: 'warning',
      id: 'doctor.architecture.repo-index.missing',
      message: 'Repository intelligence index is missing. Run `playbook index`.'
    });
  }

  const verifyReport = await collectVerifyReport(cwd);
  for (const failure of verifyReport.failures) {
    findings.push({
      category: 'Testing',
      severity: 'error',
      id: `doctor.testing.verify.failure.${failure.id}`,
      message: failure.message
    });
  }

  for (const warning of verifyReport.warnings) {
    findings.push({
      category: 'Testing',
      severity: 'warning',
      id: `doctor.testing.verify.warning.${warning.id}`,
      message: warning.message
    });
  }

  if (verifyReport.failures.length === 0 && verifyReport.warnings.length === 0) {
    findings.push({
      category: 'Testing',
      severity: 'info',
      id: 'doctor.testing.verify.clean',
      message: 'No verify findings detected.'
    });
  }

  const docsReport = runDocsAudit(cwd);
  for (const finding of docsReport.findings) {
    findings.push({
      category: 'Docs',
      severity: finding.level === 'error' ? 'error' : 'warning',
      id: `doctor.docs.${finding.ruleId}`,
      message: `${finding.message} (${finding.path})`
    });
  }

  if (docsReport.findings.length === 0) {
    findings.push({
      category: 'Docs',
      severity: 'info',
      id: 'doctor.docs.audit.clean',
      message: 'Documentation audit has no findings.'
    });
  }

  if (!hasRepoIndex) {
    findings.push({
      category: 'Risk',
      severity: 'warning',
      id: 'doctor.risk.skipped.repo-index-missing',
      message: 'Risk analysis skipped because repository index is missing.'
    });
  } else {
    try {
      const modulesResult = queryRepositoryIndex(cwd, 'modules');
      const modules = (modulesResult.result as RepositoryModule[])
        .map((moduleEntry) => moduleEntry.name)
        .sort((left, right) => left.localeCompare(right));

      if (modules.length === 0) {
        findings.push({
          category: 'Risk',
          severity: 'info',
          id: 'doctor.risk.no-modules',
          message: 'No modules available for risk analysis.'
        });
      }

      for (const moduleName of modules) {
        const riskResult = queryRisk(cwd, moduleName);
        findings.push({
          category: 'Risk',
          severity: getRiskSeverity(riskResult.riskLevel),
          id: `doctor.risk.module.${moduleName}`,
          message: `${moduleName} risk is ${riskResult.riskLevel} (${riskResult.riskScore.toFixed(2)}).`
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      findings.push({
        category: 'Risk',
        severity: 'warning',
        id: 'doctor.risk.analysis.failed',
        message: `Risk analysis could not complete: ${message}`
      });
    }
  }

  const orderedFindings = [...findings].sort(compareFindings);
  const summary = summarizeFindings(orderedFindings);

  return {
    schemaVersion: '1.0',
    command: 'doctor',
    status: toReportStatus(summary),
    summary,
    findings: orderedFindings
  };
};

const printCategory = (title: DoctorFinding['category'], findings: DoctorFinding[]): void => {
  console.log(title);

  const categoryFindings = findings.filter((finding) => finding.category === title);
  if (categoryFindings.length === 0) {
    console.log('  - [info] no findings');
    console.log('');
    return;
  }

  for (const finding of categoryFindings) {
    console.log(`  - [${finding.severity}] ${finding.message}`);
  }
  console.log('');
};

const printHumanReport = (report: DoctorReport): void => {
  console.log('Playbook Repository Diagnosis');
  console.log('');

  printCategory('Architecture', report.findings);
  printCategory('Docs', report.findings);
  printCategory('Testing', report.findings);
  printCategory('Risk', report.findings);

  console.log(`Status: ${report.status.toUpperCase()}`);
  console.log(`Summary: errors=${report.summary.errors}, warnings=${report.summary.warnings}, info=${report.summary.info}`);
};

export const runDoctor = async (cwd: string, options: DoctorOptions): Promise<number> => {
  const report = await collectDoctorReport(cwd);

  if (options.format === 'json') {
    console.log(JSON.stringify(report, null, 2));
    return report.status === 'error' ? ExitCode.Failure : ExitCode.Success;
  }

  if (!(options.quiet && report.status === 'ok')) {
    printHumanReport(report);
  }

  return report.status === 'error' ? ExitCode.Failure : ExitCode.Success;
};
