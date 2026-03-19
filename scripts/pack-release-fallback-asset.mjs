import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { withTempDir, promoteStagedFile } from './staged-artifact-workflow.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const wrapperDir = path.join(repoRoot, 'packages', 'cli-wrapper');
const releaseDir = path.join(repoRoot, 'dist', 'release');
const packageJsonPath = path.join(wrapperDir, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const packageVersion = packageJson.version;
const SEMVER_TAG_PATTERN = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const EXEC_MAX_BUFFER = 10 * 1024 * 1024;

export const normalizeReleaseVersion = (value) => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed || !SEMVER_TAG_PATTERN.test(trimmed)) {
    return null;
  }

  return trimmed.replace(/^v/, '');
};

export const resolveReleaseVersionContext = (env = process.env) => {
  const explicitVersion = normalizeReleaseVersion(env.PLAYBOOK_RELEASE_VERSION);
  if (explicitVersion) {
    return { version: explicitVersion, source: 'PLAYBOOK_RELEASE_VERSION' };
  }

  const tagRefName = env.GITHUB_REF_TYPE === 'tag'
    ? normalizeReleaseVersion(env.GITHUB_REF_NAME)
    : null;
  if (tagRefName) {
    return { version: tagRefName, source: 'GITHUB_REF_NAME' };
  }

  const rawGithubRef = typeof env.GITHUB_REF === 'string' ? env.GITHUB_REF.trim() : '';
  if (rawGithubRef.startsWith('refs/tags/')) {
    const tagFromRef = normalizeReleaseVersion(rawGithubRef.slice('refs/tags/'.length));
    if (tagFromRef) {
      return { version: tagFromRef, source: 'GITHUB_REF' };
    }
  }

  return { version: null, source: null };
};

const validateTarball = (tarballPath) => {
  const tarEntries = execFileSync('tar', ['-tzf', tarballPath], { cwd: repoRoot, encoding: 'utf8', maxBuffer: EXEC_MAX_BUFFER })
    .split('\n')
    .map((entry) => entry.trim())
    .filter(Boolean);

  const requiredEntries = [
    'package/bin/playbook.js',
    'package/runtime/main.js'
  ];
  const missingEntries = requiredEntries.filter((entry) => !tarEntries.includes(entry));
  const hasVendoredRuntime = tarEntries.some((entry) => entry.startsWith('package/runtime/node_modules/'));
  if (!hasVendoredRuntime) {
    missingEntries.push('package/runtime/node_modules/...');
  }
  if (missingEntries.length > 0) {
    throw new Error(`Fallback release asset validation failed for ${path.relative(repoRoot, tarballPath)}. Missing required entries: ${missingEntries.join(', ')}`);
  }

  return {
    hasBinEntry: true,
    hasRuntimeEntry: true,
    hasVendoredRuntime: true
  };
};

const main = async () => {
  const releaseContext = resolveReleaseVersionContext();
  if (releaseContext.version && releaseContext.version !== packageVersion) {
    throw new Error(`Release version (${releaseContext.version}) from ${releaseContext.source} does not match packages/cli-wrapper version (${packageVersion}).`);
  }

  await withTempDir('playbook-release-asset-', async (stagingDir) => {
    const stagedReleaseDir = path.join(stagingDir, 'release');
    fs.mkdirSync(stagedReleaseDir, { recursive: true });

    const packOutput = execFileSync('pnpm', ['pack', '--pack-destination', stagedReleaseDir], {
      cwd: wrapperDir,
      encoding: 'utf8',
      maxBuffer: EXEC_MAX_BUFFER
    });
    if (packOutput) {
      process.stderr.write(packOutput);
    }

    const generatedTarballs = fs.readdirSync(stagedReleaseDir)
      .filter((entry) => entry.endsWith('.tgz'))
      .map((entry) => path.join(stagedReleaseDir, entry));

    if (generatedTarballs.length !== 1) {
      throw new Error(`Expected exactly one generated tarball in ${stagedReleaseDir}, found ${generatedTarballs.length}: ${generatedTarballs.join(', ') || '(none)'}`);
    }

    const packedTarballPath = generatedTarballs[0];
    if (process.env.PLAYBOOK_CORRUPT_STAGED_RELEASE_ASSET === '1') {
      fs.writeFileSync(packedTarballPath, 'corrupted staged tarball', 'utf8');
    }
    const finalAssetPath = path.join(releaseDir, `playbook-cli-${packageVersion}.tgz`);
    const checks = validateTarball(packedTarballPath);
    await promoteStagedFile({ stagedPath: packedTarballPath, destinationPath: finalAssetPath });

    console.log(JSON.stringify({
      version: packageVersion,
      assetPath: path.relative(repoRoot, finalAssetPath),
      packedTarballPath: path.relative(repoRoot, packedTarballPath),
      checks
    }, null, 2));
  });
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
