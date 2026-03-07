import { runArchitectureAudit } from '@zachariahredfield/playbook-core';
import { ExitCode } from '../lib/cliContract.js';

type AuditArchitectureOptions = {
  format: 'text' | 'json';
  quiet: boolean;
};

const printUsage = (): void => {
  console.log('Usage: playbook audit architecture [--json]');
};

const printHumanReport = (report: ReturnType<typeof runArchitectureAudit>): void => {
  console.log(`playbook audit architecture: ${report.summary.status.toUpperCase()}`);
  console.log(
    `Checks: ${report.summary.checks} (pass: ${report.summary.pass}, warn: ${report.summary.warn}, fail: ${report.summary.fail})`
  );

  const grouped = new Map<typeof report.audits[number]['status'], typeof report.audits>([
    ['fail', []],
    ['warn', []],
    ['pass', []]
  ]);

  for (const audit of report.audits) {
    const entries = grouped.get(audit.status);
    if (entries) {
      entries.push(audit);
    }
  }

  const sections: Array<{ label: string; status: 'fail' | 'warn' | 'pass' }> = [
    { label: 'Failures', status: 'fail' },
    { label: 'Warnings', status: 'warn' },
    { label: 'Passing checks', status: 'pass' }
  ];

  for (const section of sections) {
    const items = grouped.get(section.status) ?? [];
    if (items.length === 0) {
      continue;
    }

    console.log('');
    console.log(`${section.label}:`);
    for (const item of items) {
      console.log(`- [${item.id}] ${item.title} (${item.severity})`);
      for (const evidenceLine of item.evidence) {
        console.log(`  evidence: ${evidenceLine}`);
      }
      console.log(`  recommendation: ${item.recommendation}`);
    }
  }

  if (report.nextActions.length > 0) {
    console.log('');
    console.log('Next actions:');
    for (const action of report.nextActions) {
      console.log(`- ${action}`);
    }
  }
};

export const runAuditArchitecture = async (cwd: string, commandArgs: string[], options: AuditArchitectureOptions): Promise<number> => {
  const subcommand = commandArgs.find((arg) => !arg.startsWith('-'));

  if (subcommand !== 'architecture') {
    if (!options.quiet) {
      printUsage();
    }
    return ExitCode.Failure;
  }

  const report = runArchitectureAudit(cwd);

  if (options.format === 'json') {
    console.log(JSON.stringify(report, null, 2));
  } else if (!options.quiet) {
    printHumanReport(report);
  }

  return report.summary.fail > 0 ? ExitCode.Failure : ExitCode.Success;
};
