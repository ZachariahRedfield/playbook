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
  controlPlaneArtifacts: {
    policyEvaluation: '.playbook/policy-evaluation.json';
    policyApplyResult: '.playbook/policy-apply-result.json';
    session: '.playbook/session.json';
    cycleState: '.playbook/cycle-state.json';
    cycleHistory: '.playbook/cycle-history.json';
    improvementCandidates: '.playbook/improvement-candidates.json';
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
  controlPlaneArtifacts: {
    policyEvaluation: '.playbook/policy-evaluation.json',
    policyApplyResult: '.playbook/policy-apply-result.json',
    session: '.playbook/session.json',
    cycleState: '.playbook/cycle-state.json',
    cycleHistory: '.playbook/cycle-history.json',
    improvementCandidates: '.playbook/improvement-candidates.json'
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
  console.log('Control Plane Artifacts');
  console.log(`Policy evaluation: ${result.controlPlaneArtifacts.policyEvaluation}`);
  console.log(`Policy apply result: ${result.controlPlaneArtifacts.policyApplyResult}`);
  console.log(`Session: ${result.controlPlaneArtifacts.session}`);
  console.log(`Cycle state: ${result.controlPlaneArtifacts.cycleState}`);
  console.log(`Cycle history: ${result.controlPlaneArtifacts.cycleHistory}`);
  console.log(`Improvement candidates: ${result.controlPlaneArtifacts.improvementCandidates}`);
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
