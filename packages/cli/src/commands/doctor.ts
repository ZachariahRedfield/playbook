import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { readConfig } from '../lib/config.js';
import { emitResult, ExitCode } from '../lib/cliContract.js';

type DoctorOptions = {
  format: 'text' | 'json';
  quiet: boolean;
};

export type DoctorReport = {
  ok: boolean;
  exitCode: ExitCode;
  summary: string;
  findings: { id: string; level: 'info' | 'warning' | 'error'; message: string }[];
  nextActions: string[];
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
};
