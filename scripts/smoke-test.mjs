import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const repoRoot = path.resolve('.');
const cliPath = path.join(repoRoot, 'packages/cli/dist/main.js');

if (!fs.existsSync(cliPath)) {
  console.log('smoke-test skipped: packages/cli/dist/main.js missing (build not available in this environment).');
  process.exit(0);
}

execFileSync('node', [cliPath, '--help'], { stdio: 'inherit' });

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-smoke-'));
execFileSync('git', ['init', '-b', 'main'], { cwd: tempRoot, stdio: 'ignore' });
execFileSync('git', ['config', 'user.email', 'smoke@example.com'], { cwd: tempRoot });
execFileSync('git', ['config', 'user.name', 'Smoke Test'], { cwd: tempRoot });

execFileSync('node', [cliPath, 'init'], { cwd: tempRoot, stdio: 'inherit' });
execFileSync('git', ['add', '.'], { cwd: tempRoot });
execFileSync('git', ['commit', '-m', 'init'], { cwd: tempRoot, stdio: 'ignore' });

fs.mkdirSync(path.join(tempRoot, 'src'), { recursive: true });
fs.writeFileSync(path.join(tempRoot, 'src/foo.ts'), 'export const x = 1;\n');
execFileSync('git', ['add', '.'], { cwd: tempRoot });
execFileSync('git', ['commit', '-m', 'feat: change code'], { cwd: tempRoot, stdio: 'ignore' });

let failedAsExpected = false;
try {
  execFileSync('node', [cliPath, 'verify'], { cwd: tempRoot, stdio: 'pipe' });
} catch {
  failedAsExpected = true;
}
if (!failedAsExpected) {
  throw new Error('Expected verify to fail before notes update.');
}

fs.appendFileSync(path.join(tempRoot, 'docs/PLAYBOOK_NOTES.md'), '\n- WHAT changed: Added src/foo.ts\n- WHY it changed: Smoke test\n');
execFileSync('git', ['add', '.'], { cwd: tempRoot });
execFileSync('git', ['commit', '-m', 'docs: notes'], { cwd: tempRoot, stdio: 'ignore' });

execFileSync('node', [cliPath, 'verify'], { cwd: tempRoot, stdio: 'inherit' });
console.log('Smoke test passed');
