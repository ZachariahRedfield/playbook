#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const PNPM_BIN = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

const createSmokeStep = (command, commandArgs) => ({ command, commandArgs });

const targetedSmokeRuns = new Map([
  [
    'ask',
    [
      // Repo-context smoke tests must self-bootstrap required .playbook artifacts.
      createSmokeStep('node', ['packages/cli/dist/main.js', 'index', '--json']),
      createSmokeStep('node', ['packages/cli/dist/main.js', 'ask', 'summarize repository modules', '--repo-context', '--json']),
    ],
  ],
  ['ai-contract', [createSmokeStep('node', ['packages/cli/dist/main.js', 'ai-contract', '--json'])]],
  ['schema', [createSmokeStep('node', ['packages/cli/dist/main.js', 'schema', 'verify', '--json'])]],
  ['doctor', [createSmokeStep('node', ['packages/cli/dist/main.js', 'doctor', '--dry-run', '--json'])]],
  ['policy', [createSmokeStep('node', ['packages/cli/dist/main.js', 'verify', '--policy', '--json'])]],
  ['runtime', [createSmokeStep('node', ['packages/cli/dist/main.js', 'agent', 'status', '--json'])]],
  ['scheduler', [createSmokeStep('node', ['packages/cli/dist/main.js', 'agent', 'runs', '--json'])]],
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
    shell: process.platform === 'win32',
  });

const runEsbuildPreflight = () => run('node', ['scripts/assert-esbuild.mjs']);

const runSteps = (steps) => {
  for (const { command, commandArgs } of steps) {
    const result = run(command, commandArgs);
    if (result.status !== 0) {
      return result;
    }
  }

  return { status: 0 };
};

const runRootScriptTests = () => {
  const scriptTestsDir = path.join(process.cwd(), 'test', 'scripts');
  if (!fs.existsSync(scriptTestsDir)) {
    return { status: 0 };
  }

  const scriptTests = fs.readdirSync(scriptTestsDir)
    .filter((entry) => entry.endsWith('.test.mjs'))
    .sort()
    .map((entry) => path.join('test', 'scripts', entry));

  if (scriptTests.length === 0) {
    return { status: 0 };
  }

  return run('node', ['--test', ...scriptTests]);
};

if (args.length === 0) {
  const esbuildPreflightResult = runEsbuildPreflight();
  if (esbuildPreflightResult.status !== 0) {
    process.exit(typeof esbuildPreflightResult.status === 'number' ? esbuildPreflightResult.status : 1);
  }

  const skipContractCheck = process.env.PLAYBOOK_SKIP_CONTRACTS_CHECK === '1';
  if (!skipContractCheck) {
    const contractCheckResult = run(PNPM_BIN, ['contracts:check']);
    if (contractCheckResult.status !== 0) {
      process.exit(typeof contractCheckResult.status === 'number' ? contractCheckResult.status : 1);
    }
  }

  const scriptTestResult = runRootScriptTests();
  if (scriptTestResult.status !== 0) {
    process.exit(typeof scriptTestResult.status === 'number' ? scriptTestResult.status : 1);
  }

  const result = run(PNPM_BIN, ['-r', 'test']);
  process.exit(typeof result.status === 'number' ? result.status : 1);
}

const filteredArgs = args.filter((arg) => arg !== '--');
if (filteredArgs.length === 1) {
  const esbuildPreflightResult = runEsbuildPreflight();
  if (esbuildPreflightResult.status !== 0) {
    process.exit(typeof esbuildPreflightResult.status === 'number' ? esbuildPreflightResult.status : 1);
  }

  if (filteredArgs[0] === 'agent') {
    const result = runTargetedAgentDryRun();
    process.exit(typeof result.status === 'number' ? result.status : 1);
  }

  const steps = targetedSmokeRuns.get(filteredArgs[0]);
  if (steps) {
    const result = runSteps(steps);
    process.exit(typeof result.status === 'number' ? result.status : 1);
  }
}

const esbuildPreflightResult = runEsbuildPreflight();
if (esbuildPreflightResult.status !== 0) {
  process.exit(typeof esbuildPreflightResult.status === 'number' ? esbuildPreflightResult.status : 1);
}

const result = run(PNPM_BIN, ['-C', 'packages/cli', 'test', '--', ...args]);
process.exit(typeof result.status === 'number' ? result.status : 1);
