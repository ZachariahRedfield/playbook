#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const repoRoot = process.cwd();
const runCyclesDir = path.join(repoRoot, '.playbook', 'run-cycles');
const stateSpaceDir = path.join(repoRoot, '.playbook', 'state-space');

const clamp01 = (value) => Math.min(1, Math.max(0, value));

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

const normalizeVector = (x, y, z) => {
  const norm = Math.sqrt((x * x) + (y * y) + (z * z));
  if (norm === 0) {
    return [0, 0, 0];
  }
  return [x / norm, y / norm, z / norm];
};

const toBloch = (metrics) => {
  const x = (2 * metrics.reuseRate) - 1;
  const y = (2 * metrics.entropyBudget) - 1;
  const z = (2 * metrics.loopClosureRate) - 1;
  const direction = normalizeVector(x, y, z);

  const coherence = clamp01(
    (0.5 * (1 - metrics.driftScore)) +
      (0.3 * metrics.compactionGain) +
      (0.2 * metrics.loopClosureRate)
  );

  const vector = [
    coherence * direction[0],
    coherence * direction[1],
    coherence * direction[2]
  ];

  const magnitude = Math.sqrt((vector[0] ** 2) + (vector[1] ** 2) + (vector[2] ** 2));
  const purity = (1 + (magnitude ** 2)) / 2;

  return {
    axes: {
      reuseRateX: x,
      entropyBudgetY: y,
      loopClosureRateZ: z
    },
    bloch: {
      direction,
      coherence,
      vector,
      magnitude,
      purity
    }
  };
};

const angularDistance = (current, previous) => {
  const dot =
    (current[0] * previous[0]) +
    (current[1] * previous[1]) +
    (current[2] * previous[2]);

  const currentNorm = Math.sqrt((current[0] ** 2) + (current[1] ** 2) + (current[2] ** 2));
  const previousNorm = Math.sqrt((previous[0] ** 2) + (previous[1] ** 2) + (previous[2] ** 2));
  const denom = (currentNorm * previousNorm) + 1e-9;
  const ratio = Math.max(-1, Math.min(1, dot / denom));
  return Math.acos(ratio);
};

const toDigest = (raw) => `sha256:${createHash('sha256').update(raw).digest('hex')}`;

const { runCyclePath } = parseArgs();
const runCycleFiles = await getRunCycleFiles();

if (!runCyclePath && runCycleFiles.length === 0) {
  throw new Error('no run cycles found in .playbook/run-cycles');
}

const selectedPath = runCyclePath ?? runCycleFiles[runCycleFiles.length - 1].absolutePath;
const selectedIndex = runCycleFiles.findIndex((file) => file.absolutePath === selectedPath);

let runCycle;
try {
  runCycle = await readJson(selectedPath);
} catch {
  throw new Error(`unable to read run cycle: ${selectedPath}`);
}
const mapped = toBloch(runCycle.metrics);

let angularDistancePrev;
let previousRunCycle;
if (selectedIndex > 0) {
  previousRunCycle = await readJson(runCycleFiles[selectedIndex - 1].absolutePath);
  const previousMapped = toBloch(previousRunCycle.metrics);
  angularDistancePrev = angularDistance(mapped.bloch.vector, previousMapped.bloch.vector);
}

const now = new Date().toISOString();
const runCycleRelative = path.relative(repoRoot, selectedPath).replaceAll(path.sep, '/');
const snapshot = {
  schemaVersion: '1.0',
  kind: 'playbook-state-space-snapshot',
  runCycleId: runCycle.runCycleId,
  projection: 'bloch-v1',
  createdAt: now,
  sourceRunCycle: {
    path: runCycleRelative
  },
  axes: mapped.axes,
  bloch: {
    ...mapped.bloch,
    ...(angularDistancePrev === undefined ? {} : { angularDistancePrev })
  },
  gateEvents: [
    {
      type: 'projection',
      at: now,
      label: 'bloch-v1-metrics-projection',
      details: {
        runCycleId: runCycle.runCycleId
      }
    },
    ...(angularDistancePrev === undefined
      ? []
      : [
          {
            type: 'rotation',
            at: now,
            label: 'delta-from-previous-run-cycle',
            details: {
              fromRunCycleId: previousRunCycle.runCycleId,
              toRunCycleId: runCycle.runCycleId,
              angularDistance: angularDistancePrev
            }
          }
        ])
  ]
};

await mkdir(stateSpaceDir, { recursive: true });
const outputPath = path.join(stateSpaceDir, `${runCycle.runCycleId}.json`);
const raw = `${JSON.stringify(snapshot, null, 2)}\n`;
await writeFile(outputPath, raw, 'utf8');
const digest = toDigest(raw);

console.log(`wrote ${path.relative(repoRoot, outputPath)}`);
console.log(`digest ${digest}`);

if (!runCycle.stateSpace) {
  console.log('RunCycle has no stateSpace field yet. To attach this artifact, set:');
  console.log(`stateSpace.projection = "bloch-v1"`);
  console.log(`stateSpace.bloch.path = "${path.relative(repoRoot, outputPath).replaceAll(path.sep, '/')}"`);
  console.log(`stateSpace.bloch.digest = "${digest}"`);
}
