#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertLocalCliBuild,
  cloneDemoRepository,
  installNodeDependencies,
  runPlaybookCli
} from './demo-repo-utils.mjs';

const DEMO_REPO_URL = process.env.PLAYBOOK_DEMO_REPO_URL ?? 'https://github.com/ZachariahRedfield/playbook-demo.git';
const DEMO_REPO_LOCAL_PATH = process.env.PLAYBOOK_DEMO_LOCAL_PATH;
const DEMO_DEBUG = process.env.PLAYBOOK_DEMO_DEBUG === '1';

const parseJsonOutput = (rawOutput, label) => {
  try {
    return JSON.parse(rawOutput);
  } catch {
    throw new Error(`${label} did not emit valid JSON output.`);
  }
};


export const ensureDemoFeatureModules = (modulesPayload) => {
  if (!modulesPayload || typeof modulesPayload !== 'object' || !Array.isArray(modulesPayload.result)) {
    throw new Error('Query modules JSON contract is missing result array.');
  }

  const moduleNames = modulesPayload.result
    .map((entry) => (entry && typeof entry === 'object' ? entry.name : undefined))
    .filter((name) => typeof name === 'string');

  for (const expectedModule of ['users', 'workouts']) {
    if (!moduleNames.includes(expectedModule)) {
      throw new Error(
        `Demo module contract failed: expected indexed module "${expectedModule}" in query modules output. Found: ${moduleNames.join(', ') || 'none'}.`
      );
    }
  }
};

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

export const validateFinalVerifyStatus = ({ finalVerifyCounts }) => {
  if (finalVerifyCounts.failures > 0) {
    throw new Error(
      `Final verify still has ${finalVerifyCounts.failures} failure(s) (${finalVerifyCounts.warnings} warning(s), ${finalVerifyCounts.findings} total finding(s)).`
    );
  }
};

const main = () => {
  assertLocalCliBuild();

  const { demoDir } = cloneDemoRepository({
    repoUrl: DEMO_REPO_URL,
    localPath: DEMO_REPO_LOCAL_PATH,
    prefix: 'playbook-demo-validate'
  });

  console.log('Playbook Demo Validation');
  console.log('');

  installNodeDependencies(demoDir);

  runPlaybookCli({ cwd: demoDir, commandArgs: ['index', '--json'] });
  console.log('Index: OK');

  const queryModulesResult = runPlaybookCli({ cwd: demoDir, commandArgs: ['query', 'modules', '--json'] });
  const modulesPayload = parseJsonOutput(queryModulesResult.stdout, 'Query modules');
  ensureDemoFeatureModules(modulesPayload);
  console.log('Query modules: OK (users, workouts)');

  runPlaybookCli({ cwd: demoDir, commandArgs: ['explain', 'workouts', '--json'] });
  console.log('Explain workouts: OK');

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
  const finalVerifyCounts = deriveVerifyCounts(finalVerify);
  validateFinalVerifyStatus({ finalVerifyCounts });
  console.log(
    `Verify (final): ${finalVerifyCounts.findings} findings (${finalVerifyCounts.failures} failures, ${finalVerifyCounts.warnings} warnings)`
  );
  console.log('');
  console.log('Demo validation passed');
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
