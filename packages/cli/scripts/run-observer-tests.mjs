import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createObserverServer, runObserver, OBSERVER_REPO_REGISTRY_RELATIVE_PATH } from '../dist/commands/observer/index.js';

const makeTempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-observer-'));
const tests = [];
const test = (name, fn) => tests.push({ name, fn });

const parseLastJsonLog = (calls) => JSON.parse(String(calls.at(-1)?.[0] ?? '{}'));

const withLogSpy = async (fn) => {
  const original = console.log;
  const calls = [];
  console.log = (...args) => calls.push(args);
  try {
    await fn(calls);
  } finally {
    console.log = original;
  }
};

test('uses deterministic observer root across nested cwd invocations', async () => {
  const homeRoot = makeTempDir();
  fs.writeFileSync(path.join(homeRoot, 'package.json'), JSON.stringify({ name: 'playbook-e2e' }, null, 2));
  const nestedCwd = path.join(homeRoot, 'apps', 'nested');
  fs.mkdirSync(nestedCwd, { recursive: true });
  const repo = path.join(homeRoot, 'repo-a');
  fs.mkdirSync(path.join(repo, '.playbook'), { recursive: true });

  assert.equal(await runObserver(homeRoot, ['repo', 'add', './repo-a', '--id', 'repo-a'], { format: 'json', quiet: false }), 0);

  await withLogSpy(async (calls) => {
    assert.equal(await runObserver(nestedCwd, ['repo', 'list'], { format: 'json', quiet: false }), 0);
    const payload = parseLastJsonLog(calls);
    assert.equal(payload.observer_root, homeRoot);
    assert.equal(payload.registry_path, path.join(homeRoot, OBSERVER_REPO_REGISTRY_RELATIVE_PATH));
    assert.equal(payload.repo_count, 1);
    assert.deepEqual(payload.registry.repos.map((entry) => entry.id), ['repo-a']);
  });
});

test('supports explicit --root override for repo commands', async () => {
  const outerCwd = makeTempDir();
  const observerRoot = path.join(outerCwd, 'observer-root');
  const repo = path.join(observerRoot, 'repo-b');
  fs.mkdirSync(path.join(repo, '.playbook'), { recursive: true });

  assert.equal(await runObserver(outerCwd, ['repo', 'add', './repo-b', '--id', 'repo-b', '--root', observerRoot], { format: 'json', quiet: false }), 0);

  await withLogSpy(async (calls) => {
    assert.equal(await runObserver(outerCwd, ['repo', 'list', '--root', observerRoot], { format: 'json', quiet: false }), 0);
    const payload = parseLastJsonLog(calls);
    assert.equal(payload.observer_root, path.resolve(observerRoot));
    assert.equal(payload.registry_path, path.join(path.resolve(observerRoot), OBSERVER_REPO_REGISTRY_RELATIVE_PATH));
    assert.deepEqual(payload.registry.repos.map((entry) => entry.id), ['repo-b']);
  });
});

test('persists registry across add/list/serve from different cwd values', async () => {
  const homeRoot = makeTempDir();
  fs.writeFileSync(path.join(homeRoot, 'package.json'), JSON.stringify({ name: 'playbook-observer-fixture' }, null, 2));

  const repo = path.join(homeRoot, 'repo-persisted');
  fs.mkdirSync(path.join(repo, '.playbook'), { recursive: true });

  const addCwd = path.join(homeRoot, 'apps', 'add');
  const listCwd = path.join(homeRoot, 'apps', 'list');
  const serveCwd = path.join(homeRoot, 'apps', 'serve');
  fs.mkdirSync(addCwd, { recursive: true });
  fs.mkdirSync(listCwd, { recursive: true });
  fs.mkdirSync(serveCwd, { recursive: true });

  assert.equal(await runObserver(addCwd, ['repo', 'add', repo, '--id', 'repo-persisted'], { format: 'json', quiet: false }), 0);

  await withLogSpy(async (calls) => {
    assert.equal(await runObserver(listCwd, ['repo', 'list'], { format: 'json', quiet: false }), 0);
    const payload = parseLastJsonLog(calls);
    assert.equal(payload.observer_root, homeRoot);
    assert.equal(payload.registry_path, path.join(homeRoot, OBSERVER_REPO_REGISTRY_RELATIVE_PATH));
    assert.equal(payload.repo_count, 1);
    assert.deepEqual(payload.registry.repos.map((entry) => entry.id), ['repo-persisted']);
  });

  const server = createObserverServer(homeRoot, serveCwd);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const response = await fetch(`http://127.0.0.1:${port}/repos`);
    const payload = await response.json();
    assert.equal(payload.observer_root, homeRoot);
    assert.equal(payload.registry_path, path.join(homeRoot, OBSERVER_REPO_REGISTRY_RELATIVE_PATH));
    assert.equal(payload.repo_count, 1);
    assert.deepEqual(payload.repos.map((entry) => entry.id), ['repo-persisted']);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

let failures = 0;
for (const { name, fn } of tests) {
  try {
    await fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`✗ ${name}`);
    console.error(error);
  }
}

if (failures > 0) {
  process.exit(1);
}

console.log(`Observer test harness passed (${tests.length} tests).`);
