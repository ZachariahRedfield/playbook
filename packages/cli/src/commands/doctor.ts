import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { readConfig } from '../lib/config.js';
import { emitResult, ExitCode } from '../lib/cliContract.js';

type DoctorOptions = {
  format: 'text' | 'json';
  quiet: boolean;
};

export const runDoctor = async (cwd: string, options: DoctorOptions): Promise<number> => {
  const warnings: string[] = [];
  const findings: { id: string; level: 'info' | 'warning' | 'error'; message: string }[] = [];

  try {
    execFileSync('git', ['--version'], { encoding: 'utf8' });
    findings.push({ id: 'doctor.git.installed', level: 'info', message: 'git installed' });
  } catch {
    emitResult({
      format: options.format,
      quiet: options.quiet,
      command: 'doctor',
      ok: false,
      exitCode: ExitCode.EnvironmentPrereq,
      summary: 'Doctor checks failed: git is not installed.',
      findings: [{ id: 'doctor.git.missing', level: 'error', message: 'git is not installed' }],
      nextActions: ['Install git and rerun `playbook doctor --ci`.']
    });
    return ExitCode.EnvironmentPrereq;
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
    emitResult({
      format: options.format,
      quiet: options.quiet,
      command: 'doctor',
      ok: true,
      exitCode: ExitCode.WarningsOnly,
      summary: 'Doctor checks completed with warnings.',
      findings,
      nextActions: ['Run `playbook init` and commit governance docs.']
    });
    return ExitCode.WarningsOnly;
  }

  emitResult({
    format: options.format,
    quiet: options.quiet,
    command: 'doctor',
    ok: true,
    exitCode: ExitCode.Success,
    summary: '✔ configuration and docs look good',
    findings,
    nextActions: []
  });

  return ExitCode.Success;
};
