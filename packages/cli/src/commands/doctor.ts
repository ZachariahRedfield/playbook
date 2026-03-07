import { loadAiContract, SUPPORTED_QUERY_FIELDS, generateRepositoryHealth } from '@zachariahredfield/playbook-engine';
import fs from 'node:fs';
import path from 'node:path';
import { ExitCode } from '../lib/cliContract.js';
import { hasRegisteredCommand } from './index.js';
import { runSchema } from './schema.js';
import { doctorFixes } from '../lib/doctorFixes.js';
import { loadVerifyRules } from '../lib/loadVerifyRules.js';

type DoctorOptions = {
  format: 'text' | 'json';
  quiet: boolean;
  fix: boolean;
  dryRun: boolean;
  yes: boolean;
  ai: boolean;
};

export type DoctorReport = ReturnType<typeof generateRepositoryHealth>;

type DoctorFixApplied = {
  id: string;
  description: string;
  changes: string[];
};

type DoctorFixSkipped = {
  id: string;
  reason: string;
};

type AiDoctorCheck = {
  name:
    | 'schema'
    | 'context'
    | 'repoIndex'
    | 'verifyRules'
    | 'aiContractAvailability'
    | 'aiContractValidity'
    | 'intelligenceSources'
    | 'querySurface'
    | 'commandSurface'
    | 'remediationWorkflow';
  status: 'pass' | 'warn' | 'fail';
  message: string;
  source?: ReturnType<typeof loadAiContract>['source'];
  details?: Array<{ path: string; status: 'present' | 'missing'; required: boolean }>;
  missingCommands?: string[];
  missingQueries?: string[];
  reason?: string;
};

const AI_CONTRACT_FILE = '.playbook/ai-contract.json';
const OPTIONAL_AI_INTELLIGENCE_SOURCES = new Set(['moduleOwners']);
const REQUIRED_AI_SURFACE_COMMANDS = ['index', 'query', 'plan', 'apply', 'verify', 'ai-contract'] as const;
const SUPPORTED_AI_CONTRACT_QUERIES = new Set([
  ...SUPPORTED_QUERY_FIELDS,
  'dependencies',
  'impact',
  'risk',
  'docs-coverage',
  'rule-owners',
  'module-owners'
]);

const hasMissingCommands = (commands: readonly string[]): string[] =>
  commands.filter((command) => !hasRegisteredCommand(command));

type LoadedAiContract = ReturnType<typeof loadAiContract>;
type AiDoctorContract = LoadedAiContract['contract'];

const getIntelligenceSourceChecks = (cwd: string, contract: AiDoctorContract): AiDoctorCheck => {
  const sourceDetails = Object.entries(contract.intelligence_sources as Record<string, string>).map(([sourceName, sourcePath]) => {
    const required = !OPTIONAL_AI_INTELLIGENCE_SOURCES.has(sourceName);
    const resolvedPath = path.join(cwd, sourcePath);
    const present = fs.existsSync(resolvedPath);

    return {
      path: sourcePath,
      status: present ? ('present' as const) : ('missing' as const),
      required
    };
  });

  const missingRequired = sourceDetails.some((detail) => detail.required && detail.status === 'missing');
  const missingOptional = sourceDetails.some((detail) => !detail.required && detail.status === 'missing');

  return {
    name: 'intelligenceSources',
    status: missingRequired ? 'fail' : missingOptional ? 'warn' : 'pass',
    message: missingRequired
      ? 'Required repository intelligence source missing'
      : missingOptional
        ? 'Optional repository intelligence source missing'
        : 'Repository intelligence sources available',
    details: sourceDetails
  };
};

const getQuerySurfaceCheck = (contract: AiDoctorContract): AiDoctorCheck => {
  const missingQueries = contract.queries.filter((query: string) => !SUPPORTED_AI_CONTRACT_QUERIES.has(query));

  return {
    name: 'querySurface',
    status: missingQueries.length === 0 ? 'pass' : 'fail',
    message: missingQueries.length === 0 ? 'Required query surface available' : 'Required query surface unavailable',
    missingQueries
  };
};

const getCommandSurfaceCheck = (): AiDoctorCheck => {
  const missingCommands = hasMissingCommands(REQUIRED_AI_SURFACE_COMMANDS);

  return {
    name: 'commandSurface',
    status: missingCommands.length === 0 ? 'pass' : 'fail',
    message: missingCommands.length === 0 ? 'Required command surface available' : 'Required command surface unavailable',
    missingCommands
  };
};

const getRemediationWorkflowCheck = (contract: AiDoctorContract): AiDoctorCheck => {
  const requiredFlow = contract.remediation.canonicalFlow;
  const missingCommands = hasMissingCommands(requiredFlow);

  return {
    name: 'remediationWorkflow',
    status: missingCommands.length === 0 ? 'pass' : 'fail',
    message: missingCommands.length === 0 ? 'Remediation workflow ready' : 'Remediation workflow unavailable',
    missingCommands
  };
};

const toExitCode = (): ExitCode => ExitCode.Success;

export const collectDoctorReport = async (cwd: string): Promise<DoctorReport> => generateRepositoryHealth(cwd);

const printHealthReport = (report: DoctorReport, safeFixCount: number): void => {
  const statusIcon = (ok: boolean): string => (ok ? '✔' : '⚠');

  console.log('Repository Health');
  console.log('─────────────────');
  console.log('');
  console.log(`Framework: ${report.framework}`);
  console.log(`Language: ${report.language}`);
  console.log(`Architecture: ${report.architecture}`);
  console.log('');
  console.log('Governance');
  console.log('──────────');
  console.log('');

  for (const item of report.governanceStatus) {
    console.log(`${statusIcon(item.ok)} ${item.message}`);
  }

  console.log('');
  console.log('Playbook Artifact Hygiene');
  console.log('─────────────────────────');
  console.log('');

  if (report.artifactHygiene.findings.length === 0) {
    console.log('✔ No artifact hygiene issues detected');
  } else {
    for (const finding of report.artifactHygiene.findings) {
      const scope = finding.path ? `: ${finding.path}` : '';
      console.log(`⚠ ${finding.type}${scope}`);
      console.log(`  Recommendation: ${finding.recommendation}`);
    }

    if (report.artifactHygiene.suggestions.length > 0) {
      console.log('');
      console.log('Suggested fixes:');
      for (const suggestion of report.artifactHygiene.suggestions) {
        console.log(`- ${suggestion.id} ${suggestion.title}`);
        if (suggestion.entries && suggestion.entries.length > 0) {
          console.log('  Suggested entries:');
          for (const entry of suggestion.entries) {
            console.log(`  - ${entry}`);
          }
        }
      }
    }
  }

  console.log('');
  console.log('Automation');
  console.log('──────────');
  console.log('');
  console.log(`${safeFixCount} safe fixes available`);

  if (report.suggestedActions.length > 0) {
    console.log('');
    console.log('Run:');
    for (const action of report.suggestedActions) {
      console.log(action);
    }
  }
};

const printJsonReport = (report: DoctorReport): void => {
  console.log(
    JSON.stringify(
      {
        command: 'doctor',
        framework: report.framework,
        architecture: report.architecture,
        issues: report.issues,
        suggestedActions: report.suggestedActions,
        artifactHygiene: report.artifactHygiene
      },
      null,
      2
    )
  );
};

const getSafeFixCount = async (cwd: string, dryRun: boolean): Promise<number> => {
  let count = 0;

  for (const fix of doctorFixes) {
    const result = await fix.check({ cwd, dryRun });
    if (result.applicable && fix.safeToAutoApply) {
      count += 1;
    }
  }

  return count;
};

const runAiChecks = async (cwd: string): Promise<AiDoctorCheck[]> => {
  const checks: AiDoctorCheck[] = [];

  const schemaExitCode = await runSchema(cwd, [], { format: 'text', quiet: true });
  checks.push({
    name: 'schema',
    status: schemaExitCode === ExitCode.Success ? 'pass' : 'fail',
    message: 'Playbook schema available'
  });

  checks.push({
    name: 'context',
    status: hasRegisteredCommand('context') ? 'pass' : 'fail',
    message: 'Playbook context command available'
  });

  const repoIndexPath = path.join(cwd, '.playbook', 'repo-index.json');
  checks.push({
    name: 'repoIndex',
    status: fs.existsSync(repoIndexPath) ? 'pass' : 'warn',
    message: fs.existsSync(repoIndexPath) ? 'Repository intelligence generated' : 'Repository intelligence not generated'
  });

  const verifyRules = await loadVerifyRules(cwd);
  checks.push({
    name: 'verifyRules',
    status: verifyRules.length > 0 ? 'pass' : 'fail',
    message: verifyRules.length > 0 ? 'Verify rules loaded' : 'Verify rules unavailable'
  });

  const hasFileBackedContract = fs.existsSync(path.join(cwd, AI_CONTRACT_FILE));

  try {
    const loadedContract = loadAiContract(cwd);

    checks.push({
      name: 'aiContractAvailability',
      status: hasFileBackedContract ? 'pass' : 'warn',
      message: hasFileBackedContract
        ? 'AI contract available (source: file)'
        : 'AI contract available (source: generated)',
      source: loadedContract.source
    });

    checks.push({
      name: 'aiContractValidity',
      status: 'pass',
      message: 'AI contract valid'
    });

    checks.push(getIntelligenceSourceChecks(cwd, loadedContract.contract));
    checks.push(getCommandSurfaceCheck());
    checks.push(getQuerySurfaceCheck(loadedContract.contract));
    checks.push(getRemediationWorkflowCheck(loadedContract.contract));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    checks.push({
      name: 'aiContractAvailability',
      status: 'fail',
      message: 'AI contract unavailable',
      reason
    });
    checks.push({
      name: 'aiContractValidity',
      status: 'fail',
      message: 'AI contract invalid',
      reason
    });
    checks.push({
      name: 'intelligenceSources',
      status: 'warn',
      message: 'Skipped intelligence source checks (AI contract unavailable)'
    });
    checks.push(getCommandSurfaceCheck());
    checks.push({
      name: 'querySurface',
      status: 'warn',
      message: 'Skipped query surface checks (AI contract unavailable)'
    });
    checks.push({
      name: 'remediationWorkflow',
      status: 'warn',
      message: 'Skipped remediation workflow checks (AI contract unavailable)'
    });
  }

  return checks;
};

const printAiTextReport = (checks: AiDoctorCheck[]): void => {
  const iconByStatus = {
    pass: '✓',
    warn: '⚠',
    fail: '✗'
  } as const;

  console.log('AI Environment Check');
  console.log('────────────────────');
  console.log('');

  console.log('Core AI Checks');
  console.log('──────────────');
  console.log('');

  for (const check of checks.filter((entry) => ['schema', 'context', 'repoIndex', 'verifyRules'].includes(entry.name))) {
    console.log(`${iconByStatus[check.status]} ${check.message}`);
  }

  console.log('');
  console.log('AI Contract Readiness');
  console.log('─────────────────────');
  console.log('');

  for (const check of checks.filter((entry) => !['schema', 'context', 'repoIndex', 'verifyRules'].includes(entry.name))) {
    console.log(`${iconByStatus[check.status]} ${check.message}`);
    if (check.reason) {
      console.log(`  ${check.reason}`);
    }
    if (check.details) {
      for (const detail of check.details) {
        if (detail.status === 'missing') {
          console.log(`  ${detail.required ? 'required' : 'optional'} missing: ${detail.path}`);
        }
      }
    }
    if (check.missingQueries && check.missingQueries.length > 0) {
      console.log(`  missing queries: ${check.missingQueries.join(', ')}`);
    }
    if (check.missingCommands && check.missingCommands.length > 0) {
      console.log(`  missing commands: ${check.missingCommands.join(', ')}`);
    }
  }

  if (checks.some((check) => check.name === 'repoIndex' && check.status === 'warn')) {
    console.log('');
    console.log('Suggested action:');
    console.log('Run `playbook index` to generate repository intelligence.');
  }

  console.log('');
  console.log('Result');
  if (checks.some((check) => check.status === 'fail')) {
    console.log('Playbook repository is not AI-contract ready.');
  } else {
    console.log('Playbook repository is AI-contract ready.');
  }
};

export const runDoctor = async (cwd: string, options: DoctorOptions): Promise<number> => {
  if (options.ai) {
    const checks = await runAiChecks(cwd);

    if (options.format === 'json') {
      console.log(
        JSON.stringify(
          {
            schemaVersion: '1.0',
            command: 'doctor',
            mode: 'ai',
            checks: checks.map((check) => {
              const payload: Record<string, unknown> = { name: check.name, status: check.status };
              if (check.source) {
                payload.source = check.source;
              }
              if (check.details) {
                payload.details = check.details;
              }
              if (check.missingQueries && check.missingQueries.length > 0) {
                payload.missingQueries = check.missingQueries;
              }
              if (check.missingCommands && check.missingCommands.length > 0) {
                payload.missingCommands = check.missingCommands;
              }
              if (check.reason) {
                payload.reason = check.reason;
              }
              return payload;
            })
          },
          null,
          2
        )
      );
      return toExitCode();
    }

    if (!options.quiet) {
      printAiTextReport(checks);
    }

    return toExitCode();
  }

  const report = await collectDoctorReport(cwd);

  if (!options.fix) {
    if (options.format === 'json') {
      printJsonReport(report);
    } else if (!(options.quiet && report.issues.length === 0 && report.verifySummary.failures === 0)) {
      const safeFixCount = await getSafeFixCount(cwd, options.dryRun);
      printHealthReport(report, safeFixCount);
    }

    return toExitCode();
  }

  const plan: Array<{ id: string; description: string; safeToAutoApply: boolean }> = [];

  for (const fix of doctorFixes) {
    const result = await fix.check({ cwd, dryRun: options.dryRun });
    if (result.applicable) {
      plan.push({ id: fix.id, description: fix.description, safeToAutoApply: fix.safeToAutoApply });
    }
  }

  const shouldApply = !options.dryRun && options.yes;
  const applied: DoctorFixApplied[] = [];
  const skipped: DoctorFixSkipped[] = [];

  for (const entry of plan) {
    const fix = doctorFixes.find((candidate) => candidate.id === entry.id);
    if (!fix) {
      skipped.push({ id: entry.id, reason: 'Fix handler not found.' });
      continue;
    }

    if (!entry.safeToAutoApply) {
      skipped.push({ id: entry.id, reason: 'Fix is not marked safe for auto-apply.' });
      continue;
    }

    if (!shouldApply) {
      skipped.push({
        id: entry.id,
        reason: options.dryRun ? 'Dry-run mode: fix preview only.' : 'Use --yes to apply fixes.'
      });
      continue;
    }

    const result = await fix.fix({ cwd, dryRun: options.dryRun });
    applied.push({ id: fix.id, description: fix.description, changes: result.changes });
  }

  const environment = shouldApply ? await collectDoctorReport(cwd) : report;

  if (options.format === 'json') {
    console.log(
      JSON.stringify(
        {
          schemaVersion: '1.0',
          command: 'doctor',
          summary: shouldApply
            ? `Doctor --fix completed: ${applied.length} applied, ${skipped.length} skipped.`
            : `Doctor --fix preview: ${plan.length} fix(es) available.`,
          applied,
          skipped,
          environment
        },
        null,
        2
      )
    );
    return toExitCode();
  }

  console.log('Doctor fix plan:');
  if (plan.length === 0) {
    console.log('  (no safe deterministic fixes available)');
  } else {
    for (const entry of plan) {
      console.log(`  - ${entry.id}: ${entry.description}`);
    }
  }

  console.log(options.dryRun ? 'Planned changes:' : 'Applied fixes:');
  if (applied.length === 0) {
    console.log('  (none)');
  } else {
    for (const entry of applied) {
      console.log(`  - ${entry.id}: ${entry.description}`);
      for (const change of entry.changes) {
        console.log(`    ${change}`);
      }
    }
  }

  console.log('Skipped fixes:');
  if (skipped.length === 0) {
    console.log('  (none)');
  } else {
    for (const entry of skipped) {
      console.log(`  - ${entry.id}: ${entry.reason}`);
    }
  }

  return toExitCode();
};
