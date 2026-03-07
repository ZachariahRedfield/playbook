import { ExitCode } from '../lib/cliContract.js';
import { listRegisteredCommands } from './index.js';

type ContextResult = {
  schemaVersion: '1.0';
  command: 'context';
  architecture: 'modular-monolith';
  workflow: ['verify', 'plan', 'apply'];
  repositoryIntelligence: {
    artifact: '.playbook/repo-index.json';
    commands: string[];
  };
  cli: {
    commands: string[];
  };
};

const buildContextResult = (): ContextResult => ({
  schemaVersion: '1.0',
  command: 'context',
  architecture: 'modular-monolith',
  workflow: ['verify', 'plan', 'apply'],
  repositoryIntelligence: {
    artifact: '.playbook/repo-index.json',
    commands: ['index', 'query', 'ask', 'explain']
  },
  cli: {
    commands: listRegisteredCommands().map((entry) => entry.name)
  }
});

const printText = (result: ContextResult): void => {
  console.log('Playbook Context');
  console.log('');
  console.log('Architecture');
  console.log(result.architecture);
  console.log('');
  console.log('Workflow');
  console.log(result.workflow.join(' → '));
  console.log('');
  console.log('Repository Intelligence');
  console.log(`Artifact: ${result.repositoryIntelligence.artifact}`);
  console.log(`Commands: ${result.repositoryIntelligence.commands.join(', ')}`);
  console.log('');
  console.log('CLI Commands');
  for (const command of result.cli.commands) {
    console.log(command);
  }
};

export const runContext = async (_cwd: string, options: { format: 'text' | 'json'; quiet: boolean }): Promise<number> => {
  const result = buildContextResult();

  if (options.format === 'json') {
    console.log(JSON.stringify(result, null, 2));
    return ExitCode.Success;
  }

  if (!options.quiet) {
    printText(result);
  }

  return ExitCode.Success;
};
