#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generateContractSnapshots, repoRoot } from './contract-snapshot-lib.mjs';

const committedSnapshotDir = path.join(repoRoot, 'tests', 'contracts');
const cliEntry = path.join(repoRoot, 'packages', 'cli', 'dist', 'main.js');

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

if (!fs.existsSync(cliEntry)) {
  fail('Contract surface changed or could not be checked because the built CLI is missing. Run `pnpm -r build` first, then rerun `pnpm contracts:check`.');
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-contract-check-'));
const generatedSnapshotDir = path.join(tempRoot, 'tests', 'contracts');
const generatedFiles = generateContractSnapshots(generatedSnapshotDir).sort((a, b) => a.localeCompare(b));

const changedFiles = [];
for (const file of generatedFiles) {
  const generatedPath = path.join(generatedSnapshotDir, file);
  const committedPath = path.join(committedSnapshotDir, file);
  const generated = fs.readFileSync(generatedPath, 'utf8');
  const committed = fs.existsSync(committedPath) ? fs.readFileSync(committedPath, 'utf8') : null;
  if (committed !== generated) {
    changedFiles.push(file);
  }
}

const contractsSnapshotPath = path.join(generatedSnapshotDir, 'contracts.snapshot.json');
const contractsSnapshot = JSON.parse(fs.readFileSync(contractsSnapshotPath, 'utf8'));
const memoryArtifacts = Array.isArray(contractsSnapshot?.schemas?.memoryArtifacts) ? contractsSnapshot.schemas.memoryArtifacts : [];
const byId = new Map();
for (const entry of memoryArtifacts) {
  const id = entry?.id;
  if (typeof id !== 'string') continue;
  byId.set(id, [...(byId.get(id) ?? []), entry]);
}
const duplicateIds = [...byId.entries()].filter(([, entries]) => entries.length > 1).map(([id]) => id);
if (duplicateIds.length > 0) {
  fail(`Contract surface changed: duplicate schema ids detected in contracts snapshot (${duplicateIds.join(', ')}). Inspect ids / versions / paths before updating snapshots.`);
}

const requiredEntries = {
  'session-replay-evidence': '.playbook/memory/replay-candidates.json#replayEvidence',
  'replay-candidates': '.playbook/memory/replay-candidates.json',
  'consolidation-candidates': '.playbook/memory/consolidation-candidates.json'
};
for (const [id, expectedPath] of Object.entries(requiredEntries)) {
  const entry = memoryArtifacts.find((candidate) => candidate?.id === id);
  if (!entry || entry.path !== expectedPath) {
    fail(`Contract surface changed: expected ${id} -> ${expectedPath}. Inspect ids / versions / paths and update snapshots only after confirming intent.`);
  }
}

if (memoryArtifacts.some((entry) => entry?.id === 'memory-replay-result')) {
  fail('Contract surface changed: obsolete memory-replay-result registry entry is still present. Remove or justify it before updating snapshots.');
}

if (changedFiles.length > 0) {
  fail([
    'Contract surface changed: committed CLI contract snapshots are out of date.',
    'Inspect ids / versions / paths, confirm the change is intentional, then run `pnpm test:update-snapshots`.',
    `Changed snapshot files: ${changedFiles.join(', ')}`
  ].join('\n'));
}

console.log(`Contract surface check passed for ${generatedFiles.length} snapshot(s).`);
