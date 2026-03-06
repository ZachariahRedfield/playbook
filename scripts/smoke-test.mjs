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
  run(nodeBin, [cliPath, 'verify'], { cwd: projectDir });
  run(nodeBin, [cliPath, 'status'], { cwd: projectDir });


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

  if (verifyJsonResult.ok !== false) {
    throw new Error(`smoke-test failed: expected verify --json ok=false, got ${String(verifyJsonResult.ok)}`);
  }

  if (verifyJsonResult.exitCode !== verifyJson.status) {
    throw new Error(
      `smoke-test failed: verify --json exitCode (${verifyJsonResult.exitCode}) did not match process exit status (${verifyJson.status})`
    );
  }


  const notesEmptyFinding = Array.isArray(verifyJsonResult.findings)
    ? verifyJsonResult.findings.find((finding) => finding.id === 'verify.failure.notes.empty')
    : undefined;

  if (!notesEmptyFinding) {
    throw new Error('smoke-test failed: expected verify --json --explain to include verify.failure.notes.empty finding');
  }

  if (typeof notesEmptyFinding.explanation !== 'string' || notesEmptyFinding.explanation.length === 0) {
    throw new Error('smoke-test failed: expected verify --json --explain finding to include a non-empty explanation');
  }

  if (!Array.isArray(notesEmptyFinding.remediation) || notesEmptyFinding.remediation.length === 0) {
    throw new Error('smoke-test failed: expected verify --json --explain finding to include remediation steps');
  }

  const statusJsonVerifyFail = runWithStatus(nodeBin, [cliPath, 'status', '--json'], { cwd: projectDir });
  const statusJsonVerifyFailResult = JSON.parse(statusJsonVerifyFail.stdout);

  if (statusJsonVerifyFail.status !== 3) {
    throw new Error(`smoke-test failed: expected status --json exit status=3 when verify fails, got ${statusJsonVerifyFail.status}`);
  }

  if (statusJsonVerifyFailResult.verification?.ok !== false) {
    throw new Error(`smoke-test failed: expected status --json verification.ok=false, got ${String(statusJsonVerifyFailResult.verification?.ok)}`);
  }

  const statusJsonDoctorFail = runWithStatus(nodeBin, [cliPath, 'status', '--json'], {
    cwd: projectDir,
    env: { PATH: '' }
  });
  const statusJsonDoctorFailResult = JSON.parse(statusJsonDoctorFail.stdout);

  if (statusJsonDoctorFail.status !== 2) {
    throw new Error(`smoke-test failed: expected status --json exit status=2 when doctor fails, got ${statusJsonDoctorFail.status}`);
  }

  if (statusJsonDoctorFailResult.environment?.ok !== false) {
    throw new Error(`smoke-test failed: expected status --json environment.ok=false, got ${String(statusJsonDoctorFailResult.environment?.ok)}`);
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

  const appliedFindingIds = fixJsonResult.applied.map((entry) => entry.findingId);
  if (!appliedFindingIds.includes('notes.empty') && !appliedFindingIds.includes('notes.missing')) {
    throw new Error('smoke-test failed: expected fix --json to apply notes.empty or notes.missing');
  }

  const notesPath = path.join(projectDir, 'docs', 'PLAYBOOK_NOTES.md');
  if (!fs.existsSync(notesPath)) {
    throw new Error('smoke-test failed: expected fix to create docs/PLAYBOOK_NOTES.md');
  }

  const notesContent = fs.readFileSync(notesPath, 'utf8');
  if (notesContent.trim().length === 0) {
    throw new Error('smoke-test failed: expected docs/PLAYBOOK_NOTES.md to be non-empty after fix');
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

  if (typeof fixJsonResult.reverify?.exitCode !== 'number' || fixJsonResult.reverify.exitCode === 3) {
    throw new Error(`smoke-test failed: expected fix --json reverify exitCode to not be 3, got ${String(fixJsonResult.reverify?.exitCode)}`);
  }

  ensureFile(path.join(projectDir, 'playbook.config.json'), 'playbook.config.json');
  ensureFile(path.join(projectDir, 'docs', 'PLAYBOOK_NOTES.md'), 'docs/PLAYBOOK_NOTES.md');
  ensureFile(path.join(projectDir, 'docs', 'PROJECT_GOVERNANCE.md'), 'docs/PROJECT_GOVERNANCE.md');

  smokePassed = true;
  console.log('[smoke] passed');
} finally {
  if (smokePassed) {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  } else {
    console.log(`[smoke] retained temp repo for debugging: ${tempRoot}`);
  }
}
