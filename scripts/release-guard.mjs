#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const run = (command, args) => {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

run('pnpm', ['playbook', 'release', 'plan', '--json', '--out', '.playbook/release-plan.json']);

const planPath = '.playbook/release-plan.json';
if (!existsSync(planPath)) {
  console.error('❌ release-guard: missing .playbook/release-plan.json after release plan.');
  process.exit(1);
}

const plan = JSON.parse(readFileSync(planPath, 'utf8'));
const recommendedBump = String(plan?.summary?.recommendedBump ?? 'none');

if (recommendedBump !== 'none') {
  console.log(`🔄 release-guard: recommended bump=${recommendedBump}; applying release sync.`);
  run('pnpm', ['release:sync']);
  run('git', ['add', '-A']);
} else {
  console.log('✅ release-guard: recommended bump=none; no release sync mutation needed.');
}

run('pnpm', ['playbook', 'release', 'sync', '--check', '--json', '--out', '.playbook/release-plan.json']);
console.log('✅ release-guard: release sync check clean.');
