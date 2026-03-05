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
fs.mkdirSync(projectDir, { recursive: true });

let smokePassed = false;
try {
  fs.writeFileSync(
    path.join(projectDir, 'package.json'),
    JSON.stringify({ name: 'playbook-smoke', private: true, version: '1.0.0' }, null, 2)
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
  const verifyJson = runWithStatus(nodeBin, [cliPath, 'verify', '--json'], { cwd: projectDir });
  const verifyJsonResult = JSON.parse(verifyJson.stdout);

  if (verifyJsonResult.ok !== false) {
    throw new Error(`smoke-test failed: expected verify --json ok=false, got ${String(verifyJsonResult.ok)}`);
  }

  if (verifyJsonResult.exitCode !== verifyJson.status) {
    throw new Error(
      `smoke-test failed: verify --json exitCode (${verifyJsonResult.exitCode}) did not match process exit status (${verifyJson.status})`
    );
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
