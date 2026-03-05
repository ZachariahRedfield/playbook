import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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
