#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const DEMO_REPO_URL = process.env.PLAYBOOK_DEMO_REPO_URL ?? 'https://github.com/ZachariahRedfield/playbook-demo.git';
const DEMO_REPO_LOCAL_PATH = process.env.PLAYBOOK_DEMO_LOCAL_PATH;
const DEMO_DEBUG = process.env.PLAYBOOK_DEMO_DEBUG === '1';
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

const getFailureLevel = (finding) => {
  if (!finding || typeof finding !== 'object') {
    return false;
  }

  const level = typeof finding.level === 'string' ? finding.level.toLowerCase() : '';
  return level === 'failure' || level === 'error';
};

export const deriveVerifyCounts = (verifyPayload) => {
  if (!verifyPayload || typeof verifyPayload !== 'object') {
    return { findings: 0, failures: 0, warnings: 0 };
  }

  const findingsArray = Array.isArray(verifyPayload.findings) ? verifyPayload.findings : [];
  const failuresArray = Array.isArray(verifyPayload.failures) ? verifyPayload.failures : [];
  const warningsArray = Array.isArray(verifyPayload.warnings) ? verifyPayload.warnings : [];
  const summary = verifyPayload.summary && typeof verifyPayload.summary === 'object' ? verifyPayload.summary : {};

  const findingCountCandidates = [findingsArray.length, failuresArray.length + warningsArray.length];
  const summaryWarnings = Number.isInteger(summary.warnings) && summary.warnings >= 0 ? summary.warnings : undefined;
  const summaryFailures = Number.isInteger(summary.failures) && summary.failures >= 0 ? summary.failures : undefined;
  if (summaryWarnings !== undefined || summaryFailures !== undefined) {
    findingCountCandidates.push((summaryWarnings ?? 0) + (summaryFailures ?? 0));
  }

  const failureCountCandidates = [failuresArray.length, findingsArray.filter(getFailureLevel).length];
  if (summaryFailures !== undefined) {
    failureCountCandidates.push(summaryFailures);
  }

  const warningCountCandidates = [warningsArray.length, findingsArray.length - findingsArray.filter(getFailureLevel).length];
  if (summaryWarnings !== undefined) {
    warningCountCandidates.push(summaryWarnings);
  }

  return {
    findings: Math.max(...findingCountCandidates),
    failures: Math.max(...failureCountCandidates),
    warnings: Math.max(...warningCountCandidates)
  };
};

export const validateRemediationStatus = ({ remediationStatus, planSteps, initialFailures }) => {
  if (remediationStatus === 'ready' && planSteps <= 0) {
    throw new Error('Plan reported ready remediation but did not include any steps.');
  }

  if (remediationStatus === 'not_needed' && initialFailures > 0) {
    throw new Error('Plan reported not_needed remediation despite initial verify failures.');
  }

  if (remediationStatus === 'unavailable' && initialFailures <= 0) {
    throw new Error('Plan reported unavailable remediation despite no initial verify failures.');
  }

  if (remediationStatus === 'ready' && initialFailures <= 0) {
    throw new Error('Plan reported ready remediation despite no initial verify failures.');
  }

  if (remediationStatus === 'unavailable' && planSteps > 0) {
    throw new Error('Plan reported unavailable remediation despite including remediation steps.');
  }
};

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

  if (DEMO_REPO_LOCAL_PATH) {
    run({ cwd: tempRoot, command: 'cp', args: ['-R', DEMO_REPO_LOCAL_PATH, demoDir] });
  } else {
    run({ cwd: tempRoot, command: 'git', args: ['clone', '--depth', '1', DEMO_REPO_URL, demoDir] });
  }
  installDemoDependencies(demoDir);

  runPlaybookCli({ cwd: demoDir, commandArgs: ['analyze'] });
  console.log('Analyze: OK');

  const initialVerifyResult = runPlaybookCli({ cwd: demoDir, commandArgs: ['verify', '--json'], expectSuccess: false });
  const initialVerify = parseJsonOutput(initialVerifyResult.stdout, 'Initial verify');
  if (DEMO_DEBUG) {
    console.log('Initial verify payload:');
    console.log(JSON.stringify(initialVerify, null, 2));
  }
  const initialVerifyCounts = deriveVerifyCounts(initialVerify);
  const initialFindings = initialVerifyCounts.findings;
  const initialFailures = initialVerifyCounts.failures;
  if (initialFindings <= 0) {
    throw new Error('Initial verify must report at least one finding.');
  }
  console.log(
    `Verify (initial): ${initialFindings} findings (${initialFailures} failures, ${initialVerifyCounts.warnings} warnings)`
  );

  const planResult = runPlaybookCli({ cwd: demoDir, commandArgs: ['plan', '--json'] });
  const plan = parseJsonOutput(planResult.stdout, 'Plan');
  if (DEMO_DEBUG) {
    console.log('Plan payload:');
    console.log(JSON.stringify(plan, null, 2));
  }
  const remediation = plan.remediation;
  if (!remediation || typeof remediation !== 'object') {
    throw new Error('Plan JSON contract is missing remediation object.');
  }

  const planSteps = remediation.totalSteps;
  const unresolvedFailures = remediation.unresolvedFailures;
  const remediationStatus = remediation.status;

  if (!Number.isInteger(planSteps) || planSteps < 0) {
    throw new Error('Plan JSON contract has invalid remediation.totalSteps.');
  }

  if (!Number.isInteger(unresolvedFailures) || unresolvedFailures < 0) {
    throw new Error('Plan JSON contract has invalid remediation.unresolvedFailures.');
  }

  if (remediationStatus !== 'ready' && remediationStatus !== 'not_needed' && remediationStatus !== 'unavailable') {
    throw new Error('Plan JSON contract has invalid remediation.status.');
  }

  if (remediationStatus === 'unavailable') {
    const reason = typeof remediation.reason === 'string' ? remediation.reason : 'No reason provided.';
    throw new Error(`Plan reported unavailable remediation: ${reason}`);
  }

  if (remediationStatus === 'not_needed' && initialFailures > 0) {
    console.error('Demo validate debug payloads (not_needed with verify failures):');
    console.error(
      JSON.stringify(
        {
          initialVerify,
          plan
        },
        null,
        2
      )
    );
  }

  validateRemediationStatus({ remediationStatus, planSteps, initialFailures });

  console.log(`Plan: ${planSteps} fixes (${remediationStatus})`);

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

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
