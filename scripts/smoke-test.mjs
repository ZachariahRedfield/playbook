import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { PNPM_BIN, run } from './exec-runner.mjs';

const repoRoot = path.resolve('.');
const nodeBin = process.execPath;
const cliPath = path.resolve(repoRoot, 'packages/cli/dist/main.js');
const bundledTemplatePath = path.resolve(repoRoot, 'packages/cli/dist/templates/repo');
const nodeVersion = run(nodeBin, ['-v']).trim();
const pnpmVersion = run(PNPM_BIN, ['-v']).trim();

const ensureFile = (filePath, label) => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`smoke-test failed: missing ${label} at ${filePath}`);
  }
};

const ensurePlaybookConfig = (projectRoot) => {
  const configCandidates = [
    path.join(projectRoot, 'playbook.config.json'),
    path.join(projectRoot, '.playbook', 'config.json')
  ];

  if (!configCandidates.some((configPath) => fs.existsSync(configPath))) {
    throw new Error(
      'smoke-test failed: expected init to create playbook config file (playbook.config.json or .playbook/config.json)'
    );
  }
};

console.log(`[smoke] node=${nodeVersion} pnpm=${pnpmVersion}`);
console.log(`[smoke] cli=${cliPath}`);

if (!fs.existsSync(cliPath)) {
  const msg =
    'packages/cli/dist/main.js missing. ' +
    'Run "pnpm -r build" to generate CLI dist output before smoke-test.';
  if (process.env.GITHUB_ACTIONS === 'true') {
    throw new Error(`smoke-test failed: ${msg}`);
  }
  console.log(`[smoke] skipped: ${msg}`);
  process.exit(0);
}

if (!fs.existsSync(bundledTemplatePath)) {
  throw new Error(
    `smoke-test failed: bundled templates missing at ${bundledTemplatePath}. ` +
      'Run "pnpm -r build" before smoke-test.'
  );
}

run(nodeBin, [cliPath, '--help']);

const runWithStatus = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    ...options,
    env: { ...process.env, ...(options.env ?? {}) }
  });

  if (result.error) {
    throw result.error;
  }

  return {
    status: typeof result.status === 'number' ? result.status : 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? ''
  };
};

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-smoke-'));
const projectDir = path.join(tempRoot, 'project');
const doctorFixProjectDir = path.join(tempRoot, 'doctor-fix-project');
fs.mkdirSync(projectDir, { recursive: true });
fs.mkdirSync(doctorFixProjectDir, { recursive: true });

let smokePassed = false;
try {
  fs.writeFileSync(
    path.join(projectDir, 'package.json'),
    JSON.stringify({ name: 'playbook-smoke', private: true, version: '1.0.0' }, null, 2)
  );

  fs.writeFileSync(
    path.join(doctorFixProjectDir, 'package.json'),
    JSON.stringify({ name: 'playbook-smoke-doctor-fix', private: true, version: '1.0.0' }, null, 2)
  );

  run(nodeBin, [cliPath, 'init'], { cwd: projectDir });
  run(nodeBin, [cliPath, 'analyze'], { cwd: projectDir });

  const analyzeJson = runWithStatus(nodeBin, [cliPath, 'analyze', '--json', '--explain'], { cwd: projectDir });
  const analyzeJsonResult = JSON.parse(analyzeJson.stdout);

  const noSignalsRecommendation = Array.isArray(analyzeJsonResult.findings)
    ? analyzeJsonResult.findings.find((finding) => finding.id === 'analyze.recommendation.analyze-no-signals')
    : undefined;

  if (!noSignalsRecommendation) {
    throw new Error('smoke-test failed: expected analyze --json --explain to include analyze.recommendation.analyze-no-signals finding');
  }

  run(nodeBin, [cliPath, 'verify'], { cwd: projectDir });
  run(nodeBin, [cliPath, 'plan'], { cwd: projectDir });
  run(nodeBin, [cliPath, 'apply'], { cwd: projectDir });
  run(nodeBin, [cliPath, 'status'], { cwd: projectDir });


  const applyJson = runWithStatus(nodeBin, [cliPath, 'apply', '--json'], { cwd: projectDir });
  const applyJsonResult = JSON.parse(applyJson.stdout);

  if (applyJsonResult.schemaVersion !== '1.0' || applyJsonResult.command !== 'apply' || !Array.isArray(applyJsonResult.results)) {
    throw new Error('smoke-test failed: expected apply --json to return schemaVersion=1.0, command=apply, and results array');
  }

  const planJson = runWithStatus(nodeBin, [cliPath, 'plan', '--json'], { cwd: projectDir });
  const planJsonResult = JSON.parse(planJson.stdout);

  if (planJsonResult.schemaVersion !== '1.0' || planJsonResult.command !== 'plan' || !Array.isArray(planJsonResult.tasks)) {
    throw new Error('smoke-test failed: expected plan --json to return schemaVersion=1.0, command=plan, and tasks array');
  }

  const rulesJson = runWithStatus(nodeBin, [cliPath, 'rules', '--json'], { cwd: projectDir });
  const rulesJsonResult = JSON.parse(rulesJson.stdout);

  if (!Array.isArray(rulesJsonResult.verify) || !Array.isArray(rulesJsonResult.analyze)) {
    throw new Error('smoke-test failed: expected rules --json to include verify and analyze arrays');
  }

  const explainJson = runWithStatus(nodeBin, [cliPath, 'explain', 'notes.missing', '--json'], { cwd: projectDir });
  const explainJsonResult = JSON.parse(explainJson.stdout);

  if (explainJsonResult.rule?.id !== 'notes.missing') {
    throw new Error('smoke-test failed: expected explain notes.missing --json to include rule.id=notes.missing');
  }

  const statusJsonHealthy = runWithStatus(nodeBin, [cliPath, 'status', '--json'], { cwd: projectDir });
  const statusJsonHealthyResult = JSON.parse(statusJsonHealthy.stdout);

  if (statusJsonHealthyResult.schemaVersion !== '1.0') {
    throw new Error(`smoke-test failed: expected status --json schemaVersion=1.0, got ${String(statusJsonHealthyResult.schemaVersion)}`);
  }

  if (statusJsonHealthyResult.command !== 'status') {
    throw new Error(`smoke-test failed: expected status --json command=status, got ${String(statusJsonHealthyResult.command)}`);
  }

  fs.writeFileSync(path.join(projectDir, 'docs', 'PLAYBOOK_NOTES.md'), '', 'utf8');
  const verifyJson = runWithStatus(nodeBin, [cliPath, 'verify', '--json', '--explain'], { cwd: projectDir });
  const verifyJsonResult = JSON.parse(verifyJson.stdout);

  if (typeof verifyJsonResult.ok !== 'boolean') {
    throw new Error(`smoke-test failed: expected verify --json ok to be boolean, got ${String(verifyJsonResult.ok)}`);
  }

  if (verifyJsonResult.exitCode !== verifyJson.status) {
    throw new Error(
      `smoke-test failed: verify --json exitCode (${verifyJsonResult.exitCode}) did not match process exit status (${verifyJson.status})`
    );
  }


  if (!Array.isArray(verifyJsonResult.findings)) {
    throw new Error('smoke-test failed: verify findings missing');
  }

  if (verifyJsonResult.ok === false && verifyJsonResult.findings.length === 0) {
    throw new Error('smoke-test failed: expected verify --json --explain to include findings when ok=false');
  }

  const malformedFinding = verifyJsonResult.findings.find(
    (finding) => typeof finding?.id !== 'string' || finding.id.length === 0 || typeof finding?.level !== 'string'
  );

  if (malformedFinding) {
    throw new Error('smoke-test failed: expected verify --json findings to include id and level fields');
  }

  const statusJsonAfterVerify = runWithStatus(nodeBin, [cliPath, 'status', '--json'], { cwd: projectDir });
  const statusJsonAfterVerifyResult = JSON.parse(statusJsonAfterVerify.stdout);

  if (verifyJsonResult.ok === false) {
    if (statusJsonAfterVerify.status !== 3) {
      throw new Error(`smoke-test failed: expected status --json exit status=3 when verify fails, got ${statusJsonAfterVerify.status}`);
    }

    if (statusJsonAfterVerifyResult.verification?.ok !== false) {
      throw new Error(`smoke-test failed: expected status --json verification.ok=false, got ${String(statusJsonAfterVerifyResult.verification?.ok)}`);
    }
  }

  const doctorJsonReport = runWithStatus(nodeBin, [cliPath, 'doctor', '--json'], {
    cwd: projectDir,
    env: { PATH: '' }
  });
  const doctorJsonReportResult = JSON.parse(doctorJsonReport.stdout);

  if (doctorJsonReport.status !== 0) {
    throw new Error(`smoke-test failed: expected doctor --json exit status=0 when doctor reports issues, got ${doctorJsonReport.status}`);
  }

  if (doctorJsonReportResult.command !== 'doctor') {
    throw new Error(`smoke-test failed: expected doctor --json command=doctor, got ${String(doctorJsonReportResult.command)}`);
  }

  if (typeof doctorJsonReportResult.framework !== 'string' || typeof doctorJsonReportResult.architecture !== 'string') {
    throw new Error('smoke-test failed: expected doctor --json to include framework and architecture strings');
  }

  if (!Array.isArray(doctorJsonReportResult.issues) || !Array.isArray(doctorJsonReportResult.suggestedActions)) {
    throw new Error('smoke-test failed: expected doctor --json to include issues and suggestedActions arrays');
  }

  if (doctorJsonReportResult.issues.length === 0) {
    throw new Error('smoke-test failed: expected doctor --json to report issues for incomplete repository state');
  }


  const upgradePlanJson = runWithStatus(nodeBin, [cliPath, 'upgrade', '--json'], { cwd: projectDir });
  const upgradePlanResult = JSON.parse(upgradePlanJson.stdout);

  if (upgradePlanResult.schemaVersion !== '1.0' || upgradePlanResult.command !== 'upgrade') {
    throw new Error('smoke-test failed: expected upgrade --json to return schemaVersion=1.0 and command=upgrade');
  }

  const upgradeCheckJson = runWithStatus(nodeBin, [cliPath, 'upgrade', '--check', '--from', '0.1.0', '--json'], { cwd: projectDir });
  const upgradeCheckResult = JSON.parse(upgradeCheckJson.stdout);

  if (!Array.isArray(upgradeCheckResult.migrationsNeeded)) {
    throw new Error('smoke-test failed: expected upgrade --check --json to include migrationsNeeded array');
  }

  const upgradeApplyDryRunJson = runWithStatus(
    nodeBin,
    [cliPath, 'upgrade', '--apply', '--dry-run', '--from', '0.1.0', '--json'],
    { cwd: projectDir }
  );
  const upgradeApplyDryRunResult = JSON.parse(upgradeApplyDryRunJson.stdout);

  if (upgradeApplyDryRunResult.dryRun !== true) {
    throw new Error('smoke-test failed: expected upgrade --apply --dry-run --json to return dryRun=true');
  }

  const fixJson = runWithStatus(nodeBin, [cliPath, 'fix', '--json', '--yes'], { cwd: projectDir });
  const fixJsonResult = JSON.parse(fixJson.stdout);

  if (!Array.isArray(fixJsonResult.applied)) {
    throw new Error('smoke-test failed: expected fix --json to include applied array');
  }

  const notesPath = path.join(projectDir, 'docs', 'PLAYBOOK_NOTES.md');
  if (!fs.existsSync(notesPath)) {
    throw new Error('smoke-test failed: expected fix to create docs/PLAYBOOK_NOTES.md');
  }

  if (verifyJsonResult.ok === false) {
    const appliedFindingIds = fixJsonResult.applied.map((entry) => entry.findingId);
    if (!appliedFindingIds.includes('notes.empty') && !appliedFindingIds.includes('notes.missing')) {
      throw new Error('smoke-test failed: expected fix --json to apply notes.empty or notes.missing when verify fails');
    }

    const notesContent = fs.readFileSync(notesPath, 'utf8');
    if (notesContent.trim().length === 0) {
      throw new Error('smoke-test failed: expected docs/PLAYBOOK_NOTES.md to be non-empty after fix when verify fails');
    }
  }

  const doctorFixJson = runWithStatus(nodeBin, [cliPath, 'doctor', '--fix', '--yes', '--json'], {
    cwd: doctorFixProjectDir
  });
  const doctorFixJsonResult = JSON.parse(doctorFixJson.stdout);

  if (!Array.isArray(doctorFixJsonResult.applied)) {
    throw new Error('smoke-test failed: expected doctor --fix --json to include an applied array');
  }

  if (!fs.existsSync(path.join(doctorFixProjectDir, 'docs'))) {
    throw new Error('smoke-test failed: expected doctor --fix to create docs directory');
  }

  if (typeof fixJsonResult.reverify?.exitCode !== 'number') {
    throw new Error('smoke-test failed: expected fix --json to include numeric reverify exitCode');
  }

  if (verifyJsonResult.ok === false && fixJsonResult.reverify.exitCode === 3) {
    throw new Error(`smoke-test failed: expected fix --json reverify exitCode to not be 3 when verify fails, got ${String(fixJsonResult.reverify?.exitCode)}`);
  }

  ensurePlaybookConfig(projectDir);

  ensureFile(path.join(projectDir, 'docs', 'PLAYBOOK_NOTES.md'), 'docs/PLAYBOOK_NOTES.md');

  smokePassed = true;
  console.log('[smoke] passed');
} finally {
  if (smokePassed) {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  } else {
    console.log(`[smoke] retained temp repo for debugging: ${tempRoot}`);
  }
}
