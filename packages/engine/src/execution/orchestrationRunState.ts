import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { WorkerLaunchPlanArtifact } from '../orchestration/workerLaunchPlan.js';

export type OrchestrationLaneStatus = 'pending' | 'running' | 'completed' | 'failed' | 'blocked';

export type OrchestrationLaneRunState = {
  lane_id: string;
  status: OrchestrationLaneStatus;
  blocker_refs: string[];
  receipt_refs: string[];
  worker_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
};

export type OrchestrationExecutionRunState = {
  schemaVersion: '1.0';
  kind: 'orchestration-execution-run-state';
  run_id: string;
  source_launch_plan_fingerprint: string;
  eligible_lanes: string[];
  status: 'running' | 'completed' | 'failed';
  lanes: Record<string, OrchestrationLaneRunState>;
  metadata: {
    runtime: 'execution-supervisor';
    resumed_from_interrupted_run: boolean;
    reconcile_revision: number;
    runtime_capability_fingerprint?: string | null;
  };
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

const executionRunsDirectory = (repoRoot: string): string => path.join(repoRoot, '.playbook', 'execution-runs');

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalize(entry));
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const sortedKeys = Object.keys(record).sort((left, right) => left.localeCompare(right));
    const next: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      const normalized = canonicalize(record[key]);
      if (normalized !== undefined) {
        next[key] = normalized;
      }
    }
    return next;
  }
  if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'undefined') {
    return undefined;
  }
  return value;
};

const deterministicStringify = (value: unknown): string => `${JSON.stringify(canonicalize(value), null, 2)}\n`;

const writeJsonAtomic = (artifactPath: string, value: unknown): void => {
  fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
  const tempPath = path.join(path.dirname(artifactPath), `.${path.basename(artifactPath)}.${process.pid}.${Date.now()}.tmp`);
  try {
    fs.writeFileSync(tempPath, deterministicStringify(value), 'utf8');
    fs.renameSync(tempPath, artifactPath);
  } finally {
    if (fs.existsSync(tempPath)) {
      fs.rmSync(tempPath, { force: true });
    }
  }
};

export const computeLaunchPlanFingerprint = (launchPlan: WorkerLaunchPlanArtifact): string =>
  createHash('sha256').update(deterministicStringify(launchPlan), 'utf8').digest('hex');

export const deriveOrchestrationRunId = (launchPlan: WorkerLaunchPlanArtifact): string =>
  `pb-exec-${computeLaunchPlanFingerprint(launchPlan).slice(0, 12)}`;

export const orchestrationExecutionRunPath = (repoRoot: string, runId: string): string =>
  path.join(executionRunsDirectory(repoRoot), `${runId}.json`);

export const readOrchestrationExecutionRun = (repoRoot: string, runId: string): OrchestrationExecutionRunState => {
  const artifactPath = orchestrationExecutionRunPath(repoRoot, runId);
  const parsed = JSON.parse(fs.readFileSync(artifactPath, 'utf8')) as OrchestrationExecutionRunState;
  if (!parsed || parsed.kind !== 'orchestration-execution-run-state' || parsed.schemaVersion !== '1.0') {
    throw new Error(`Invalid orchestration execution run-state artifact at ${artifactPath}.`);
  }
  return parsed;
};

export const writeOrchestrationExecutionRun = (repoRoot: string, state: OrchestrationExecutionRunState): string => {
  const artifactPath = orchestrationExecutionRunPath(repoRoot, state.run_id);
  writeJsonAtomic(artifactPath, state);
  return artifactPath;
};

export const listOrchestrationExecutionRuns = (repoRoot: string): OrchestrationExecutionRunState[] => {
  const root = executionRunsDirectory(repoRoot);
  if (!fs.existsSync(root)) {
    return [];
  }

  const files = fs
    .readdirSync(root)
    .filter((entry) => entry.endsWith('.json'))
    .sort((left, right) => left.localeCompare(right));

  return files.map((entry) => readOrchestrationExecutionRun(repoRoot, entry.replace(/\.json$/u, '')));
};
