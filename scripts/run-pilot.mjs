#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
<<<<<<< HEAD

const rawArgs = process.argv.slice(2);
const args = rawArgs[0] === '--' ? rawArgs.slice(1) : rawArgs;
const targetRepo = args[0];
const passthroughArgs = args.slice(1);

if (!targetRepo) {
  console.error('Usage: pnpm pilot "<target-repo-path>" [--json]');
  process.exit(1);
}

const pnpmBin = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const result = spawnSync(pnpmBin, ['playbook', 'pilot', '--repo', targetRepo, ...passthroughArgs], {
  stdio: 'inherit'
=======
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const targetRepo = process.argv[2];
if (!targetRepo) {
  console.error('Usage: pnpm pilot "<target-repo-path>"');
  process.exit(1);
}

const result = spawnSync('pnpm', ['playbook', 'pilot', '--repo', targetRepo, ...process.argv.slice(3)], {
  cwd: repoRoot,
  stdio: 'inherit',
  shell: process.platform === 'win32'
>>>>>>> e7e6212fdfca535a8bea181c1e417bbc752efb88
});

if (typeof result.status === 'number') {
  process.exit(result.status);
}

process.exit(1);
