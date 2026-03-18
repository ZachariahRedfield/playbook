import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  createSpawnInvocation,
  evaluateArtifactContracts,
  evaluateTarballEntries,
  parseTarEntries,
  resolveCommand,
  run,
  ensureConsumerPackageBaseline
} from '../scripts/release-fallback-proof.mjs';

const withTempRepo = (fn) => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'release-fallback-proof-test-'));
  try {
    mkdirSync(path.join(root, '.playbook'), { recursive: true });
    fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

const contracts = [
  {
    path: '.playbook/repo-graph.json',
    producerKey: 'index',
    producerCommand: 'npx playbook index --json',
    remediation: 'run index',
    severity: 'setup_precondition_fail',
    schema: { kind: 'repo-graph' }
  },
  {
    path: '.playbook/last-run.json',
    producerKey: 'apply',
    producerCommand: 'npx playbook apply --json',
    remediation: 'run apply',
    severity: 'hard_fail'
  }
];

test('flags missing both artifacts as missing prerequisites', () => {
  withTempRepo((repoRoot) => {
    const checks = evaluateArtifactContracts({ repoRoot, contracts, producerRuns: {} });
    assert.equal(checks.length, 2);
    assert.equal(checks[0].ok, false);
    assert.equal(checks[1].ok, false);
    assert.equal(checks[0].failureType, 'missing_prerequisite_artifact');
    assert.equal(checks[1].failureType, 'missing_prerequisite_artifact');
  });
});

test('flags missing repo-graph when last-run exists', () => {
  withTempRepo((repoRoot) => {
    writeFileSync(path.join(repoRoot, '.playbook', 'last-run.json'), JSON.stringify({ command: 'apply' }, null, 2));
    const checks = evaluateArtifactContracts({ repoRoot, contracts, producerRuns: {} });
    assert.equal(checks[0].failureType, 'missing_prerequisite_artifact');
    assert.equal(checks[1].ok, true);
  });
});

test('flags missing last-run when repo-graph exists', () => {
  withTempRepo((repoRoot) => {
    writeFileSync(path.join(repoRoot, '.playbook', 'repo-graph.json'), JSON.stringify({ edges: [] }, null, 2));
    const checks = evaluateArtifactContracts({ repoRoot, contracts, producerRuns: {} });
    assert.equal(checks[0].ok, true);
    assert.equal(checks[1].failureType, 'missing_prerequisite_artifact');
  });
});

test('passes when artifacts are present and valid', () => {
  withTempRepo((repoRoot) => {
    writeFileSync(path.join(repoRoot, '.playbook', 'repo-graph.json'), JSON.stringify({ edges: [] }, null, 2));
    writeFileSync(path.join(repoRoot, '.playbook', 'last-run.json'), JSON.stringify({ command: 'apply' }, null, 2));
    const checks = evaluateArtifactContracts({ repoRoot, contracts, producerRuns: {} });
    assert.ok(checks.every((check) => check.ok));
  });
});

test('check shape is stable and includes remediation metadata on failure', () => {
  withTempRepo((repoRoot) => {
    const checks = evaluateArtifactContracts({ repoRoot, contracts, producerRuns: {} });
    for (const check of checks) {
      assert.ok('artifactPath' in check);
      assert.ok('failureType' in check);
      assert.ok('expectedProducerCommand' in check);
      assert.ok('remediation' in check);
      assert.ok('severity' in check);
      assert.equal(typeof check.remediation, 'string');
      assert.match(check.command, /^node artifact-exists-check /);
    }
  });
});

test('parseTarEntries normalizes CRLF output and preserves exact entries', () => {
  assert.deepEqual(parseTarEntries('package/bin/playbook.js\r\npackage/runtime/main.js\r\n'), [
    'package/bin/playbook.js',
    'package/runtime/main.js'
  ]);
});

test('evaluateTarballEntries validates exact entries and vendored runtime in JS', () => {
  const checks = evaluateTarballEntries({
    tarPath: 'dist/release/playbook-cli-0.1.8.tgz',
    tarEntries: [
      'package/bin/playbook.js',
      'package/runtime/main.js',
      'package/runtime/node_modules/foo/index.js'
    ]
  });

  assert.equal(checks.length, 3);
  assert.ok(checks.every((check) => check.ok));
  assert.match(checks[0].command, /^node tar-entry-check /);
  assert.match(checks[2].command, /^node tar-entry-prefix-check /);
});


test('ensureConsumerPackageBaseline creates a minimal package.json when missing', () => {
  withTempRepo((repoRoot) => {
    const consumerRepo = path.join(repoRoot, 'consumer');
    const packageJsonPath = ensureConsumerPackageBaseline(consumerRepo);
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

    assert.equal(packageJsonPath, path.join(consumerRepo, 'package.json'));
    assert.deepEqual(packageJson, {
      name: 'playbook-fallback-proof-consumer',
      private: true,
      version: '0.0.0',
      description: 'Machine-generated fallback proof consumer baseline'
    });
  });
});

test('ensureConsumerPackageBaseline preserves an existing package.json', () => {
  withTempRepo((repoRoot) => {
    const consumerRepo = path.join(repoRoot, 'consumer');
    mkdirSync(consumerRepo, { recursive: true });
    const packageJsonPath = path.join(consumerRepo, 'package.json');
    writeFileSync(packageJsonPath, JSON.stringify({ name: 'existing-consumer', private: true }, null, 2));

    assert.equal(ensureConsumerPackageBaseline(consumerRepo), packageJsonPath);
    assert.deepEqual(JSON.parse(readFileSync(packageJsonPath, 'utf8')), { name: 'existing-consumer', private: true });
  });
});


test('resolveCommand maps npm and npx to cmd executables on Windows only', () => {
  assert.equal(resolveCommand('npm', 'win32'), 'npm.cmd');
  assert.equal(resolveCommand('npx', 'win32'), 'npx.cmd');
  assert.equal(resolveCommand('npm', 'linux'), 'npm');
  assert.equal(resolveCommand('npx', 'darwin'), 'npx');
});

test('createSpawnInvocation uses cmd.exe launcher for Windows npm and npx commands', () => {
  assert.deepEqual(createSpawnInvocation('npm.cmd', ['install'], 'win32'), {
    spawnCommand: 'cmd.exe',
    spawnArgs: ['/d', '/s', '/c', 'npm.cmd install'],
    command: 'npm.cmd install'
  });
  assert.deepEqual(createSpawnInvocation('npm.cmd', ['install', '@fawxzzy/playbook-cli@9999.0.0'], 'win32'), {
    spawnCommand: 'cmd.exe',
    spawnArgs: ['/d', '/s', '/c', 'npm.cmd install @fawxzzy/playbook-cli@9999.0.0'],
    command: 'npm.cmd install @fawxzzy/playbook-cli@9999.0.0'
  });
  assert.deepEqual(createSpawnInvocation('npx.cmd', ['playbook', 'plan', '--out', '.playbook/plan.json'], 'win32'), {
    spawnCommand: 'cmd.exe',
    spawnArgs: ['/d', '/s', '/c', 'npx.cmd playbook plan --out .playbook/plan.json'],
    command: 'npx.cmd playbook plan --out .playbook/plan.json'
  });
});

test('createSpawnInvocation leaves non-Windows commands unchanged', () => {
  assert.deepEqual(createSpawnInvocation('npm', ['install'], 'linux'), {
    spawnCommand: 'npm',
    spawnArgs: ['install'],
    command: 'npm install'
  });
  assert.deepEqual(createSpawnInvocation('tar.exe', ['-tf', 'asset.tgz'], 'win32'), {
    spawnCommand: 'tar.exe',
    spawnArgs: ['-tf', 'asset.tgz'],
    command: 'tar.exe -tf asset.tgz'
  });
});

test('run surfaces spawn errors when command launch fails', () => {
  const result = run('npm.cmd', ['install'], '/tmp/consumer', () => ({
    status: null,
    stdout: '',
    stderr: '',
    error: Object.assign(new Error('spawnSync npm.cmd ENOENT'), {
      code: 'ENOENT',
      errno: -2,
      syscall: 'spawnSync npm.cmd',
      path: 'npm.cmd',
      spawnargs: ['install']
    })
  }));

  assert.equal(result.ok, false);
  assert.equal(result.status, null);
  assert.equal(result.errorMessage, 'spawnSync npm.cmd ENOENT');
  assert.equal(result.errorCode, 'ENOENT');
  assert.equal(result.errorErrno, -2);
  assert.equal(result.errorSyscall, 'spawnSync npm.cmd');
  assert.equal(result.errorPath, 'npm.cmd');
  assert.deepEqual(result.errorSpawnargs, ['install']);
});

test('run launches Windows npm commands through cmd.exe while preserving logical command text', () => {
  const calls = [];
  const result = run(
    'npm.cmd',
    ['install', '--no-save', 'https://example.com/playbook-cli-0.1.8.tgz'],
    'C:/temp/playbook-test',
    (command, args, options) => {
      calls.push({ command, args, options });
      return { status: 0, stdout: 'ok', stderr: '', error: null };
    },
    'win32'
  );

  assert.deepEqual(calls, [
    {
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', 'npm.cmd install --no-save https://example.com/playbook-cli-0.1.8.tgz'],
      options: { cwd: 'C:/temp/playbook-test', encoding: 'utf8' }
    }
  ]);
  assert.equal(result.ok, true);
  assert.equal(result.command, 'npm.cmd install --no-save https://example.com/playbook-cli-0.1.8.tgz');
});
