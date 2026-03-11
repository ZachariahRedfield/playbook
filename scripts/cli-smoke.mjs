import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = path.resolve('.');
const nodeBin = process.execPath;
const cliPath = path.join(repoRoot, 'packages/cli/dist/main.js');

if (!fs.existsSync(cliPath)) {
  throw new Error('cli-smoke failed: missing packages/cli/dist/main.js. Run "pnpm build" first.');
}

const runCommand = ({ args, cwd, artifactFile, allowedExitCodes = [0], useCliOut = false }) => {
  const result = spawnSync(nodeBin, [cliPath, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env }
  });

  if (result.error) {
    throw result.error;
  }

  const status = typeof result.status === 'number' ? result.status : 1;
  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';

  if (artifactFile) {
    const target = path.join(cwd, artifactFile);
    if (useCliOut) {
      if (!fs.existsSync(target)) {
        throw new Error(`cli-smoke failed: expected CLI --out artifact at ${artifactFile}`);
      }
    } else {
      fs.writeFileSync(target, stdout, 'utf8');
    }
  }

  if (!allowedExitCodes.includes(status)) {
    throw new Error(
      `cli-smoke failed: \`${['playbook', ...args].join(' ')}\` exited ${status}\nstdout:\n${stdout}\nstderr:\n${stderr}`
    );
  }

  if (stderr.toLowerCase().includes('error:') || stderr.toLowerCase().includes('uncaught')) {
    throw new Error(
      `cli-smoke failed: runtime error signal detected in stderr for \`${['playbook', ...args].join(' ')}\`\n${stderr}`
    );
  }
};

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-cli-smoke-'));
const projectDir = path.join(tempRoot, 'project');

let passed = false;
try {
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(
    path.join(projectDir, 'package.json'),
    JSON.stringify({ name: 'playbook-cli-smoke', private: true, version: '1.0.0' }, null, 2),
    'utf8'
  );

  runCommand({ args: ['init'], cwd: projectDir });

  const artifactsDir = path.join(projectDir, '.playbook', 'test-artifacts');
  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.mkdirSync(path.join(projectDir, 'tmp'), { recursive: true });

  runCommand({ args: ['index'], cwd: projectDir, artifactFile: '.playbook/test-artifacts/index.txt' });
  runCommand({ args: ['rules', '--json'], cwd: projectDir, artifactFile: '.playbook/test-artifacts/rules.json' });
  runCommand({ args: ['explain', 'PB001', '--json'], cwd: projectDir, artifactFile: '.playbook/test-artifacts/explain-rule.json' });
  runCommand({ args: ['explain', 'architecture', '--json'], cwd: projectDir, artifactFile: '.playbook/test-artifacts/explain-architecture.json' });
  runCommand({ args: ['verify', '--json', '--out', '.playbook/test-artifacts/verify.json'], cwd: projectDir, artifactFile: '.playbook/test-artifacts/verify.json', allowedExitCodes: [0, 3], useCliOut: true });
  runCommand({ args: ['plan', '--json', '--out', '.playbook/test-artifacts/plan.json'], cwd: projectDir, artifactFile: '.playbook/test-artifacts/plan.json', useCliOut: true });
  runCommand({ args: ['apply', '--json'], cwd: projectDir, artifactFile: '.playbook/test-artifacts/apply.json' });
  runCommand({ args: ['doctor'], cwd: projectDir, artifactFile: '.playbook/test-artifacts/doctor.txt' });
  runCommand({ args: ['ask', 'what architecture is this repo?'], cwd: projectDir, artifactFile: '.playbook/test-artifacts/ask.txt' });
  runCommand({ args: ['query', 'modules', '--json', '--out', '.playbook/test-artifacts/query.json'], cwd: projectDir, artifactFile: '.playbook/test-artifacts/query.json', useCliOut: true });
  runCommand({ args: ['diagram', '--repo', '.', '--out', 'tmp/diagram.md'], cwd: projectDir, artifactFile: '.playbook/test-artifacts/diagram.txt' });

  const diagramPath = path.join(projectDir, 'tmp', 'diagram.md');
  if (!fs.existsSync(diagramPath)) {
    throw new Error('cli-smoke failed: expected diagram output at tmp/diagram.md');
  }

  console.log(`[cli-smoke] artifacts: ${artifactsDir}`);
  console.log('[cli-smoke] passed');
  passed = true;
} finally {
  if (passed) {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  } else {
    console.log(`[cli-smoke] retained fixture for debugging: ${tempRoot}`);
  }
}
