import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const require = createRequire(import.meta.url);

const cliDir = path.join(repoRoot, 'packages', 'cli');
const cliDistDir = path.join(cliDir, 'dist');
const wrapperRuntimeDir = path.join(repoRoot, 'packages', 'cli-wrapper', 'runtime');
const workspacePackages = [
  path.join(repoRoot, 'packages', 'core'),
  path.join(repoRoot, 'packages', 'engine'),
  path.join(repoRoot, 'packages', 'node')
];

const copiedExternalPackages = new Set();

const ensureExists = (target, message) => {
  if (!fs.existsSync(target)) {
    throw new Error(message);
  }
};

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

const requiredBuildOutputs = [
  {
    target: cliDistDir,
    message: `Missing CLI dist at ${cliDistDir}. Run "pnpm -r build" before packing the cli-wrapper.`
  },
  ...workspacePackages.map((packageDir) => ({
    target: path.join(packageDir, 'dist'),
    message: `Missing dependency dist at ${path.join(packageDir, 'dist')}. Run "pnpm -r build" before packing the cli-wrapper.`
  }))
];

const missingBuildOutputs = requiredBuildOutputs
  .filter(({ target }) => !fs.existsSync(target))
  .map(({ message }) => message);

if (missingBuildOutputs.length > 0) {
  throw new Error(missingBuildOutputs.join('\n'));
}

const copyExternalPackage = (packageName, fromDir) => {
  if (copiedExternalPackages.has(packageName)) return;

  const resolvedPackageJsonPath = require.resolve(`${packageName}/package.json`, { paths: [fromDir] });
  const sourceDir = path.dirname(resolvedPackageJsonPath);
  const targetDir = path.join(wrapperRuntimeDir, 'node_modules', ...packageName.split('/'));

  fs.mkdirSync(path.dirname(targetDir), { recursive: true });
  fs.cpSync(sourceDir, targetDir, { recursive: true });
  copiedExternalPackages.add(packageName);

  const packageJson = readJson(resolvedPackageJsonPath);
  const dependencies = packageJson.dependencies ?? {};
  for (const dependencyName of Object.keys(dependencies)) {
    copyExternalPackage(dependencyName, sourceDir);
  }
};

fs.rmSync(wrapperRuntimeDir, { recursive: true, force: true });
fs.mkdirSync(wrapperRuntimeDir, { recursive: true });
fs.cpSync(cliDistDir, wrapperRuntimeDir, { recursive: true });

for (const packageDir of workspacePackages) {
  const packageJsonPath = path.join(packageDir, 'package.json');
  const distDir = path.join(packageDir, 'dist');

  ensureExists(packageJsonPath, `Missing package.json at ${packageJsonPath}.`);

  const packageJson = readJson(packageJsonPath);
  const vendorDir = path.join(wrapperRuntimeDir, 'node_modules', ...packageJson.name.split('/'));
  fs.mkdirSync(vendorDir, { recursive: true });
  fs.cpSync(distDir, path.join(vendorDir, 'dist'), { recursive: true });

  fs.writeFileSync(
    path.join(vendorDir, 'package.json'),
    JSON.stringify(
      {
        name: packageJson.name,
        version: packageJson.version,
        type: packageJson.type,
        main: packageJson.main,
        exports: packageJson.exports,
        types: packageJson.types
      },
      null,
      2
    ) + '\n'
  );

  const dependencies = packageJson.dependencies ?? {};
  for (const [dependencyName, dependencyVersion] of Object.entries(dependencies)) {
    if (!String(dependencyVersion).startsWith('workspace:')) {
      copyExternalPackage(dependencyName, packageDir);
    }
  }
}

console.log('Prepared cli-wrapper runtime');
