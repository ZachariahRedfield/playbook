import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const updateSnapshotsScript = path.join(repoRoot, 'scripts', 'update-contract-snapshots.mjs');
const releaseAssetScript = path.join(repoRoot, 'scripts', 'pack-release-fallback-asset.mjs');
const committedSnapshotPath = path.join(repoRoot, 'tests', 'contracts', 'ai-context.snapshot.json');
const releaseVersion = JSON.parse(fs.readFileSync(path.join(repoRoot, 'packages', 'cli-wrapper', 'package.json'), 'utf8')).version;
const releaseAssetPath = path.join(repoRoot, 'dist', 'release', `playbook-cli-${releaseVersion}.tgz`);

const runNode = (scriptPath, env = {}) =>
  spawnSync('node', [scriptPath], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...process.env, ...env }
  });

test('update-contract-snapshots stages regenerated snapshots and leaves committed snapshots untouched on failed promotion', { timeout: 180000, concurrency: false }, () => {
  const original = fs.readFileSync(committedSnapshotPath, 'utf8');
  const result = runNode(updateSnapshotsScript, { PLAYBOOK_SNAPSHOT_TEST_MODE: '1', PLAYBOOK_FAIL_BEFORE_SNAPSHOT_PROMOTION: '1' });
  const after = fs.readFileSync(committedSnapshotPath, 'utf8');

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /snapshot promotion intentionally aborted before promotion/);
  assert.equal(after, original);
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
