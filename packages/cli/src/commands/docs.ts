import { runDocsAudit, runDocsConsolidation, runDocsConsolidationPlan } from '@zachariahredfield/playbook-engine';
import { ExitCode } from '../lib/cliContract.js';
import { renderBriefOutput } from '../lib/briefOutput.js';

type DocsOptions = {
  ci: boolean;
  format: 'text' | 'json';
  quiet: boolean;
};

const printTextUsage = (): void => {
  console.log('Usage: playbook docs <audit|consolidate|consolidate-plan> [--json] [--ci]');
};



const printConsolidationPlanReport = (result: ReturnType<typeof runDocsConsolidationPlan>): void => {
  console.log(renderBriefOutput({
    title: 'Docs consolidation plan',
    decision: result.ok ? 'ready_to_apply' : 'review_required',
    status: result.ok ? 'conflict-free managed write plan prepared' : 'plan excludes ambiguous or blocked targets',
    why: result.ok
      ? `${result.artifact.summary.executable_targets} executable target(s) are ready for reviewed apply.`
      : `${result.artifact.summary.excluded_targets} target(s) still need manual review or clearer anchors.`,
    affectedSurfaces: [
      `.playbook/docs-consolidation-plan.json`,
      `${result.artifact.summary.executable_targets} executable target(s)`,
      `${result.artifact.summary.excluded_targets} excluded target(s)`
    ],
    blockers: result.ok ? [] : ['Excluded targets remain in the reviewed-write plan and need manual follow-up.'],
    nextAction: result.ok
      ? 'Run pnpm playbook apply --from-plan .playbook/docs-consolidation-plan.json'
      : 'Inspect .playbook/docs-consolidation-plan.json exclusions and resolve missing anchors/conflicts before apply.',
    artifactRefs: [result.artifactPath]
  }));
};

const printConsolidationReport = (result: ReturnType<typeof runDocsConsolidation>): void => {
  type ConsolidatedTarget = ReturnType<typeof runDocsConsolidation>['artifact']['consolidatedTargets'][number];
  type ConsolidationIssue = ReturnType<typeof runDocsConsolidation>['artifact']['issues'][number];
  console.log(renderBriefOutput({
    title: 'Docs consolidation',
    decision: result.ok ? 'review_ready' : 'review_blocked',
    status: `${result.artifact.summary.fragmentCount} fragment(s), ${result.artifact.summary.consolidatedTargetCount} target seam(s)`,
    why: result.ok
      ? 'Worker fragments were consolidated into protected singleton seams without conflicts.'
      : `${result.artifact.summary.issueCount} blocking issue(s) prevent clean consolidation planning.`,
    affectedSurfaces: [
      ...result.artifact.consolidatedTargets.slice(0, 3).map((target: ConsolidatedTarget) => `${target.targetDoc} (${target.fragmentCount} fragment${target.fragmentCount === 1 ? '' : 's'})`),
      result.artifact.protectedSurfaceRegistry.path
    ],
    blockers: result.artifact.issues.slice(0, 3).map((issue: ConsolidationIssue) => `${issue.type}: ${issue.conflictKey}`),
    nextAction: result.ok
      ? 'Review .playbook/docs-consolidation.json, then run pnpm playbook docs consolidate-plan --json.'
      : 'Resolve duplicate/conflicting fragment targets in .playbook/docs-consolidation.json before planning apply.',
    artifactRefs: [result.artifactPath],
    extraSections: [{
      label: 'Lead-agent integration brief',
      items: result.artifact.brief.split('\n').filter(Boolean).slice(1, 5)
    }]
  }));
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

  if (subcommand === 'consolidate-plan') {
    const result = runDocsConsolidationPlan(cwd);
    const payload = {
      schemaVersion: '1.0',
      command: 'docs consolidate-plan',
      ok: result.ok,
      artifactPath: result.artifactPath,
      artifact: result.artifact
    };

    if (options.format === 'json') {
      console.log(JSON.stringify(payload, null, 2));
    } else if (!(options.quiet && result.ok)) {
      printConsolidationPlanReport(result);
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
