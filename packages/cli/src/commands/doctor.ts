import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { readConfig } from '../lib/config.js';
import { emitResult, ExitCode } from '../lib/cliContract.js';
import { doctorFixes } from '../lib/doctorFixes.js';

type DoctorOptions = {
  format: 'text' | 'json';
  quiet: boolean;
  fix: boolean;
  dryRun: boolean;
  yes: boolean;
};

export type DoctorReport = {
  ok: boolean;
  exitCode: ExitCode;
  summary: string;
  findings: { id: string; level: 'info' | 'warning' | 'error'; message: string }[];
  nextActions: string[];
};

type DoctorFixApplied = {
  id: string;
  description: string;
  changes: string[];
};

type DoctorFixSkipped = {
  id: string;
  reason: string;
};

type DoctorFixJsonResult = {
  schemaVersion: '1.0';
  command: 'doctor';
  ok: boolean;
  exitCode: ExitCode;
  summary: string;
  applied: DoctorFixApplied[];
  skipped: DoctorFixSkipped[];
  environment: DoctorReport;
};

export const collectDoctorReport = async (cwd: string): Promise<DoctorReport> => {
  const warnings: string[] = [];
  const findings: DoctorReport['findings'] = [];

  try {
    execFileSync('git', ['--version'], { encoding: 'utf8' });
    findings.push({ id: 'doctor.git.installed', level: 'info', message: 'git installed' });
  } catch {
    return {
      ok: false,
      exitCode: ExitCode.EnvironmentPrereq,
      summary: 'Doctor checks failed: git is not installed.',
      findings: [{ id: 'doctor.git.missing', level: 'error', message: 'git is not installed' }],
      nextActions: ['Install git and rerun `playbook doctor --ci`.']
    };
  }

  try {
    execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { cwd, encoding: 'utf8' });
    findings.push({ id: 'doctor.git.repo', level: 'info', message: 'git repository detected' });
  } catch {
    warnings.push('Not inside a git repo.');
    findings.push({ id: 'doctor.git.repo.missing', level: 'warning', message: 'Not inside a git repo.' });
  }

  const { config, warning } = await readConfig(cwd);
  if (warning) {
    warnings.push(warning);
    findings.push({ id: 'doctor.config.warning', level: 'warning', message: warning });
  }

  for (const docPath of Object.values(config.docs) as string[]) {
    const abs = path.join(cwd, docPath);
    if (!fs.existsSync(abs)) {
      const message = `Missing doc path: ${docPath}`;
      warnings.push(message);
      findings.push({ id: `doctor.docs.missing.${docPath.replace(/[^a-zA-Z0-9]+/g, '-')}`, level: 'warning', message });
    }
  }

  if (warnings.length) {
    return {
      ok: true,
      exitCode: ExitCode.WarningsOnly,
      summary: 'Doctor checks completed with warnings.',
      findings,
      nextActions: ['Run `playbook init` and commit governance docs.']
    };
  }

  return {
    ok: true,
    exitCode: ExitCode.Success,
    summary: '✔ configuration and docs look good',
    findings,
    nextActions: []
  };
};

export const runDoctor = async (cwd: string, options: DoctorOptions): Promise<number> => {
  if (!options.fix) {
    const report = await collectDoctorReport(cwd);

    emitResult({
      format: options.format,
      quiet: options.quiet,
      command: 'doctor',
      ok: report.ok,
      exitCode: report.exitCode,
      summary: report.summary,
      findings: report.findings,
      nextActions: report.nextActions
    });

    return report.exitCode;
  }

  const report = await collectDoctorReport(cwd);
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
    const summary = shouldApply
      ? `Doctor --fix completed: ${applied.length} applied, ${skipped.length} skipped.`
      : `Doctor --fix preview: ${plan.length} fix(es) available.`;
    const jsonResult: DoctorFixJsonResult = {
      schemaVersion: '1.0',
      command: 'doctor',
      ok: environment.ok,
      exitCode: environment.exitCode,
      summary,
      applied,
      skipped,
      environment
    };

    console.log(JSON.stringify(jsonResult, null, 2));
    return environment.exitCode;
  }

  if (!(options.quiet && environment.ok && applied.length === 0 && skipped.length === 0)) {
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
  }

  emitResult({
    format: options.format,
    quiet: options.quiet,
    command: 'doctor',
    ok: environment.ok,
    exitCode: environment.exitCode,
    summary: environment.summary,
    findings: environment.findings,
    nextActions: environment.nextActions
  });

  return environment.exitCode;
};
