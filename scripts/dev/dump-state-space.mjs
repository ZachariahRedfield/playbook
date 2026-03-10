#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const repoRoot = process.cwd();
const runCyclesDir = path.join(repoRoot, '.playbook', 'run-cycles');
const stateSpaceDir = path.join(repoRoot, '.playbook', 'state-space');

const parseArgs = () => {
  const args = process.argv.slice(2);
  const runCycleFlag = args.indexOf('--runCycle');
  if (runCycleFlag >= 0) {
    const candidate = args[runCycleFlag + 1];
    if (!candidate) {
      throw new Error('missing value for --runCycle');
    }
    return { runCyclePath: path.resolve(repoRoot, candidate) };
  }
  return { runCyclePath: undefined };
};

const readJson = async (filePath) => JSON.parse(await readFile(filePath, 'utf8'));
const digestText = (raw) => `sha256:${createHash('sha256').update(raw).digest('hex')}`;

const getRunCycleFiles = async () => {
  let entries = [];
  try {
    entries = await readdir(runCyclesDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const files = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) {
      continue;
    }

    const absolutePath = path.join(runCyclesDir, entry.name);
    const fileStat = await stat(absolutePath);
    files.push({ absolutePath, mtimeMs: fileStat.mtimeMs });
  }

  files.sort((a, b) => a.mtimeMs - b.mtimeMs);
  return files;
};

const loadPreviousSnapshot = async (runCycleFiles, selectedIndex) => {
  if (selectedIndex <= 0) {
    return undefined;
  }

  for (let index = selectedIndex - 1; index >= 0; index -= 1) {
    const candidate = await readJson(runCycleFiles[index].absolutePath);
    const stateSpacePath = candidate?.stateSpace?.bloch?.path;
    if (!stateSpacePath) {
      continue;
    }

    const absoluteStateSpacePath = path.join(repoRoot, stateSpacePath);
    try {
      return await readJson(absoluteStateSpacePath);
    } catch {
      continue;
    }
  }

  return undefined;
};

const { runCyclePath } = parseArgs();
const runCycleFiles = await getRunCycleFiles();
if (!runCyclePath && runCycleFiles.length === 0) {
  throw new Error('no run cycles found in .playbook/run-cycles');
}

const selectedPath = runCyclePath ?? runCycleFiles[runCycleFiles.length - 1].absolutePath;
const selectedIndex = runCycleFiles.findIndex((file) => file.absolutePath === selectedPath);
if (selectedIndex === -1 && !runCyclePath) {
  throw new Error(`unable to locate run cycle: ${selectedPath}`);
}

const runCycle = await readJson(selectedPath);
const runCycleRelative = path.relative(repoRoot, selectedPath).replaceAll(path.sep, '/');
const runCycleRaw = await readFile(selectedPath, 'utf8');
const sourceRunCycle = {
  path: runCycleRelative,
  digest: digestText(runCycleRaw)
};

const previousSnapshot = await loadPreviousSnapshot(runCycleFiles, selectedIndex);

const { buildStateSpaceSnapshot } = await import(path.join(repoRoot, 'packages/engine/dist/stateSpace/buildStateSpaceSnapshot.js'));
const snapshot = buildStateSpaceSnapshot({
  runCycle,
  sourceRunCycle,
  prevSnapshot: previousSnapshot
});

await mkdir(stateSpaceDir, { recursive: true });
const outputRelative = `.playbook/state-space/${runCycle.runCycleId}.json`;
const outputPath = path.join(repoRoot, outputRelative);
const snapshotRaw = `${JSON.stringify(snapshot, null, 2)}\n`;
await writeFile(outputPath, snapshotRaw, 'utf8');

runCycle.stateSpace = {
  projection: 'bloch-v1',
  bloch: {
    path: outputRelative,
    digest: digestText(snapshotRaw)
  }
};

await writeFile(selectedPath, `${JSON.stringify(runCycle, null, 2)}\n`, 'utf8');

console.log(`wrote ${outputRelative}`);
console.log(`updated ${runCycleRelative}`);
