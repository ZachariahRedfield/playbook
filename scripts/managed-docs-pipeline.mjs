#!/usr/bin/env node
import fs from 'node:fs/promises';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import {
  countChangedManagedDocsArtifacts,
  generateManagedDocsArtifacts,
  repoRoot,
  writeManagedDocsArtifacts
} from './managed-docs-lib.mjs';
import { withOverlayWorkspace } from './staged-artifact-workflow.mjs';

const args = new Set(process.argv.slice(2));
const checkMode = args.has('--check');

const runCommand = (cwd, command, commandArgs) => {
  const result = spawnSync(command, commandArgs, {
    cwd,
    encoding: 'utf8',
    stdio: 'pipe',
    env: process.env
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${commandArgs.join(' ')} failed with exit code ${result.status ?? 1}.`);
  }
};

const main = async () => {
  const outputs = await generateManagedDocsArtifacts();
  const changedFiles = countChangedManagedDocsArtifacts(outputs);
  await withOverlayWorkspace({ repoRoot, overrides: outputs, prefix: 'playbook-managed-docs-' }, async (overlayRoot) => {
    runCommand(overlayRoot, 'node', ['scripts/validate-roadmap-contract.mjs', '--ci']);
    runCommand(overlayRoot, 'node', ['scripts/run-playbook.mjs', 'docs', 'audit', '--ci', '--json']);
  });

  if (checkMode) {
    if (changedFiles > 0) {
      console.error(`Managed docs are stale in ${changedFiles} file(s). Run "pnpm docs:update".`);
      process.exitCode = 1;
      return;
    }
    console.log('Managed docs are up to date.');
    return;
  }

  if (changedFiles === 0) {
    console.log('Managed docs already up to date.');
    return;
  }

  await writeManagedDocsArtifacts(outputs);
  console.log(`Updated managed docs in ${changedFiles} file(s) after generate → validate → promote.`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
