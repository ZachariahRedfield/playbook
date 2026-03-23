const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const CHANGELOG_PATH = 'docs/CHANGELOG.md';
const RELEASE_NOTES_START = '<!-- PLAYBOOK:CHANGELOG_RELEASE_NOTES_START -->';
const RELEASE_NOTES_END = '<!-- PLAYBOOK:CHANGELOG_RELEASE_NOTES_END -->';

function runGit(args, options = {}) {
  return cp.execFileSync('git', args, {
    cwd: options.cwd || process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function getChangedPaths(cwd = process.cwd()) {
  const output = cp.execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.slice(3).trim())
    .sort();
}

function readJsonAtRevision(repoRoot, revision, filePath) {
  const spec = `${revision}:${filePath}`;
  const raw = cp.execFileSync('git', ['show', spec], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return JSON.parse(raw);
}

function readWorkingJson(repoRoot, filePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, filePath), 'utf8'));
}

function diffPackageManifest(before, after) {
  const changes = [];
  const dependencyKeys = new Set(['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']);
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of allKeys) {
    const beforeValue = before[key];
    const afterValue = after[key];
    if (JSON.stringify(beforeValue) === JSON.stringify(afterValue)) {
      continue;
    }

    if (key === 'version') {
      if (typeof beforeValue !== 'string' || typeof afterValue !== 'string') {
        throw new Error('Package version changes must stay string-to-string.');
      }
      changes.push({ kind: 'version', key, before: beforeValue, after: afterValue });
      continue;
    }

    if (dependencyKeys.has(key)) {
      if (!isPlainObject(beforeValue) && beforeValue !== undefined) {
        throw new Error(`Dependency field ${key} must stay an object.`);
      }
      if (!isPlainObject(afterValue) && afterValue !== undefined) {
        throw new Error(`Dependency field ${key} must stay an object.`);
      }
      const beforeDeps = beforeValue || {};
      const afterDeps = afterValue || {};
      const depNames = new Set([...Object.keys(beforeDeps), ...Object.keys(afterDeps)]);
      for (const depName of depNames) {
        if (beforeDeps[depName] === afterDeps[depName]) {
          continue;
        }
        if (typeof afterDeps[depName] !== 'string' && afterDeps[depName] !== undefined) {
          throw new Error(`Dependency ${key}.${depName} must stay string-valued.`);
        }
        if (typeof beforeDeps[depName] !== 'string' && beforeDeps[depName] !== undefined) {
          throw new Error(`Dependency ${key}.${depName} must stay string-valued.`);
        }
        changes.push({ kind: 'dependency', key: `${key}.${depName}`, before: beforeDeps[depName], after: afterDeps[depName] });
      }
      continue;
    }

    throw new Error(`Unsupported package.json mutation at key ${key}.`);
  }

  return changes;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function extractManagedBlock(content) {
  const start = content.indexOf(RELEASE_NOTES_START);
  const end = content.indexOf(RELEASE_NOTES_END);
  if (start === -1 || end === -1 || end < start) {
    throw new Error('docs/CHANGELOG.md must retain the managed PLAYBOOK:CHANGELOG_RELEASE_NOTES block.');
  }
  const prefix = content.slice(0, start);
  const block = content.slice(start, end + RELEASE_NOTES_END.length);
  const suffix = content.slice(end + RELEASE_NOTES_END.length);
  return { prefix, block, suffix };
}

function validateChangelogChange(repoRoot, filePath) {
  const before = cp.execFileSync('git', ['show', `HEAD:${filePath}`], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const after = fs.readFileSync(path.join(repoRoot, filePath), 'utf8');
  const beforeSections = extractManagedBlock(before);
  const afterSections = extractManagedBlock(after);
  if (beforeSections.prefix !== afterSections.prefix || beforeSections.suffix !== afterSections.suffix) {
    throw new Error('docs/CHANGELOG.md may only change within the managed release-notes block during release prep.');
  }
}

function buildReleasePrepSummary(repoRoot = process.cwd()) {
  const changedPaths = getChangedPaths(repoRoot);
  const summary = {
    changedPaths,
    packageChanges: [],
    hasChanges: changedPaths.length > 0,
  };

  for (const filePath of changedPaths) {
    if (filePath === CHANGELOG_PATH) {
      validateChangelogChange(repoRoot, filePath);
      continue;
    }

    if (path.basename(filePath) !== 'package.json') {
      throw new Error(`Release prep produced unsupported file change: ${filePath}.`);
    }

    const before = readJsonAtRevision(repoRoot, 'HEAD', filePath);
    const after = readWorkingJson(repoRoot, filePath);
    const changes = diffPackageManifest(before, after);
    summary.packageChanges.push({
      path: filePath,
      name: after.name || before.name || filePath,
      beforeVersion: before.version,
      afterVersion: after.version,
      changes,
    });
  }

  summary.packageChanges.sort((a, b) => a.path.localeCompare(b.path));
  summary.nextVersion = inferNextVersion(summary.packageChanges);
  return summary;
}

function inferNextVersion(packageChanges) {
  const versionChange = packageChanges.find((entry) => entry.beforeVersion && entry.afterVersion && entry.beforeVersion !== entry.afterVersion);
  return versionChange ? versionChange.afterVersion : null;
}

function renderPullRequestBody(summary, options = {}) {
  const baseRef = options.baseRef || 'main';
  const changedPackages = summary.packageChanges.filter((entry) => entry.beforeVersion !== entry.afterVersion);
  const packageLines = changedPackages.length
    ? changedPackages.map((entry) => `- \`${entry.name}\`: \`${entry.beforeVersion}\` -> \`${entry.afterVersion}\``).join('\n')
    : '- No package version changes were required.';

  return [
    '<!-- playbook:release-prep-pr -->',
    '# Release Prep',
    '',
    'This PR was prepared by the trusted/manual release-prep workflow.',
    '',
    '## Reviewed mutation path',
    '',
    '- `pnpm playbook release plan --json --out .playbook/release-plan.json`',
    '- `pnpm playbook apply --from-plan .playbook/release-plan.json`',
    '',
    '## Included reviewed mutations',
    '',
    packageLines,
    '- Managed `docs/CHANGELOG.md` release-notes block refresh.',
    '',
    '## Safety checks',
    '',
    '- Ordinary PR CI remains detect/plan/report only.',
    '- No second mutation executor was introduced; `apply --from-plan` remains the sole write boundary.',
    `- Base branch: \`${baseRef}\`.`,
  ].join('\n');
}

function main() {
  const summary = buildReleasePrepSummary(process.cwd());
  const body = renderPullRequestBody(summary, { baseRef: process.env.PLAYBOOK_RELEASE_BASE_REF || 'main' });
  process.stdout.write(JSON.stringify({ ...summary, pullRequestBody: body }, null, 2));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

module.exports = {
  CHANGELOG_PATH,
  buildReleasePrepSummary,
  diffPackageManifest,
  extractManagedBlock,
  renderPullRequestBody,
  validateChangelogChange,
};
