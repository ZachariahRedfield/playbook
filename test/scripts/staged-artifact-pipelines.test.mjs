import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { resolveReleaseVersionContext } from '../../scripts/pack-release-fallback-asset.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const updateSnapshotsScript = path.join(repoRoot, 'scripts', 'update-contract-snapshots.mjs');
const releaseAssetScript = path.join(repoRoot, 'scripts', 'pack-release-fallback-asset.mjs');
const committedSnapshotPath = path.join(repoRoot, 'tests', 'contracts', 'ai-context.snapshot.json');
const releaseVersion = JSON.parse(fs.readFileSync(path.join(repoRoot, 'packages', 'cli-wrapper', 'package.json'), 'utf8')).version;
const releaseAssetPath = path.join(repoRoot, 'dist', 'release', `playbook-cli-${releaseVersion}.tgz`);

const createScriptEnv = (overrides = {}) => {
  const env = { ...process.env };
  delete env.PLAYBOOK_RELEASE_VERSION;
  delete env.GITHUB_REF;
  delete env.GITHUB_REF_NAME;
  delete env.GITHUB_REF_TYPE;
  return { ...env, ...overrides };
};

const runNode = (scriptPath, env = {}) =>
  spawnSync('node', [scriptPath], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: createScriptEnv(env)
  });

test('update-contract-snapshots stages regenerated snapshots and leaves committed snapshots untouched on failed promotion', { timeout: 180000, concurrency: false }, () => {
  const original = fs.readFileSync(committedSnapshotPath, 'utf8');
  const result = runNode(updateSnapshotsScript, { PLAYBOOK_FAIL_BEFORE_SNAPSHOT_PROMOTION: '1' });
  const after = fs.readFileSync(committedSnapshotPath, 'utf8');

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /snapshot promotion intentionally aborted before promotion/);
  assert.equal(after, original);
});


test('update-contract-snapshots uses the deterministic generator path instead of the vitest/esbuild refresh path', { timeout: 180000, concurrency: false }, () => {
  const result = runNode(updateSnapshotsScript);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.doesNotMatch(result.stderr, /@esbuild\/linux-x64/);
  assert.match(result.stdout, /Refreshed \d+ contract snapshot\(s\) via generate → validate → promote\./);
});

test('resolveReleaseVersionContext prefers explicit release version env', () => {
  assert.deepEqual(
    resolveReleaseVersionContext({
      PLAYBOOK_RELEASE_VERSION: '0.1.8',
      GITHUB_REF_TYPE: 'tag',
      GITHUB_REF_NAME: 'v9.9.9'
    }),
    { version: '0.1.8', source: 'PLAYBOOK_RELEASE_VERSION' }
  );
});

test('resolveReleaseVersionContext accepts semver tag refs only in tag context', () => {
  assert.deepEqual(
    resolveReleaseVersionContext({
      GITHUB_REF_TYPE: 'tag',
      GITHUB_REF_NAME: `v${releaseVersion}`
    }),
    { version: releaseVersion, source: 'GITHUB_REF_NAME' }
  );

  assert.deepEqual(
    resolveReleaseVersionContext({
      GITHUB_REF: `refs/tags/v${releaseVersion}`
    }),
    { version: releaseVersion, source: 'GITHUB_REF' }
  );
});

test('resolveReleaseVersionContext ignores merge refs and generic non-tag CI metadata', () => {
  assert.deepEqual(
    resolveReleaseVersionContext({
      GITHUB_REF_NAME: '630/merge',
      GITHUB_REF_TYPE: 'branch',
      GITHUB_REF: 'refs/pull/630/merge'
    }),
    { version: null, source: null }
  );

  assert.deepEqual(
    resolveReleaseVersionContext({
      GITHUB_REF_TYPE: 'tag',
      GITHUB_REF_NAME: 'release-candidate'
    }),
    { version: null, source: null }
  );
});

test('pack-release-fallback-asset validates staged tarballs before promotion and preserves committed asset on failure', { timeout: 120000, concurrency: false }, () => {
  const tempAssetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-release-asset-backup-'));
  const backupPath = path.join(tempAssetDir, path.basename(releaseAssetPath));
  const hadOriginalAsset = fs.existsSync(releaseAssetPath);
  if (hadOriginalAsset) {
    fs.copyFileSync(releaseAssetPath, backupPath);
  }

  try {
    const baseline = runNode(releaseAssetScript);
    assert.equal(baseline.status, 0, baseline.stderr || baseline.stdout);
    const promoted = fs.readFileSync(releaseAssetPath);

    const failed = runNode(releaseAssetScript, { PLAYBOOK_CORRUPT_STAGED_RELEASE_ASSET: '1' });
    assert.notEqual(failed.status, 0);
    assert.match(failed.stderr, /(Fallback release asset validation failed|tar)/);
    assert.deepEqual(fs.readFileSync(releaseAssetPath), promoted);
  } finally {
    if (hadOriginalAsset) {
      fs.mkdirSync(path.dirname(releaseAssetPath), { recursive: true });
      fs.copyFileSync(backupPath, releaseAssetPath);
    } else {
      fs.rmSync(releaseAssetPath, { force: true });
    }
    fs.rmSync(tempAssetDir, { recursive: true, force: true });
  }
});

test('pack-release-fallback-asset enforces explicit release version mismatches only when explicit release context is provided', () => {
  const result = runNode(releaseAssetScript, { PLAYBOOK_RELEASE_VERSION: '9.9.9' });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Release version \(9\.9\.9\) from PLAYBOOK_RELEASE_VERSION does not match packages\/cli-wrapper version/);
});
