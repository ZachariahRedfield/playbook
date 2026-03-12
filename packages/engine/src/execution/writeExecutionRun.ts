import fs from 'node:fs';
import path from 'node:path';
import type { ExecutionRun } from './runContract.js';

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalize(entry));
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort((left, right) => left.localeCompare(right));
    const normalized: Record<string, unknown> = {};

    for (const key of keys) {
      const entry = canonicalize(record[key]);
      if (entry !== undefined) {
        normalized[key] = entry;
      }
    }

    return normalized;
  }

  if (typeof value === 'undefined' || typeof value === 'function' || typeof value === 'symbol') {
    return undefined;
  }

  return value;
};

const deterministicStringify = (value: unknown): string => `${JSON.stringify(canonicalize(value), null, 2)}\n`;

const runsDirectory = (repoRoot: string): string => path.join(repoRoot, '.playbook', 'runs');

export const executionRunPath = (repoRoot: string, runId: string): string => path.join(runsDirectory(repoRoot), `${runId}.json`);

export const writeExecutionRun = (repoRoot: string, run: ExecutionRun): string => {
  const artifactPath = executionRunPath(repoRoot, run.id);
  const parentDir = path.dirname(artifactPath);
  fs.mkdirSync(parentDir, { recursive: true });

  const tempPath = path.join(parentDir, `.${path.basename(artifactPath)}.${process.pid}.${Date.now()}.tmp`);

  try {
    fs.writeFileSync(tempPath, deterministicStringify(run), { encoding: 'utf8' });
    fs.renameSync(tempPath, artifactPath);
    return artifactPath;
  } catch (error) {
    if (fs.existsSync(tempPath)) {
      fs.rmSync(tempPath, { force: true });
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to write execution run at ${artifactPath}: ${message}`);
  }
};

export const readExecutionRun = (repoRoot: string, runId: string): ExecutionRun => {
  const artifactPath = executionRunPath(repoRoot, runId);
  const raw = fs.readFileSync(artifactPath, 'utf8');
  const parsed = JSON.parse(raw) as ExecutionRun;

  if (!parsed || typeof parsed !== 'object' || parsed.version !== 1) {
    throw new Error(`Invalid execution run artifact at ${artifactPath}.`);
  }

  return parsed;
};

export const listExecutionRuns = (repoRoot: string): ExecutionRun[] => {
  const root = runsDirectory(repoRoot);
  if (!fs.existsSync(root)) {
    return [];
  }

  const files = fs
    .readdirSync(root)
    .filter((entry) => entry.endsWith('.json'))
    .sort((left, right) => left.localeCompare(right));

  return files
    .map((entry) => {
      const raw = fs.readFileSync(path.join(root, entry), 'utf8');
      return JSON.parse(raw) as ExecutionRun;
    })
    .filter((run) => run && typeof run === 'object' && run.version === 1);
};

export const getLatestMutableRun = (repoRoot: string): ExecutionRun | null => {
  const candidates = listExecutionRuns(repoRoot)
    .filter((run) => !run.frozen)
    .sort((left, right) => left.created_at.localeCompare(right.created_at));

  if (candidates.length === 0) {
    return null;
  }

  return candidates[candidates.length - 1] ?? null;
};
