#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const DEMO_REPO_URL = process.env.PLAYBOOK_DEMO_REPO_URL ?? 'https://github.com/ZachariahRedfield/playbook-demo.git';
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const localCliEntrypoint = path.resolve(projectRoot, 'packages/cli/dist/main.js');

const run = ({ cwd, command, args, allowFailure = false }) => {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });

  if (!allowFailure && result.status !== 0) {
    const stderr = result.stderr?.trim();
    const stdout = result.stdout?.trim();
    const details = [stderr, stdout].filter(Boolean).join('\n');
    throw new Error(`Command failed (${command} ${args.join(' ')}):\n${details}`);
  }

  return result;
};

const parseJsonOutput = (rawOutput, label) => {
  try {
    return JSON.parse(rawOutput);
  } catch {
    throw new Error(`${label} did not emit valid JSON output.`);
  }
};

const installDemoDependencies = (demoDir) => {
  const hasPnpmLock = fs.existsSync(path.join(demoDir, 'pnpm-lock.yaml'));
  const hasPackageLock = fs.existsSync(path.join(demoDir, 'package-lock.json'));
  const hasYarnLock = fs.existsSync(path.join(demoDir, 'yarn.lock'));

  if (hasPnpmLock) {
    run({ cwd: demoDir, command: 'pnpm', args: ['install', '--frozen-lockfile'] });
    return;
  }

  if (hasPackageLock) {
    run({ cwd: demoDir, command: 'npm', args: ['ci'] });
    return;
  }

  if (hasYarnLock) {
    run({ cwd: demoDir, command: 'yarn', args: ['install', '--frozen-lockfile'] });
    return;
  }

  if (fs.existsSync(path.join(demoDir, 'package.json'))) {
    run({ cwd: demoDir, command: 'npm', args: ['install'] });
  }
};

const runPlaybookCli = ({ cwd, commandArgs, expectSuccess = true }) =>
  run({
    cwd,
    command: 'node',
    args: [localCliEntrypoint, ...commandArgs],
    allowFailure: !expectSuccess
  });

const main = () => {
  if (!fs.existsSync(localCliEntrypoint)) {
    throw new Error(
      `Local Playbook CLI build is missing at ${localCliEntrypoint}. Build the workspace first (pnpm -r build).`
    );
  }

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-demo-validate-'));
  const demoDir = path.join(tempRoot, 'playbook-demo');

  console.log('Playbook Demo Validation');
  console.log('');

  run({ cwd: tempRoot, command: 'git', args: ['clone', '--depth', '1', DEMO_REPO_URL, demoDir] });
  installDemoDependencies(demoDir);

  runPlaybookCli({ cwd: demoDir, commandArgs: ['analyze'] });
  console.log('Analyze: OK');

  const initialVerifyResult = runPlaybookCli({ cwd: demoDir, commandArgs: ['verify', '--json'], expectSuccess: false });
  const initialVerify = parseJsonOutput(initialVerifyResult.stdout, 'Initial verify');
  const initialFindings = Array.isArray(initialVerify.findings) ? initialVerify.findings.length : 0;
  if (initialFindings <= 0) {
    throw new Error('Initial verify must report at least one finding.');
  }
  console.log(`Verify (initial): ${initialFindings} findings`);

  const planResult = runPlaybookCli({ cwd: demoDir, commandArgs: ['plan', '--json'] });
  const plan = parseJsonOutput(planResult.stdout, 'Plan');
  const remediation = plan.remediation;
  const planSteps = remediation && typeof remediation.totalSteps === 'number' ? remediation.totalSteps : -1;
  const remediationStatus = remediation && typeof remediation.status === 'string' ? remediation.status : 'unknown';

  if (planSteps < 0) {
    throw new Error('Plan JSON contract is missing remediation.totalSteps.');
  }

  if (initialFindings > 0 && remediationStatus === 'unavailable') {
    const reason = remediation && typeof remediation.reason === 'string' ? remediation.reason : 'No reason provided.';
    throw new Error(`Plan reported unavailable remediation: ${reason}`);
  }

  if (initialFindings > 0 && planSteps <= 0) {
    throw new Error('Plan must report at least one remediation step.');
  }

  console.log(`Plan: ${planSteps} fixes`);

  runPlaybookCli({ cwd: demoDir, commandArgs: ['apply'] });
  console.log('Apply: OK');

  const finalVerifyResult = runPlaybookCli({ cwd: demoDir, commandArgs: ['verify', '--json'], expectSuccess: false });
  const finalVerify = parseJsonOutput(finalVerifyResult.stdout, 'Final verify');
  const finalFindings = Array.isArray(finalVerify.findings) ? finalVerify.findings.length : 0;
  if (finalFindings !== 0) {
    throw new Error(`Final verify must be clean, found ${finalFindings} finding(s).`);
  }
  console.log('Verify (final): clean');
  console.log('');
  console.log('Demo validation passed');
};

main();
