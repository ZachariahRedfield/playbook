import fs from 'node:fs';
import path from 'node:path';
import {
  buildExecutionPlan,
  routeTask,
  type ExecutionPlanArtifact,
  compileCodexPrompt,
  type LearningStateSnapshotArtifact,
  type RouteDecision
} from '@zachariahredfield/playbook-engine';
import { ExitCode } from '../lib/cliContract.js';

type RouteOptions = {
  format: 'text' | 'json';
  quiet: boolean;
  codexPrompt: boolean;
};

type RouteOutput = {
  schemaVersion: '1.0';
  command: 'route';
  task: string;
  selectedRoute: RouteDecision['route'];
  why: string;
  requiredInputs: string[];
  executionPlan: ExecutionPlanArtifact;
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
  codexPrompt: string | undefined
): RouteOutput => ({
  schemaVersion: '1.0',
  command: 'route',
  task,
  selectedRoute: decision.route,
  why: decision.why,
  requiredInputs: decision.requiredInputs,
  executionPlan,
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
  const task = extractTask(commandArgs);
  if (!task) {
    console.error('playbook route: missing required <task> argument');
    return ExitCode.Failure;
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
  const output = toOutput(task, decision, executionPlan, codexPrompt);

  fs.mkdirSync(path.join(cwd, '.playbook'), { recursive: true });
  fs.writeFileSync(path.join(cwd, EXECUTION_PLAN_PATH), `${JSON.stringify(executionPlan, null, 2)}\n`, 'utf8');

  if (options.format === 'json') {
    console.log(JSON.stringify(output, null, 2));
    return decision.route === 'unsupported' ? ExitCode.Failure : ExitCode.Success;
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
    return ExitCode.Failure;
  }

  return ExitCode.Success;
};
