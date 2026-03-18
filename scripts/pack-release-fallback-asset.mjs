import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const wrapperDir = path.join(repoRoot, 'packages', 'cli-wrapper');
const releaseDir = path.join(repoRoot, 'dist', 'release');
const packageJsonPath = path.join(wrapperDir, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const packageVersion = packageJson.version;
const expectedTagVersion = process.env.GITHUB_REF_NAME?.replace(/^v/, '') || process.env.PLAYBOOK_RELEASE_VERSION || null;

if (expectedTagVersion && expectedTagVersion !== packageVersion) {
  throw new Error(`Release version (${expectedTagVersion}) does not match packages/cli-wrapper version (${packageVersion}).`);
}

fs.mkdirSync(releaseDir, { recursive: true });
const finalAssetPath = path.join(releaseDir, `playbook-cli-${packageVersion}.tgz`);
fs.rmSync(finalAssetPath, { force: true });

const beforeTarballs = new Set(
  fs.readdirSync(releaseDir)
    .filter((entry) => entry.endsWith('.tgz'))
    .map((entry) => path.join(releaseDir, entry))
);

const packOutput = execFileSync('pnpm', ['pack', '--pack-destination', releaseDir], {
  cwd: wrapperDir,
  encoding: 'utf8'
});
if (packOutput) {
  process.stderr.write(packOutput);
}

const afterTarballs = fs.readdirSync(releaseDir)
  .filter((entry) => entry.endsWith('.tgz'))
  .map((entry) => path.join(releaseDir, entry));

const generatedTarballs = afterTarballs.filter((entry) => !beforeTarballs.has(entry) && entry !== finalAssetPath);
if (generatedTarballs.length !== 1) {
  throw new Error(`Expected exactly one generated tarball in ${releaseDir}, found ${generatedTarballs.length}: ${generatedTarballs.join(', ') || '(none)'}`);
}

const packedTarballPath = generatedTarballs[0];
if (packedTarballPath !== finalAssetPath) {
  fs.rmSync(finalAssetPath, { force: true });
  fs.renameSync(packedTarballPath, finalAssetPath);
}

const tarEntries = execFileSync('tar', ['-tzf', finalAssetPath], { cwd: repoRoot, encoding: 'utf8' })
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
  throw new Error(
    `Fallback release asset validation failed for ${path.relative(repoRoot, finalAssetPath)}. Missing required entries: ${missingEntries.join(', ')}`
  );
}

console.log(JSON.stringify({
  version: packageVersion,
  assetPath: path.relative(repoRoot, finalAssetPath),
  packedTarballPath: path.relative(repoRoot, packedTarballPath),
  checks: {
    hasBinEntry: true,
    hasRuntimeEntry: true,
    hasVendoredRuntime: true
  }
}, null, 2));
