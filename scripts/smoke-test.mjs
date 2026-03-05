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

run(nodeBin, [cliPath, '--help'], { stdio: 'inherit' });

const tempRoot = path.join(os.tmpdir(), `playbook-smoke-${Date.now()}`);
fs.mkdirSync(tempRoot, { recursive: true });

let smokePassed = false;
try {
  run('git', ['init', '-b', 'main'], { cwd: tempRoot, stdio: 'ignore' });
  run('git', ['config', 'user.email', 'smoke@example.com'], { cwd: tempRoot });
  run('git', ['config', 'user.name', 'Smoke Test'], { cwd: tempRoot });

  run(nodeBin, [cliPath, 'init'], { cwd: tempRoot, stdio: 'inherit' });
  run('git', ['add', '.'], { cwd: tempRoot });
  run('git', ['commit', '-m', 'init'], { cwd: tempRoot, stdio: 'ignore' });

  fs.mkdirSync(path.join(tempRoot, 'src'), { recursive: true });
  fs.writeFileSync(path.join(tempRoot, 'src/foo.ts'), 'export const x = 1;\n');
  run('git', ['add', '.'], { cwd: tempRoot });
  run('git', ['commit', '-m', 'feat: change code'], { cwd: tempRoot, stdio: 'ignore' });

  let failedAsExpected = false;
  let unexpectedVerifyOutput = '';
  try {
    unexpectedVerifyOutput = run(nodeBin, [cliPath, 'verify'], {
      cwd: tempRoot
    });
  } catch {
    failedAsExpected = true;
  }

  if (!failedAsExpected) {
    const details = unexpectedVerifyOutput.trim()
      ? `\nverify output:\n${unexpectedVerifyOutput.trim()}`
      : '';
    throw new Error(`Expected verify to fail before notes update.${details}`);
  }

  fs.appendFileSync(
    path.join(tempRoot, 'docs/PLAYBOOK_NOTES.md'),
    '\n- WHAT changed: Added src/foo.ts\n- WHY it changed: Smoke test\n'
  );
  run('git', ['add', '.'], { cwd: tempRoot });
  run('git', ['commit', '-m', 'docs: notes'], { cwd: tempRoot, stdio: 'ignore' });

  run(nodeBin, [cliPath, 'verify'], { cwd: tempRoot, stdio: 'inherit' });
  smokePassed = true;
  console.log('[smoke] passed');
} finally {
  if (smokePassed) {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  } else {
    console.log(`[smoke] retained temp repo for debugging: ${tempRoot}`);
  }
}
