import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PNPM_BIN, run, runLogged } from './exec-runner.mjs';

const repoRoot = path.resolve('.');
const nodeBin = process.execPath;
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-pack-smoke-'));
const tarballDir = path.join(tempRoot, 'tarballs');
const ensureFile = (filePath, label) => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`pack-smoke failed: missing ${label} at ${filePath}`);
  }
};

const ensurePlaybookConfig = (projectDir) => {
  const legacyConfigPath = path.join(projectDir, 'playbook.config.json');
  const modernConfigPath = path.join(projectDir, '.playbook', 'config.json');

  if (!fs.existsSync(legacyConfigPath) && !fs.existsSync(modernConfigPath)) {
    throw new Error(
      'pack-smoke failed: missing Playbook config (expected playbook.config.json or .playbook/config.json)'
    );
  }
};

const ensureInitScaffoldContract = (projectDir) => {
  ensurePlaybookConfig(projectDir);
  ensureFile(path.join(projectDir, 'docs', 'PLAYBOOK_NOTES.md'), 'docs/PLAYBOOK_NOTES.md');

  // `init` guarantees notes + config. Governance docs are supported when a
  // project opts into them, but they are not required baseline scaffold output.
};

const ensureInstalledCliContract = (projectDir) => {
  const installedPkgDir = path.join(projectDir, 'node_modules', '@fawxzzy', 'playbook-cli');
  const installedPkg = JSON.parse(fs.readFileSync(path.join(installedPkgDir, 'package.json'), 'utf8'));
  const binPath = path.join(installedPkgDir, installedPkg.bin.playbook);

  ensureFile(binPath, 'installed CLI bin target');
  return binPath;
};

const readPackedPackageJson = (tarballPath) => {
  const raw = run('tar', ['-xOf', tarballPath, 'package/package.json']);
  return JSON.parse(raw);
};


const ensureBuilt = () => {
  const buildTargets = [
    {
      packageDir: 'packages/core',
      expected: path.join(repoRoot, 'packages/core/dist/index.js')
    },
    {
      packageDir: 'packages/engine',
      expected: path.join(repoRoot, 'packages/engine/dist/index.js')
    },
    {
      packageDir: 'packages/node',
      expected: path.join(repoRoot, 'packages/node/dist/index.js')
    },
    {
      packageDir: 'packages/cli',
      expected: path.join(repoRoot, 'packages/cli/dist/main.js')
    },
    {
      packageDir: 'packages/cli',
      expected: path.join(repoRoot, 'packages/cli/dist/templates/repo')
    },
    {
      packageDir: 'packages/cli-wrapper',
      expected: path.join(repoRoot, 'packages/cli-wrapper/bin/playbook.js')
    }
  ];

  for (const target of buildTargets) {
    if (!fs.existsSync(target.expected)) {
      console.log(`[pack-smoke] building ${target.packageDir} (missing ${target.expected})`);
      runLogged(PNPM_BIN, ['-C', target.packageDir, 'build'], { cwd: repoRoot });
    }
  }
};

const packPackage = (packageDir) => {
  const output = run(PNPM_BIN, ['-C', packageDir, 'pack', '--pack-destination', tarballDir], {
    cwd: repoRoot
  });

  const tarballName = output
    .trim()
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .at(-1);

  if (!tarballName || !tarballName.endsWith('.tgz')) {
    throw new Error(`pack-smoke failed: unable to parse tarball name for ${packageDir}`);
  }

  const tarballPath = path.resolve(tarballDir, tarballName);
  ensureFile(tarballPath, `${packageDir} tarball`);
  return tarballPath;
};

const installFromTarballs = (projectDir, tarballs) => {
  try {
    runLogged('npm', ['install', '--no-audit', '--no-fund', ...tarballs], { cwd: projectDir });
    console.log('[pack-smoke] install mode=npm');
    return;
  } catch {
    console.log('[pack-smoke] npm install failed; falling back to local tarball extraction');
  }

  const nodeModulesDir = path.join(projectDir, 'node_modules');
  fs.mkdirSync(nodeModulesDir, { recursive: true });

  for (const tarballPath of tarballs) {
    const pkg = readPackedPackageJson(tarballPath);
    const [scope, name] = pkg.name.split('/');
    const packageDir = pkg.name.startsWith('@')
      ? path.join(nodeModulesDir, scope, name)
      : path.join(nodeModulesDir, pkg.name);

    fs.mkdirSync(packageDir, { recursive: true });
    run('tar', ['-xzf', tarballPath, '-C', packageDir, '--strip-components=1']);
  }

  console.log('[pack-smoke] install mode=tar-extract');
};

fs.mkdirSync(tarballDir, { recursive: true });

let smokePassed = false;
try {
  const nodeVersion = run(nodeBin, ['-v']).trim();
  const pnpmVersion = run(PNPM_BIN, ['-v']).trim();
  console.log(`[pack-smoke] node=${nodeVersion} pnpm=${pnpmVersion}`);
  ensureBuilt();

  const cliTarball = packPackage('packages/cli');
  const cliWrapperTarball = packPackage('packages/cli-wrapper');
  const dependencyTarballs = [
    packPackage('packages/core'),
    packPackage('packages/engine'),
    packPackage('packages/node')
  ];

  const projectDir = path.join(tempRoot, 'project');
  fs.mkdirSync(projectDir, { recursive: true });

  fs.writeFileSync(
    path.join(projectDir, 'package.json'),
    JSON.stringify({ name: 'playbook-pack-smoke', private: true, version: '1.0.0' }, null, 2)
  );

  installFromTarballs(projectDir, [...dependencyTarballs, cliTarball, cliWrapperTarball]);
  const binPath = ensureInstalledCliContract(projectDir);

  runLogged(nodeBin, [binPath, '--help'], { cwd: projectDir });
  runLogged(nodeBin, [binPath, 'init'], { cwd: projectDir });
  runLogged(nodeBin, [binPath, 'ai-context', '--json'], { cwd: projectDir });
  runLogged(nodeBin, [binPath, 'ai-contract', '--json'], { cwd: projectDir });
  runLogged(nodeBin, [binPath, 'context', '--json'], { cwd: projectDir });
  runLogged(nodeBin, [binPath, 'index', '--json'], { cwd: projectDir });
  runLogged(nodeBin, [binPath, 'query', 'modules', '--json'], { cwd: projectDir });
  runLogged(nodeBin, [binPath, 'explain', 'architecture', '--json'], { cwd: projectDir });
  runLogged(nodeBin, [binPath, 'verify', '--json'], { cwd: projectDir });
  runLogged(nodeBin, [binPath, 'plan', '--json'], { cwd: projectDir });
  runLogged(nodeBin, [binPath, 'pilot', '--repo', projectDir, '--json'], { cwd: projectDir });

  ensureFile(path.join(projectDir, '.playbook', 'findings.json'), '.playbook/findings.json');
  ensureFile(path.join(projectDir, '.playbook', 'plan.json'), '.playbook/plan.json');
  ensureFile(path.join(projectDir, '.playbook', 'repo-graph.json'), '.playbook/repo-graph.json');
  const runArtifactsDir = path.join(projectDir, '.playbook', 'runs');
  if (!fs.existsSync(runArtifactsDir) || fs.readdirSync(runArtifactsDir).filter((name) => name.endsWith('.json')).length === 0) {
    throw new Error('pack-smoke failed: expected execution run artifacts under .playbook/runs/*.json');
  }

  ensureInitScaffoldContract(projectDir);

  smokePassed = true;
  console.log('[pack-smoke] passed');
} finally {
  if (smokePassed) {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  } else {
    console.log(`[pack-smoke] retained temp dir for debugging: ${tempRoot}`);
  }
}
