import fs from 'node:fs';
import path from 'node:path';
import {
  buildExecutionPlan,
  routeTask,
  type ExecutionPlanArtifact,
  compileCodexPrompt,
  type LearningStateSnapshotArtifact,
  type RouteDecision,
  recordRouteDecision,
  safeRecordRepositoryEvent
} from '@zachariahredfield/playbook-engine';
import { ExitCode } from '../lib/cliContract.js';
import { createCommandQualityTracker } from '../lib/commandQuality.js';
import { emitCommandFailure, printCommandHelp } from '../lib/commandSurface.js';
import { stageWorkflowArtifact } from '../lib/workflowPromotion.js';
import type { WorkflowPromotion } from '../lib/workflowPromotion.js';

type RouteOptions = {
  format: 'text' | 'json';
  quiet: boolean;
  codexPrompt: boolean;
  help?: boolean;
};

type RouteOutput = {
  schemaVersion: '1.0';
  command: 'route';
  task: string;
  selectedRoute: RouteDecision['route'];
  why: string;
  requiredInputs: string[];
  executionPlan: ExecutionPlanArtifact;
  promotion: WorkflowPromotion;
  codexPrompt?: string;
};

const EXECUTION_PLAN_PATH = '.playbook/execution-plan.json';
const TASK_EXECUTION_PROFILE_PATH = '.playbook/task-execution-profile.json';
const LEARNING_STATE_PATH = '.playbook/learning-state.json';

const extractTask = (args: string[]): string | undefined => {
  const positional = args.filter((arg) => !arg.startsWith('-'));
  if (positional.length === 0) {
    return undefined;
  }

  return positional.join(' ').trim();
};

const tryReadJsonArtifact = <T>(cwd: string, artifactPath: string): T | undefined => {
  const absolutePath = path.join(cwd, artifactPath);
  if (!fs.existsSync(absolutePath)) {
    return undefined;
  }

  return JSON.parse(fs.readFileSync(absolutePath, 'utf8')) as T;
};

const toOutput = (
  task: string,
  decision: RouteDecision,
  executionPlan: ExecutionPlanArtifact,
  promotion: WorkflowPromotion,
  codexPrompt: string | undefined
): RouteOutput => ({
  schemaVersion: '1.0',
  command: 'route',
  task,
  selectedRoute: decision.route,
  why: decision.why,
  requiredInputs: decision.requiredInputs,
  executionPlan,
  promotion,
  codexPrompt
});

const printText = (payload: RouteOutput, options: RouteOptions): void => {
  console.log('Route');
  console.log('─────');
  console.log(`Task: ${payload.task}`);
  console.log(`Selected route: ${payload.selectedRoute}`);
  console.log(`Why: ${payload.why}`);
  console.log(`Task family: ${payload.executionPlan.task_family}`);
  console.log(`Route id: ${payload.executionPlan.route_id}`);
  console.log(`Proposal only: ${payload.executionPlan.proposalOnly ? 'yes' : 'no'}`);
  console.log(`Repository mutation allowed: ${payload.executionPlan.mutation_allowed ? 'yes' : 'no'}`);
  console.log(`Learning state available: ${payload.executionPlan.learning_state_available ? 'yes' : 'no'}`);
  console.log(`Route confidence: ${payload.executionPlan.route_confidence}`);

  console.log('');
  console.log('Rule packs:');
  for (const item of payload.executionPlan.rule_packs) {
    console.log(`- ${item}`);
  }

  console.log('');
  console.log('Required validations:');
  for (const item of payload.executionPlan.required_validations) {
    console.log(`- ${item}`);
  }

  if (payload.executionPlan.optional_validations.length > 0) {
    console.log('');
    console.log('Optional validations:');
    for (const item of payload.executionPlan.optional_validations) {
      console.log(`- ${item}`);
    }
  }

  if (payload.executionPlan.missing_prerequisites.length > 0) {
    console.log('');
    console.log('Missing prerequisites:');
    for (const item of payload.executionPlan.missing_prerequisites) {
      console.log(`- ${item}`);
    }
  }

  if (payload.executionPlan.open_questions.length > 0) {
    console.log('');
    console.log('Open questions:');
    for (const question of payload.executionPlan.open_questions) {
      console.log(`- ${question}`);
    }
  }

  if (payload.executionPlan.warnings.length > 0) {
    console.log('');
    console.log('Warnings:');
    for (const warning of payload.executionPlan.warnings) {
      console.log(`- ${warning}`);
    }
  }

  if (options.codexPrompt && payload.codexPrompt) {
    console.log('');
    console.log('Codex worker prompt');
    console.log('───────────────────');
    console.log(payload.codexPrompt.trimEnd());
  }
};

export const runRoute = async (cwd: string, commandArgs: string[], options: RouteOptions): Promise<number> => {
  if (options.help) {
    printCommandHelp({
      usage: 'playbook route <task> [options]',
      description: 'Classify task routing and emit a deterministic proposal execution plan.',
      options: ['--codex-prompt             Include compiled Codex worker prompt', '--json                     Alias for --format=json', '--format <text|json>       Output format', '--quiet                    Suppress success output in text mode', '--help                     Show help'],
      artifacts: [EXECUTION_PLAN_PATH]
    });
    return ExitCode.Success;
  }

  const tracker = createCommandQualityTracker(cwd, 'route');

  const task = extractTask(commandArgs);
  if (!task) {
    const exitCode = emitCommandFailure('route', options, {
      summary: 'Route failed: missing required task argument.',
      findingId: 'route.task.required',
      message: 'Missing required argument: <task>.',
      nextActions: ['Run `playbook route "<task>"` with a deterministic task statement.']
    });
    tracker.finish({
      inputsSummary: 'missing task argument',
      successStatus: 'failure',
      warningsCount: 1
    });
    return exitCode;
  }

  const decision = routeTask(cwd, task);
  const taskExecutionProfile = tryReadJsonArtifact(cwd, TASK_EXECUTION_PROFILE_PATH);
  const learningState = tryReadJsonArtifact<LearningStateSnapshotArtifact>(cwd, LEARNING_STATE_PATH);
  const executionPlan = buildExecutionPlan({
    task,
    decision,
    learningStateSnapshot: learningState,
    sourceArtifacts: {
      taskExecutionProfile: {
        available: taskExecutionProfile !== undefined,
        artifactPath: TASK_EXECUTION_PROFILE_PATH
      },
      learningState: {
        available: learningState !== undefined,
        artifactPath: LEARNING_STATE_PATH
      }
    }
  });

  const codexPrompt = options.codexPrompt ? compileCodexPrompt(task, decision, executionPlan) : undefined;
  const promotion = stageWorkflowArtifact({
    cwd,
    workflowKind: 'route-execution-plan',
    candidateRelativePath: '.playbook/staged/workflow-route/execution-plan.json',
    committedRelativePath: EXECUTION_PLAN_PATH,
    artifact: executionPlan,
    validate: () => {
      const errors: string[] = [];
      if (executionPlan.schemaVersion !== '1.0') errors.push('schemaVersion must be 1.0');
      if (executionPlan.kind !== 'execution-plan') errors.push('kind must be execution-plan');
      if (!Array.isArray(executionPlan.required_validations)) errors.push('required_validations must be an array');
      return errors;
    },
    generatedAt: executionPlan.generatedAt,
    successSummary: 'Staged execution-plan candidate validated and promoted into the committed route artifact.',
    blockedSummary: 'Staged execution-plan candidate blocked; committed route artifact preserved.'
  });
  const output = toOutput(task, decision, executionPlan, promotion, codexPrompt);

  safeRecordRepositoryEvent(() => {
    recordRouteDecision(cwd, {
      task_text: task,
      task_family: executionPlan.task_family,
      route_id: executionPlan.route_id,
      confidence: executionPlan.route_confidence,
      related_artifacts: [{ path: EXECUTION_PLAN_PATH, kind: 'execution_plan' }]
    });
  });

  if (options.format === 'json') {
    console.log(JSON.stringify(output, null, 2));
    const exitCode = decision.route === 'unsupported' ? ExitCode.Failure : ExitCode.Success;
    tracker.finish({
      inputsSummary: `task=${task}`,
      artifactsRead: [TASK_EXECUTION_PROFILE_PATH, LEARNING_STATE_PATH],
      artifactsWritten: [EXECUTION_PLAN_PATH],
      downstreamArtifactsProduced: [EXECUTION_PLAN_PATH],
      successStatus: decision.route === 'unsupported' ? 'partial' : 'success',
      warningsCount: output.executionPlan.warnings.length,
      openQuestionsCount: output.executionPlan.open_questions.length,
      confidenceScore: output.executionPlan.route_confidence
    });
    return exitCode;
  }

  if (!options.quiet) {
    printText(output, options);
    console.log('');
    console.log(`Wrote proposal artifact: ${EXECUTION_PLAN_PATH}`);
  }

  if (decision.route === 'unsupported') {
    if (output.executionPlan.missing_prerequisites.length > 0) {
      console.error(`Next steps: provide ${output.executionPlan.missing_prerequisites.join(', ')} and retry.`);
    }
    tracker.finish({
      inputsSummary: `task=${task}`,
      artifactsRead: [TASK_EXECUTION_PROFILE_PATH, LEARNING_STATE_PATH],
      artifactsWritten: [EXECUTION_PLAN_PATH],
      downstreamArtifactsProduced: [EXECUTION_PLAN_PATH],
      successStatus: 'partial',
      warningsCount: output.executionPlan.warnings.length,
      openQuestionsCount: output.executionPlan.open_questions.length,
      confidenceScore: output.executionPlan.route_confidence
    });
    return ExitCode.Failure;
  }

  tracker.finish({
    inputsSummary: `task=${task}`,
    artifactsRead: [TASK_EXECUTION_PROFILE_PATH, LEARNING_STATE_PATH],
    artifactsWritten: [EXECUTION_PLAN_PATH],
    downstreamArtifactsProduced: [EXECUTION_PLAN_PATH],
    successStatus: 'success',
    warningsCount: output.executionPlan.warnings.length,
    openQuestionsCount: output.executionPlan.open_questions.length,
    confidenceScore: output.executionPlan.route_confidence
  });
  return ExitCode.Success;
};
