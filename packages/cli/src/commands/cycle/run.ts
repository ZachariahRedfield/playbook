import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { ExitCode } from '../../lib/cliContract.js';
import { printCommandHelp } from '../../lib/commandSurface.js';
import { writeJsonArtifactAbsolute } from '../../lib/jsonArtifact.js';
import { createCommandQualityTracker } from '../../lib/commandQuality.js';
import { runVerify } from '../verify.js';
import { runRoute } from '../route.js';
import { runOrchestrate } from '../orchestrate.js';
import { runExecution } from '../execute.js';
import { runTelemetry } from '../telemetry.js';
import { runImprove } from '../improve.js';

export type CycleOptions = {
  format: 'text' | 'json';
  quiet: boolean;
  stopOnError: boolean;
  help?: boolean;
  stepRunners?: Partial<Record<StepName, (cwd: string) => Promise<number>>>;
};

type CycleStepStatus = 'success' | 'failure';

type StepName = 'verify' | 'route' | 'orchestrate' | 'execute' | 'telemetry' | 'improve';

type CycleStepRecord = {
  name: StepName;
  status: CycleStepStatus;
  duration_ms: number;
};

type CycleStateArtifact = {
  cycle_version: 1;
  repo: string;
  cycle_id: string;
  started_at: string;
  steps: CycleStepRecord[];
  artifacts_written: string[];
  result: 'success' | 'failed';
  failed_step?: StepName;
};

const CYCLE_STATE_PATH = '.playbook/cycle-state.json';
const CYCLE_TASKS_PATH = '.playbook/cycle-tasks.json';

const STEP_ORDER: StepName[] = ['verify', 'route', 'orchestrate', 'execute', 'telemetry', 'improve'];

const STEP_ARTIFACTS: Record<StepName, string[]> = {
  verify: ['.playbook/execution/runs'],
  route: ['.playbook/execution-plan.json'],
  orchestrate: ['.playbook/cycle-tasks.json', '.playbook/orchestrator/orchestrator.json', '.playbook/workset-plan.json', '.playbook/lane-state.json'],
  execute: ['.playbook/execution-state.json'],
  telemetry: ['.playbook/learning-compaction.json'],
  improve: ['.playbook/improvement-candidates.json', '.playbook/command-improvements.json']
};

const nowMs = (): number => Date.now();

const pathExists = (cwd: string, relativePath: string): boolean => fs.existsSync(path.join(cwd, relativePath));

const toCycleArtifact = (
  repo: string,
  cycleId: string,
  startedAt: string,
  steps: CycleStepRecord[],
  artifactsWritten: string[],
  result: 'success' | 'failed',
  failedStep?: StepName
): CycleStateArtifact => ({
  cycle_version: 1,
  repo,
  cycle_id: cycleId,
  started_at: startedAt,
  steps,
  artifacts_written: artifactsWritten,
  result,
  ...(failedStep ? { failed_step: failedStep } : {})
});

const writeCycleState = (cwd: string, artifact: CycleStateArtifact): void => {
  const targetPath = path.join(cwd, CYCLE_STATE_PATH);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  writeJsonArtifactAbsolute(targetPath, artifact, 'cycle', { envelope: false });
};

const stepMarker = (status: CycleStepStatus): string => (status === 'success' ? '✓' : '✗');

const printCycleText = (artifact: CycleStateArtifact, options: CycleOptions): void => {
  if (options.quiet) {
    return;
  }

  console.log('Playbook Cycle');
  console.log('');

  for (const step of artifact.steps) {
    console.log(`${stepMarker(step.status)} ${step.name}`);
  }

  console.log('');
  console.log(`Cycle status: ${artifact.result.toUpperCase()}`);
};

const runStep = async (cwd: string, step: StepName, stepRunners?: Partial<Record<StepName, (cwd: string) => Promise<number>>>): Promise<number> => {
  const override = stepRunners?.[step];
  if (override) {
    return override(cwd);
  }
  if (step === 'verify') {
    return runVerify(cwd, { format: 'text', ci: false, quiet: true, explain: false, policy: false });
  }

  if (step === 'route') {
    return runRoute(cwd, ['update command docs for deterministic playbook cycle'], { format: 'text', quiet: true, codexPrompt: false });
  }

  if (step === 'orchestrate') {
    const tasksPath = path.join(cwd, CYCLE_TASKS_PATH);
    fs.mkdirSync(path.dirname(tasksPath), { recursive: true });
    fs.writeFileSync(tasksPath, `${JSON.stringify([{ task_id: 'cycle-task-1', task: 'update command docs for deterministic playbook cycle' }], null, 2)}\n`, 'utf8');

    return runOrchestrate(cwd, {
      format: 'text',
      quiet: true,
      tasksFile: CYCLE_TASKS_PATH,
      lanes: 3,
      outDir: '.playbook/orchestrator',
      artifactFormat: 'json'
    });
  }

  if (step === 'execute') {
    return runExecution(cwd, { format: 'text', quiet: true });
  }

  if (step === 'telemetry') {
    return runTelemetry(cwd, ['learning'], { format: 'text', quiet: true });
  }

  return runImprove(cwd, { format: 'text', quiet: true });
};

export const runCycle = async (cwd: string, options: CycleOptions): Promise<number> => {
  if (options.help) {
    printCommandHelp({
      usage: 'playbook cycle [options]',
      description: 'Run the deterministic execution cycle by orchestrating primitive command handlers.',
      options: ['--no-stop-on-error         Continue running steps after a failure (default: stop on first failure)', '--json                     Alias for --format=json', '--format <text|json>       Output format', '--quiet                    Suppress success output in text mode', '--help                     Show help'],
      artifacts: [CYCLE_STATE_PATH]
    });
    return ExitCode.Success;
  }

  const tracker = createCommandQualityTracker(cwd, 'cycle');
  const startedAt = new Date().toISOString();
  const cycleId = randomUUID();
  const steps: CycleStepRecord[] = [];
  const artifactsWritten: string[] = [];

  let result: 'success' | 'failed' = 'success';
  let failedStep: StepName | undefined;
  let failureExitCode: number | null = null;
  let activeStep: StepName | undefined;

  try {
    for (const step of STEP_ORDER) {
      activeStep = step;
      const startedMs = nowMs();
      const exitCode = await runStep(cwd, step, options.stepRunners);
      const durationMs = nowMs() - startedMs;
      const status: CycleStepStatus = exitCode === ExitCode.Success ? 'success' : 'failure';

      steps.push({ name: step, status, duration_ms: durationMs });

      for (const artifact of STEP_ARTIFACTS[step]) {
        if (pathExists(cwd, artifact)) {
          artifactsWritten.push(artifact);
        }
      }

      if (status === 'failure') {
        result = 'failed';
        failedStep = step;
        failureExitCode = exitCode;
        if (options.stopOnError) {
          break;
        }
      }
    }
  } catch (error) {
    result = 'failed';
    failedStep = failedStep ?? activeStep;
    const artifact = toCycleArtifact(cwd, cycleId, startedAt, steps, [...new Set(artifactsWritten)], result, failedStep);
    writeCycleState(cwd, artifact);
    tracker.finish({
      inputsSummary: `stop-on-error=${options.stopOnError ? 'true' : 'false'}`,
      artifactsWritten: [CYCLE_STATE_PATH],
      downstreamArtifactsProduced: [CYCLE_STATE_PATH],
      successStatus: 'failure',
      warningsCount: 1
    });
    throw error;
  }

  const artifact = toCycleArtifact(cwd, cycleId, startedAt, steps, [...new Set(artifactsWritten)], result, failedStep);
  writeCycleState(cwd, artifact);

  if (options.format === 'json') {
    console.log(JSON.stringify(artifact, null, 2));
  } else {
    printCycleText(artifact, options);
  }

  const exitCode = failureExitCode ?? ExitCode.Success;
  tracker.finish({
    inputsSummary: `stop-on-error=${options.stopOnError ? 'true' : 'false'}`,
    artifactsWritten: [CYCLE_STATE_PATH],
    downstreamArtifactsProduced: [CYCLE_STATE_PATH],
    successStatus: exitCode === ExitCode.Success ? 'success' : 'failure',
    warningsCount: artifact.steps.filter((step) => step.status === 'failure').length
  });

  return exitCode;
};
