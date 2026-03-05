#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const cliEntrypoint = path.join(repoRoot, 'packages', 'cli', 'dist', 'main.js');

if (!existsSync(cliEntrypoint)) {
  console.error('Playbook CLI not built. Run: pnpm build');
  process.exit(1);
}

const args = process.argv.slice(2);
const normalizedArgs = args[0] === '--' ? args.slice(1) : args;

const result = spawnSync(process.execPath, [cliEntrypoint, ...normalizedArgs], {
  stdio: 'inherit',
});

if (typeof result.status === 'number') {
  process.exit(result.status);
}

process.exit(1);
