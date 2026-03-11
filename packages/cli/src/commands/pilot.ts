import fs from 'node:fs';
import path from 'node:path';
<<<<<<< HEAD
import { ExitCode } from '../lib/cliContract.js';
import { runContext } from './context.js';
import { runIndex } from './repoIndex.js';
import { runPlan } from './plan.js';
import { runQuery } from './query.js';
import { runVerify } from './verify.js';

const PILOT_PHASES = ['context', 'index', 'query modules', 'verify', 'plan'] as const;
=======
import { generatePlanContract, queryRepositoryIndex } from '@zachariahredfield/playbook-engine';
import { ExitCode } from '../lib/cliContract.js';
import { writeJsonArtifact } from '../lib/jsonArtifact.js';
import { resolveTargetRepoRoot } from '../lib/repoRoot.js';
import { runContext } from './context.js';
import { runIndex } from './repoIndex.js';
import { runQuery } from './query.js';
import { collectVerifyReport } from './verify.js';
import { buildPlanRemediation, deriveVerifyFailureFacts } from '../lib/remediationContract.js';
>>>>>>> e7e6212fdfca535a8bea181c1e417bbc752efb88

type PilotOptions = {
  format: 'text' | 'json';
  quiet: boolean;
<<<<<<< HEAD
  repo?: string;
};

type QueryModulesPayload = {
  command: 'query';
  field: 'modules';
  result: Array<{ name: string; dependencies: string[] }>;
};

type IndexPayload = {
  command: 'index';
  framework: string;
  architecture: string;
};

type VerifyPayload = {
  command: 'verify';
  findings: Array<{ level: 'error' | 'warning' | 'info' }>;
};

type PlanPayload = {
  command: 'plan';
  remediation?: {
    status?: string;
  };
=======
>>>>>>> e7e6212fdfca535a8bea181c1e417bbc752efb88
};

type PilotSummary = {
  schemaVersion: '1.0';
  command: 'pilot';
<<<<<<< HEAD
  ok: true;
  targetRepoPath: string;
=======
  targetRepo: string;
>>>>>>> e7e6212fdfca535a8bea181c1e417bbc752efb88
  frameworkInference: string;
  architectureInference: string;
  modulesDetectedCount: number;
  verifyWarningsCount: number;
  verifyFailuresCount: number;
  remediationStatus: string;
<<<<<<< HEAD
  artifactPathsWritten: string[];
};

const parseJsonOutput = <T>(entries: string[], phase: string): T => {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    try {
      return JSON.parse(entries[index]) as T;
    } catch {
      // Keep scanning captured lines until a valid JSON payload is found.
    }
  }

  throw new Error(`playbook pilot: ${phase} produced no JSON payload`);
};

const captureJsonPhase = async <T>(runPhase: () => Promise<number>, phase: string): Promise<{ exitCode: number; payload: T }> => {
  const originalLog = console.log;
  const captured: string[] = [];

  console.log = (...args: unknown[]) => {
    const line = args
      .map((value) => {
        if (typeof value === 'string') {
          return value;
        }
        try {
          return JSON.stringify(value);
        } catch {
          return String(value);
        }
      })
      .join(' ');
    captured.push(line);
  };

  try {
    const exitCode = await runPhase();
    const payload = parseJsonOutput<T>(captured, phase);
    return { exitCode, payload };
  } finally {
    console.log = originalLog;
  }
};

const assertJsonFile = (targetPath: string): void => {
  try {
    JSON.parse(fs.readFileSync(targetPath, 'utf8'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`playbook pilot: invalid JSON artifact at ${targetPath}: ${message}`);
  }
};

const toPosixRelative = (cwd: string, targetPath: string): string =>
  path.relative(cwd, targetPath).split(path.sep).join(path.posix.sep);

const writePilotSummaryArtifact = (targetPath: string, summary: PilotSummary): void => {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
};

const printSummaryText = (summary: PilotSummary): void => {
  console.log('Playbook Pilot');
  console.log(`Target repo: ${summary.targetRepoPath}`);
  console.log(`Framework: ${summary.frameworkInference}`);
  console.log(`Architecture: ${summary.architectureInference}`);
  console.log(`Modules: ${summary.modulesDetectedCount}`);
  console.log(`Verify failures: ${summary.verifyFailuresCount}`);
  console.log(`Verify warnings: ${summary.verifyWarningsCount}`);
  console.log(`Remediation: ${summary.remediationStatus}`);
  console.log('Artifacts');
  for (const artifactPath of summary.artifactPathsWritten) {
    console.log(`- ${artifactPath}`);
  }
};

const buildSummary = (input: {
  cwd: string;
  index: IndexPayload;
  queryModules: QueryModulesPayload;
  verify: VerifyPayload;
  plan: PlanPayload;
  artifacts: string[];
}): PilotSummary => {
  const verifyFailuresCount = input.verify.findings.filter((entry) => entry.level === 'error').length;
  const verifyWarningsCount = input.verify.findings.filter((entry) => entry.level === 'warning').length;

  return {
    schemaVersion: '1.0',
    command: 'pilot',
    ok: true,
    targetRepoPath: input.cwd,
    frameworkInference: input.index.framework,
    architectureInference: input.index.architecture,
    modulesDetectedCount: input.queryModules.result.length,
    verifyWarningsCount,
    verifyFailuresCount,
    remediationStatus: input.plan.remediation?.status ?? 'unknown',
    artifactPathsWritten: input.artifacts
  };
};

export const runPilot = async (
  cwd: string,
  options: PilotOptions
): Promise<{ exitCode: number; childCommands: string[] }> => {
  if (options.repo !== undefined && options.repo.trim().length === 0) {
    console.error('playbook pilot: --repo requires a non-empty path value');
    return { exitCode: ExitCode.Failure, childCommands: [] };
  }

  const playbookDir = path.join(cwd, '.playbook');
  fs.mkdirSync(playbookDir, { recursive: true });

  const findingsPath = path.join(playbookDir, 'findings.json');
  const planPath = path.join(playbookDir, 'plan.json');
  const indexPath = path.join(playbookDir, 'repo-index.json');
  const graphPath = path.join(playbookDir, 'repo-graph.json');
  const summaryPath = path.join(playbookDir, 'pilot-summary.json');

  const contextPhase = await captureJsonPhase(
    () =>
      runContext(cwd, {
        format: 'json',
        quiet: true
      }),
    'context'
  );
  if (contextPhase.exitCode !== ExitCode.Success) {
    return { exitCode: ExitCode.Failure, childCommands: [...PILOT_PHASES] };
  }

  const indexPhase = await captureJsonPhase<IndexPayload>(
    () =>
      runIndex(cwd, {
        format: 'json',
        quiet: true
      }),
    'index'
  );
  if (indexPhase.exitCode !== ExitCode.Success) {
    return { exitCode: ExitCode.Failure, childCommands: [...PILOT_PHASES] };
  }

  const queryModulesPhase = await captureJsonPhase<QueryModulesPayload>(
    () =>
      runQuery(cwd, ['modules'], {
        format: 'json',
        quiet: true
      }),
    'query modules'
  );
  if (queryModulesPhase.exitCode !== ExitCode.Success) {
    return { exitCode: ExitCode.Failure, childCommands: [...PILOT_PHASES] };
  }

  const verifyPhase = await captureJsonPhase<VerifyPayload>(
    () =>
      runVerify(cwd, {
        format: 'json',
        ci: true,
        quiet: true,
        explain: false,
        policy: false,
        outFile: findingsPath
      }),
    'verify'
  );
  if (verifyPhase.exitCode !== ExitCode.Success && verifyPhase.exitCode !== ExitCode.PolicyFailure) {
    return { exitCode: ExitCode.Failure, childCommands: [...PILOT_PHASES] };
  }

  const planPhase = await captureJsonPhase<PlanPayload>(
    () =>
      runPlan(cwd, {
        format: 'json',
        ci: true,
        quiet: true,
        outFile: planPath
      }),
    'plan'
  );
  if (planPhase.exitCode !== ExitCode.Success) {
    return { exitCode: ExitCode.Failure, childCommands: [...PILOT_PHASES] };
  }

  assertJsonFile(findingsPath);
  assertJsonFile(planPath);
  assertJsonFile(indexPath);
  assertJsonFile(graphPath);

  const summary = buildSummary({
    cwd,
    index: indexPhase.payload,
    queryModules: queryModulesPhase.payload,
    verify: verifyPhase.payload,
    plan: planPhase.payload,
    artifacts: [
      toPosixRelative(cwd, indexPath),
      toPosixRelative(cwd, graphPath),
      toPosixRelative(cwd, findingsPath),
      toPosixRelative(cwd, planPath),
      toPosixRelative(cwd, summaryPath)
    ]
  });

  writePilotSummaryArtifact(summaryPath, summary);

  if (options.format === 'json') {
    console.log(JSON.stringify(summary, null, 2));
  } else if (!options.quiet) {
    printSummaryText(summary);
  }

  return { exitCode: ExitCode.Success, childCommands: [...PILOT_PHASES] };
=======
  artifactPathsWritten: {
    findings: string;
    plan: string;
    summary: string;
  };
};

const parseOptionValue = (allArgs: string[], name: string): string | undefined => {
  const index = allArgs.indexOf(name);
  return index >= 0 && allArgs[index + 1] ? String(allArgs[index + 1]) : undefined;
};

const toRelative = (repoRoot: string, absolutePath: string): string => path.relative(repoRoot, absolutePath).split(path.sep).join(path.posix.sep);

const summarize = (summary: PilotSummary): void => {
  console.log('Playbook Pilot');
  console.log('─────────────');
  console.log(`Target repo: ${summary.targetRepo}`);
  console.log(`Framework: ${summary.frameworkInference}`);
  console.log(`Architecture: ${summary.architectureInference}`);
  console.log(`Modules detected: ${summary.modulesDetectedCount}`);
  console.log(`Verify warnings: ${summary.verifyWarningsCount}`);
  console.log(`Verify failures: ${summary.verifyFailuresCount}`);
  console.log(`Remediation status: ${summary.remediationStatus}`);
  console.log('Artifacts written:');
  console.log(`- ${summary.artifactPathsWritten.findings}`);
  console.log(`- ${summary.artifactPathsWritten.plan}`);
  console.log(`- ${summary.artifactPathsWritten.summary}`);
};

export const runPilot = async (cwd: string, commandArgs: string[], options: PilotOptions): Promise<number> => {
  const repoArg = parseOptionValue(commandArgs, '--repo');
  if (!repoArg) {
    console.error('playbook pilot: missing required --repo <target-repo-path> option');
    return ExitCode.Failure;
  }

  const targetRepo = resolveTargetRepoRoot(cwd, repoArg);
  const playbookDir = path.join(targetRepo, '.playbook');
  fs.mkdirSync(playbookDir, { recursive: true });

  await runContext(targetRepo, { format: 'text', quiet: true });
  await runIndex(targetRepo, { format: 'text', quiet: true });
  await runQuery(targetRepo, ['modules'], { format: 'text', quiet: true });

  const modules = queryRepositoryIndex(targetRepo, 'modules');
  const verifyReport = await collectVerifyReport(targetRepo);
  const plan = generatePlanContract(targetRepo);
  const failureFacts = deriveVerifyFailureFacts(plan.verify);
  const remediation = buildPlanRemediation({ failureCount: failureFacts.failureCount, stepCount: plan.tasks.length });

  const findingsPayload = {
    schemaVersion: '1.0',
    command: 'verify',
    ok: verifyReport.ok,
    exitCode: verifyReport.ok ? ExitCode.Success : ExitCode.PolicyFailure,
    summary: verifyReport.ok ? 'Verification passed.' : 'Verification failed.',
    findings: [
      ...verifyReport.failures.map((failure) => ({ id: `verify.failure.${failure.id}`, level: 'error' as const, message: failure.message })),
      ...verifyReport.warnings.map((warning) => ({ id: `verify.warning.${warning.id}`, level: 'warning' as const, message: warning.message }))
    ],
    nextActions: verifyReport.failures.map((failure) => failure.fix).filter((fix): fix is string => Boolean(fix))
  };

  const planPayload = {
    schemaVersion: '1.0',
    command: 'plan',
    ok: true,
    exitCode: ExitCode.Success,
    verify: plan.verify,
    remediation,
    tasks: plan.tasks
  };

  const findingsPath = writeJsonArtifact(targetRepo, '.playbook/findings.json', findingsPayload, 'pilot');
  const planPath = writeJsonArtifact(targetRepo, '.playbook/plan.json', planPayload, 'pilot');

  const repoIndex = JSON.parse(fs.readFileSync(path.join(targetRepo, '.playbook', 'repo-index.json'), 'utf8')) as {
    framework?: string;
    architecture?: string;
  };

  const summary: PilotSummary = {
    schemaVersion: '1.0',
    command: 'pilot',
    targetRepo,
    frameworkInference: repoIndex.framework ?? 'unknown',
    architectureInference: repoIndex.architecture ?? 'unknown',
    modulesDetectedCount: Array.isArray(modules) ? modules.length : 0,
    verifyWarningsCount: verifyReport.summary.warnings,
    verifyFailuresCount: verifyReport.summary.failures,
    remediationStatus: remediation.status,
    artifactPathsWritten: {
      findings: toRelative(targetRepo, findingsPath),
      plan: toRelative(targetRepo, planPath),
      summary: '.playbook/pilot-summary.json'
    }
  };

  writeJsonArtifact(targetRepo, '.playbook/pilot-summary.json', summary, 'pilot');

  if (options.format === 'json') {
    console.log(JSON.stringify(summary, null, 2));
    return ExitCode.Success;
  }

  if (!options.quiet) {
    summarize(summary);
  }

  return ExitCode.Success;
>>>>>>> e7e6212fdfca535a8bea181c1e417bbc752efb88
};
