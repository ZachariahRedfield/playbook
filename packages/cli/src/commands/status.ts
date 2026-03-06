import { collectAnalyzeReport } from './analyze.js';
import { collectDoctorReport } from './doctor.js';
import { collectVerifyReport } from './verify.js';
import { ExitCode } from '../lib/cliContract.js';
import fs from 'node:fs';
import path from 'node:path';

type StatusOptions = {
  ci: boolean;
  format: 'text' | 'json';
  quiet: boolean;
};

type StatusResult = {
  schemaVersion: '1.0';
  command: 'status';
  ok: boolean;
  environment: { ok: boolean };
  analysis: { warnings: number; errors: number };
  verification: { ok: boolean };
  summary: {
    warnings: number;
    errors: number;
  };
};

type RepoIndexSummary = {
  framework: string;
  modules: string[];
  docs: string[];
  rules: string[];
};

const readRepoIndexSummary = (cwd: string): RepoIndexSummary | null => {
  const repoIndexPath = path.join(cwd, '.playbook', 'repo-index.json');
  if (!fs.existsSync(repoIndexPath)) {
    return null;
  }

  const raw = fs.readFileSync(repoIndexPath, 'utf8');
  const parsed = JSON.parse(raw) as Partial<RepoIndexSummary>;

  if (typeof parsed.framework !== 'string') {
    return null;
  }

  return {
    framework: parsed.framework,
    modules: Array.isArray(parsed.modules) ? parsed.modules.filter((value): value is string => typeof value === 'string') : [],
    docs: Array.isArray(parsed.docs) ? parsed.docs.filter((value): value is string => typeof value === 'string') : [],
    rules: Array.isArray(parsed.rules) ? parsed.rules.filter((value): value is string => typeof value === 'string') : []
  };
};

const toStatusResult = async (cwd: string): Promise<{ result: StatusResult; exitCode: ExitCode }> => {
  const doctor = await collectDoctorReport(cwd);
  const analyze = await collectAnalyzeReport(cwd);
  const verify = await collectVerifyReport(cwd);

  const warnings = analyze.recommendations.filter((rec: { severity: string }) => rec.severity === 'WARN').length;
  const errors = 0;

  const result: StatusResult = {
    schemaVersion: '1.0',
    command: 'status',
    ok: doctor.ok && verify.ok,
    environment: { ok: doctor.exitCode !== ExitCode.EnvironmentPrereq },
    analysis: { warnings, errors },
    verification: { ok: verify.ok },
    summary: { warnings, errors }
  };

  const exitCode = doctor.exitCode === ExitCode.EnvironmentPrereq
    ? ExitCode.EnvironmentPrereq
    : verify.ok
      ? ExitCode.Success
      : ExitCode.PolicyFailure;

  return { result, exitCode };
};

const printHuman = (result: StatusResult, ci: boolean, repoIndexSummary: RepoIndexSummary | null): void => {
  if (ci) {
    console.log(result.ok ? 'playbook status: PASS' : 'playbook status: FAIL');
    return;
  }

  console.log('Environment');
  console.log(result.environment.ok ? '  ✔ ok' : '  ✖ failed');

  if (repoIndexSummary) {
    console.log('');
    console.log('Project summary');
    console.log('────────────────');
    console.log('');
    console.log(`Framework: ${repoIndexSummary.framework}`);
    console.log(`Modules: ${repoIndexSummary.modules.length > 0 ? repoIndexSummary.modules.join(', ') : '-'}`);
    console.log(`Docs: ${repoIndexSummary.docs.length > 0 ? repoIndexSummary.docs.join(', ') : '-'}`);
    console.log(`Playbook rules: ${repoIndexSummary.rules.length}`);
  }

  console.log('');
  console.log('Repository Analysis');
  console.log(`  Warnings: ${result.analysis.warnings}`);
  console.log(`  Errors: ${result.analysis.errors}`);
  console.log('');
  console.log('Policy Verification');
  console.log(result.verification.ok ? '  ✔ ok' : '  ✖ failed');
  console.log('');
  console.log('Summary');
  console.log(`  Overall: ${result.ok ? 'healthy' : 'issues detected'}`);
  console.log(`  Warnings: ${result.summary.warnings}`);
  console.log(`  Errors: ${result.summary.errors}`);
};

export const runStatus = async (cwd: string, options: StatusOptions): Promise<number> => {
  try {
    const { result, exitCode } = await toStatusResult(cwd);

    if (options.format === 'json') {
      console.log(JSON.stringify(result, null, 2));
      return exitCode;
    }

    if (!(options.quiet && result.ok)) {
      const repoIndexSummary = readRepoIndexSummary(cwd);
      printHuman(result, options.ci, repoIndexSummary);
    }

    return exitCode;
  } catch (error) {
    if (options.format === 'json') {
      console.log(JSON.stringify({ schemaVersion: '1.0', command: 'status', ok: false, error: String(error) }, null, 2));
    } else {
      console.error('playbook status failed with an internal error.');
      console.error(String(error));
    }
    return ExitCode.Failure;
  }
};
