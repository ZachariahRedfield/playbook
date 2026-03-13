#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);

const targetedSmokeCommands = new Map([
  ['ask', ['node', 'packages/cli/dist/main.js', 'ask', 'summarize repository modules', '--repo-context', '--json']],
  ['ai-contract', ['node', 'packages/cli/dist/main.js', 'ai-contract', '--json']],
  ['schema', ['node', 'packages/cli/dist/main.js', 'schema', 'verify', '--json']],
  ['doctor', ['node', 'packages/cli/dist/main.js', 'doctor', '--dry-run', '--json']],
  ['policy', ['node', 'packages/cli/dist/main.js', 'verify', '--policy', '--json']],
  ['runtime', ['node', 'packages/cli/dist/main.js', 'agent', 'status', '--json']],
  ['scheduler', ['node', 'packages/cli/dist/main.js', 'agent', 'runs', '--json']],
]);

const runTargetedAgentDryRun = () => {
  const planResult = run('node', ['packages/cli/dist/main.js', 'plan', '--json']);
  if (planResult.status !== 0) {
    return planResult;
  }

  return run('node', ['packages/cli/dist/main.js', 'agent', 'run', '--from-plan', '.playbook/plan.json', '--dry-run', '--json']);
};

const run = (command, commandArgs) =>
  spawnSync(command, commandArgs, {
    stdio: 'inherit',
    env: process.env,
  });

if (args.length === 0) {
  const result = run('pnpm', ['-r', 'test']);
  process.exit(typeof result.status === 'number' ? result.status : 1);
}

const filteredArgs = args.filter((arg) => arg !== '--');
if (filteredArgs.length === 1) {
  if (filteredArgs[0] === 'agent') {
    const result = runTargetedAgentDryRun();
    process.exit(typeof result.status === 'number' ? result.status : 1);
  }

  const command = targetedSmokeCommands.get(filteredArgs[0]);
  if (command) {
    const [bin, ...commandArgs] = command;
    const result = run(bin, commandArgs);
    process.exit(typeof result.status === 'number' ? result.status : 1);
  }
}

const result = run('pnpm', ['-C', 'packages/cli', 'test', '--', ...args]);
process.exit(typeof result.status === 'number' ? result.status : 1);
