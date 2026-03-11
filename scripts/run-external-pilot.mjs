#!/usr/bin/env node

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const cliEntrypoint = path.join(repoRoot, 'packages', 'cli', 'dist', 'main.js');

if (!existsSync(cliEntrypoint)) {
  console.error('Playbook CLI not built. Run: pnpm -r build');
  process.exit(1);
}

const targetArg = process.argv[2];
if (!targetArg) {
  console.error('Usage: pnpm pilot "<repo-path>"');
  process.exit(1);
}

const targetRepo = path.resolve(process.cwd(), targetArg);
const playbookDir = path.join(targetRepo, '.playbook');
mkdirSync(playbookDir, { recursive: true });

const artifactPaths = {
  repoIndex: path.join(playbookDir, 'repo-index.json'),
  repoGraph: path.join(playbookDir, 'repo-graph.json'),
  findings: path.join(playbookDir, 'findings.json'),
  plan: path.join(playbookDir, 'plan.json')
};

const runJsonCommand = (label, args, fallbackOutPath) => {
  const result = spawnSync(process.execPath, [cliEntrypoint, '--repo', targetRepo, ...args, '--json'], {
    cwd: repoRoot,
    encoding: 'utf8'
  });

  if ((result.status ?? 1) !== 0) {
    process.stderr.write(result.stderr ?? '');
    process.stderr.write(result.stdout ?? '');
    throw new Error(`[Playbook Pilot] ${label} failed with exit code ${String(result.status ?? 1)}.`);
  }

  const stdout = (result.stdout ?? '').trim();
  if (fallbackOutPath && stdout) {
    try {
      const parsed = JSON.parse(stdout);
      writeFileSync(fallbackOutPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
    } catch {
      // ignore fallback writes when stdout includes non-JSON text
    }
  }

  return stdout;
};

console.log('[Playbook Pilot]');
console.log(`Target Repo: ${targetRepo}`);
console.log('');

console.log('Step 1/5: context');
runJsonCommand('context', ['context']);

console.log('Step 2/5: index');
runJsonCommand('index', ['index']);

console.log('Step 3/5: query modules');
runJsonCommand('query modules', ['query', 'modules']);

console.log('Step 4/5: verify');
runJsonCommand('verify', ['verify', '--out', artifactPaths.findings], artifactPaths.findings);

console.log('Step 5/5: plan');
runJsonCommand('plan', ['plan', '--out', artifactPaths.plan], artifactPaths.plan);

if (!existsSync(artifactPaths.repoGraph)) {
  runJsonCommand('graph', ['graph'], artifactPaths.repoGraph);
}

for (const [name, artifactPath] of Object.entries(artifactPaths)) {
  if (!existsSync(artifactPath)) {
    throw new Error(`[Playbook Pilot] expected artifact missing (${name}): ${artifactPath}`);
  }
}

console.log('');
console.log('Artifacts:');
console.log(`- ${artifactPaths.repoIndex}`);
console.log(`- ${artifactPaths.repoGraph}`);
console.log(`- ${artifactPaths.findings}`);
console.log(`- ${artifactPaths.plan}`);
