import { runDocsAudit, runDocsConsolidation } from '@zachariahredfield/playbook-engine';
import { ExitCode } from '../lib/cliContract.js';

type DocsOptions = {
  ci: boolean;
  format: 'text' | 'json';
  quiet: boolean;
};

const printTextUsage = (): void => {
  console.log('Usage: playbook docs <audit|consolidate> [--json] [--ci]');
};


const printConsolidationReport = (result: ReturnType<typeof runDocsConsolidation>): void => {
  console.log('playbook docs consolidate: OK');
  console.log(`Artifact: ${result.artifactPath}`);
  console.log(`Fragments: ${result.artifact.summary.fragmentCount} (issues: ${result.artifact.summary.issueCount})`);
  console.log('');
  console.log(result.artifact.brief);
};

const printHumanReport = (result: ReturnType<typeof runDocsAudit>): void => {
  console.log(`playbook docs audit: ${result.status.toUpperCase()}`);
  console.log(`Findings: ${result.findings.length} (errors: ${result.summary.errors}, warnings: ${result.summary.warnings})`);

  const grouped = new Map<string, typeof result.findings>();
  for (const finding of result.findings) {
    const entries = grouped.get(finding.ruleId) ?? [];
    entries.push(finding);
    grouped.set(finding.ruleId, entries);
  }

  for (const [ruleId, findings] of grouped.entries()) {
    console.log('');
    console.log(`Rule: ${ruleId}`);
    for (const finding of findings) {
      console.log(`- [${finding.level}] ${finding.message}`);
      console.log(`  path: ${finding.path}`);
      if (finding.suggestedDestination) {
        console.log(`  suggestedDestination: ${finding.suggestedDestination}`);
      }
      if (finding.recommendation) {
        console.log(`  recommendation: ${finding.recommendation}`);
      }
    }
  }
};

export const runDocs = async (cwd: string, commandArgs: string[], options: DocsOptions): Promise<number> => {
  const subcommand = commandArgs.find((arg) => !arg.startsWith('-'));

  if (subcommand === 'consolidate') {
    const result = runDocsConsolidation(cwd);
    const payload = {
      schemaVersion: '1.0',
      command: 'docs consolidate',
      ok: result.ok,
      artifactPath: result.artifactPath,
      artifact: result.artifact
    };

    if (options.format === 'json') {
      console.log(JSON.stringify(payload, null, 2));
    } else if (!(options.quiet && result.ok)) {
      printConsolidationReport(result);
    }

    return ExitCode.Success;
  }

  if (subcommand !== 'audit') {
    if (!options.quiet) {
      printTextUsage();
    }
    return ExitCode.Failure;
  }

  const result = runDocsAudit(cwd);
  const payload = {
    schemaVersion: '1.0',
    command: 'docs audit',
    ...result
  };

  if (options.format === 'json') {
    console.log(JSON.stringify(payload, null, 2));
  } else if (!(options.quiet && result.ok)) {
    printHumanReport(result);
  }

  if (options.ci && result.summary.errors > 0) {
    return ExitCode.PolicyFailure;
  }

  return result.summary.errors > 0 ? ExitCode.Failure : ExitCode.Success;
};
