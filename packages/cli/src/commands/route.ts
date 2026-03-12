import { routeTask, type RouteDecision } from '@zachariahredfield/playbook-engine';
import { ExitCode } from '../lib/cliContract.js';

type RouteOptions = {
  format: 'text' | 'json';
  quiet: boolean;
};

type RouteOutput = {
  schemaVersion: '1.0';
  command: 'route';
  task: string;
  selectedRoute: RouteDecision['route'];
  why: string;
  requiredInputs: string[];
  missingPrerequisites: string[];
  repoMutationAllowed: boolean;
};

const extractTask = (args: string[]): string | undefined => {
  const positional = args.filter((arg) => !arg.startsWith('-'));
  if (positional.length === 0) {
    return undefined;
  }

  return positional.join(' ').trim();
};

const toOutput = (task: string, decision: RouteDecision): RouteOutput => ({
  schemaVersion: '1.0',
  command: 'route',
  task,
  selectedRoute: decision.route,
  why: decision.why,
  requiredInputs: decision.requiredInputs,
  missingPrerequisites: decision.missingPrerequisites,
  repoMutationAllowed: decision.repoMutationAllowed
});

const printText = (payload: RouteOutput): void => {
  console.log('Route');
  console.log('─────');
  console.log(`Task: ${payload.task}`);
  console.log(`Selected route: ${payload.selectedRoute}`);
  console.log(`Why: ${payload.why}`);
  console.log(`Repository mutation allowed: ${payload.repoMutationAllowed ? 'yes' : 'no'}`);
  console.log('');
  console.log('Required inputs:');
  for (const item of payload.requiredInputs) {
    console.log(`- ${item}`);
  }

  if (payload.missingPrerequisites.length > 0) {
    console.log('');
    console.log('Missing prerequisites:');
    for (const item of payload.missingPrerequisites) {
      console.log(`- ${item}`);
    }
  }
};

export const runRoute = async (cwd: string, commandArgs: string[], options: RouteOptions): Promise<number> => {
  const task = extractTask(commandArgs);
  if (!task) {
    console.error('playbook route: missing required <task> argument');
    return ExitCode.Failure;
  }

  const decision = routeTask(cwd, task);
  const output = toOutput(task, decision);

  if (options.format === 'json') {
    console.log(JSON.stringify(output, null, 2));
    return decision.route === 'unsupported' ? ExitCode.Failure : ExitCode.Success;
  }

  if (!options.quiet) {
    printText(output);
  }

  if (decision.route === 'unsupported') {
    if (output.missingPrerequisites.length > 0) {
      console.error(`Next steps: provide ${output.missingPrerequisites.join(', ')} and retry.`);
    }
    return ExitCode.Failure;
  }

  return ExitCode.Success;
};
