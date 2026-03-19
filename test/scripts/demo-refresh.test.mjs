import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { writeCommandTruthContract } from '../../scripts/managed-docs-lib.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const demoRefreshScript = path.join(repoRoot, 'scripts', 'demo-refresh.mjs');
const cliPath = path.join(repoRoot, 'packages', 'cli', 'dist', 'main.js');

const requiredAnchorFiles = [
  'README.md',
  'AGENTS.md',
  'docs/index.md',
  'docs/ARCHITECTURE.md',
  'docs/commands/README.md',
  'docs/PLAYBOOK_PRODUCT_ROADMAP.md',
  'docs/PLAYBOOK_BUSINESS_STRATEGY.md',
  'docs/CONSUMER_INTEGRATION_CONTRACT.md',
  'docs/roadmap/README.md',
  'docs/roadmap/ROADMAP.json',
  'docs/roadmap/IMPROVEMENTS_BACKLOG.md',
  'docs/archive/README.md',
  'packages/cli/README.md'
];

const copyRequiredDocs = (targetRoot) => {
  for (const relativePath of requiredAnchorFiles) {
    const sourcePath = path.join(repoRoot, relativePath);
    const targetPath = path.join(targetRoot, relativePath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);
  }
};

const runNode = (cwd, args, env = {}) =>
  spawnSync('node', args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...env }
  });

const runCommand = (cwd, command, args, env = {}) =>
  spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...env }
  });

const createDemoRepoFixture = (name) => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));
  copyRequiredDocs(fixtureRoot);
  fs.mkdirSync(path.join(fixtureRoot, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(fixtureRoot, '.playbook', 'demo-artifacts'), { recursive: true });
  fs.writeFileSync(
    path.join(fixtureRoot, '.gitignore'),
    [
      'node_modules/',
      '.playbook/doctrine-candidates.json',
      '.playbook/memory/',
      '.playbook/pattern-review-queue.json',
      '.playbook/patterns.json',
      '.playbook/runtime/'
    ].join('\n') + '\n'
  );
  fs.writeFileSync(
    path.join(fixtureRoot, 'package.json'),
    JSON.stringify(
      {
        name,
        version: '0.0.0',
        private: true,
        scripts: {
          'demo:refresh': 'node scripts/refresh-demo-artifacts.mjs'
        }
      },
      null,
      2
    ) + '\n'
  );
  fs.writeFileSync(
    path.join(fixtureRoot, 'scripts', 'refresh-demo-artifacts.mjs'),
    `#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const cliPath = process.env.PLAYBOOK_CLI_PATH;
if (!cliPath) {
  throw new Error('PLAYBOOK_CLI_PATH is required for this fixture.');
}

const result = spawnSync('node', [cliPath, 'doctor', '--json'], {
  cwd: process.cwd(),
  encoding: 'utf8',
  env: process.env
});

if (result.status !== 0) {
  process.stderr.write(result.stderr ?? '');
  process.stdout.write(result.stdout ?? '');
  process.exit(result.status ?? 1);
}

fs.mkdirSync(path.join(process.cwd(), '.playbook', 'demo-artifacts'), { recursive: true });
fs.writeFileSync(path.join(process.cwd(), '.playbook', 'demo-artifacts', 'doctor.txt'), 'doctor ok\\n');
`
  );

  const installResult = runCommand(fixtureRoot, 'npm', ['install', '--package-lock-only'], { npm_config_audit: 'false' });
  assert.equal(installResult.status, 0, installResult.stderr || installResult.stdout);

  const initResult = runCommand(fixtureRoot, 'git', ['init', '-b', 'main']);
  assert.equal(initResult.status, 0, initResult.stderr || initResult.stdout);
  const addResult = runCommand(fixtureRoot, 'git', ['add', '.']);
  assert.equal(addResult.status, 0, addResult.stderr || addResult.stdout);
  const commitResult = runCommand(fixtureRoot, 'git', ['commit', '-m', 'initial fixture'], {
    GIT_AUTHOR_NAME: 'Playbook Test',
    GIT_AUTHOR_EMAIL: 'playbook-test@example.com',
    GIT_COMMITTER_NAME: 'Playbook Test',
    GIT_COMMITTER_EMAIL: 'playbook-test@example.com'
  });
  assert.equal(commitResult.status, 0, commitResult.stderr || commitResult.stdout);

  return fixtureRoot;
};

test('writeCommandTruthContract repairs missing contract so doctor passes', async () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-command-truth-'));
  copyRequiredDocs(repo);

  const before = runNode(repo, [cliPath, 'doctor', '--json']);
  assert.notEqual(before.status, 0);
  assert.match(before.stdout, /Command truth contract is missing or invalid/);

  await writeCommandTruthContract(repo);

  const after = runNode(repo, [cliPath, 'doctor', '--json']);
  assert.equal(after.status, 0, after.stderr || after.stdout);
  assert.doesNotMatch(after.stdout, /Command truth contract is missing or invalid/);
});

test('demo refresh syncs command-truth before running doctor in the demo repo', () => {
  const fixtureRepo = createDemoRepoFixture('playbook-demo-refresh-fixture');
  const result = runNode(repoRoot, [
    demoRefreshScript,
    '--dry-run',
    '--repo-url',
    fixtureRepo,
    '--feature-id',
    'PB-V1-DEMO-REFRESH-001'
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Synced required managed docs\/contracts before demo refresh/);
  assert.match(result.stdout, /Using refresh command: npm run demo:refresh/);
  assert.match(result.stdout, /Detected changes:/);
  assert.match(result.stdout, /docs\/contracts\/command-truth\.json/);
  assert.match(result.stdout, /\.playbook\/demo-artifacts\/doctor\.txt/);
  assert.match(result.stdout, /Dry-run mode: no commit\/push\/PR actions taken\./);
});
