const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const { buildReleasePrepSummary, diffPackageManifest, renderPullRequestBody } = require('./prepare-release-pr.cjs');

function git(cwd, args) {
  return cp.execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function setupRepo() {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-release-prep-'));
  git(repoRoot, ['init']);
  git(repoRoot, ['config', 'user.name', 'Playbook Test']);
  git(repoRoot, ['config', 'user.email', 'playbook@example.com']);
  fs.mkdirSync(path.join(repoRoot, 'docs'), { recursive: true });
  fs.mkdirSync(path.join(repoRoot, 'packages', 'alpha'), { recursive: true });
  fs.writeFileSync(path.join(repoRoot, 'docs', 'CHANGELOG.md'), [
    '# Changelog',
    '',
    'Intro',
    '<!-- PLAYBOOK:CHANGELOG_RELEASE_NOTES_START -->',
    'old block',
    '<!-- PLAYBOOK:CHANGELOG_RELEASE_NOTES_END -->',
    'Footer',
    '',
  ].join('\n'));
  fs.writeFileSync(path.join(repoRoot, 'packages', 'alpha', 'package.json'), JSON.stringify({
    name: '@scope/alpha',
    version: '1.2.3',
    dependencies: { '@scope/beta': '^1.2.3' },
  }, null, 2) + '\n');
  git(repoRoot, ['add', '.']);
  git(repoRoot, ['commit', '-m', 'initial']);
  return repoRoot;
}

test('diffPackageManifest only accepts version and dependency rewrites', () => {
  const changes = diffPackageManifest(
    { name: '@scope/alpha', version: '1.2.3', dependencies: { '@scope/beta': '^1.2.3' } },
    { name: '@scope/alpha', version: '1.2.4', dependencies: { '@scope/beta': '^1.2.4' } },
  );

  assert.deepEqual(changes, [
    { kind: 'version', key: 'version', before: '1.2.3', after: '1.2.4' },
    { kind: 'dependency', key: 'dependencies.@scope/beta', before: '^1.2.3', after: '^1.2.4' },
  ]);
});

test('buildReleasePrepSummary accepts version/changelog-only release prep diffs', () => {
  const repoRoot = setupRepo();
  fs.writeFileSync(path.join(repoRoot, 'packages', 'alpha', 'package.json'), JSON.stringify({
    name: '@scope/alpha',
    version: '1.2.4',
    dependencies: { '@scope/beta': '^1.2.4' },
  }, null, 2) + '\n');
  fs.writeFileSync(path.join(repoRoot, 'docs', 'CHANGELOG.md'), [
    '# Changelog',
    '',
    'Intro',
    '<!-- PLAYBOOK:CHANGELOG_RELEASE_NOTES_START -->',
    'new block',
    '<!-- PLAYBOOK:CHANGELOG_RELEASE_NOTES_END -->',
    'Footer',
    '',
  ].join('\n'));

  const summary = buildReleasePrepSummary(repoRoot);

  assert.deepEqual(summary.changedPaths, ['docs/CHANGELOG.md', 'packages/alpha/package.json']);
  assert.equal(summary.nextVersion, '1.2.4');
  assert.equal(summary.packageChanges.length, 1);
  assert.equal(summary.packageChanges[0].name, '@scope/alpha');
});

test('buildReleasePrepSummary rejects non-release mutations', () => {
  const repoRoot = setupRepo();
  fs.writeFileSync(path.join(repoRoot, 'README.md'), 'unexpected\n');

  assert.throws(() => buildReleasePrepSummary(repoRoot), /unsupported file change: README\.md/);
});

test('renderPullRequestBody describes the reviewed mutation path', () => {
  const body = renderPullRequestBody({
    packageChanges: [{ name: '@scope/alpha', beforeVersion: '1.2.3', afterVersion: '1.2.4' }],
  }, { baseRef: 'main' });

  assert.match(body, /apply --from-plan \.playbook\/release-plan\.json/);
  assert.match(body, /@scope\/alpha/);
  assert.match(body, /Ordinary PR CI remains detect\/plan\/report only\./);
});
