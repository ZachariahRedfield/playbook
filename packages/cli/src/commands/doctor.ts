import { generateRepositoryHealth } from '@zachariahredfield/playbook-engine';
import { ExitCode } from '../lib/cliContract.js';
import { doctorFixes } from '../lib/doctorFixes.js';

type DoctorOptions = {
  format: 'text' | 'json';
  quiet: boolean;
  fix: boolean;
  dryRun: boolean;
  yes: boolean;
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
        suggestedActions: report.suggestedActions
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

export const runDoctor = async (cwd: string, options: DoctorOptions): Promise<number> => {
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
