import path from 'node:path';
import { buildOrchestratorPlan, type OrchestratorContract, writeOrchestratorArtifacts } from '@zachariahredfield/playbook-engine';
import { ExitCode } from '../lib/cliContract.js';

type RunOrchestrateOptions = {
  format: 'text' | 'json';
  quiet: boolean;
};

const parseOption = (args: string[], name: string): string | undefined => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

export const runOrchestrate = async (cwd: string, commandArgs: string[], options: RunOrchestrateOptions): Promise<number> => {
  const goal = parseOption(commandArgs, '--goal');
  if (!goal) {
    console.error('playbook orchestrate: missing required --goal');
    return ExitCode.Failure;
  }

  const outDir = path.resolve(cwd, parseOption(commandArgs, '--out-dir') ?? '.playbook/orchestrate');
  const contract: OrchestratorContract = {
    schemaVersion: '1.0',
    goal,
    sharedPaths: [],
    lanes: [
      { id: 'core', allowedPaths: ['packages/core'], wave: 1, dependsOn: [] },
      { id: 'engine', allowedPaths: ['packages/engine'], wave: 2, dependsOn: ['core'] }
    ]
  };
  const plan = buildOrchestratorPlan(contract, {
    modules: [
      { name: 'core', path: 'packages/core' },
      { name: 'engine', path: 'packages/engine' }
    ]
  });
  const artifacts = writeOrchestratorArtifacts(outDir, plan);

  if (options.format === 'json') {
    console.log(JSON.stringify({ schemaVersion: '1.0', command: 'orchestrate', goal, outDir, artifacts }, null, 2));
  } else if (!options.quiet) {
    console.log(`Orchestration plan written to ${outDir}`);
  }

  return ExitCode.Success;
};
