import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { WorksetPlanArtifact } from '../orchestration/worksetPlan.js';
import { readJsonArtifact, writeJsonArtifact } from '../artifacts/artifactIO.js';
import {
  normalizeOutcomeTelemetryArtifact,
  normalizeProcessTelemetryArtifact,
  type OutcomeTelemetryArtifact,
  type ProcessTelemetryArtifact,
  type ProcessTelemetryRecord
} from '../telemetry/outcomeTelemetry.js';
import { computeLaneOutcomeScore } from '../telemetry/laneScoring.js';
import type { LaneRuntime, LaneRuntimeState } from '@zachariahredfield/playbook-core';

const EXECUTION_STATE_PATH = '.playbook/execution-state.json';
const PROCESS_TELEMETRY_PATH = '.playbook/process-telemetry.json';
const OUTCOME_TELEMETRY_PATH = '.playbook/outcome-telemetry.json';

export type WorkerResult = {
  status: 'completed' | 'failed';
  retries?: number;
  summary?: string;
};

export interface ExecutionRun {
  runId: string;
  startedAt: string;
  lanes: Record<string, LaneRuntime>;
}

type ExecutionStateArtifact = {
  version: 1;
  run_id: string;
  started_at: string;
  status: 'running' | 'completed' | 'failed';
  lanes: Record<string, LaneRuntime>;
  workers: Record<string, { lane_id: string; status: 'running' | 'completed' | 'failed'; retries: number; summary?: string }>;
};

const sortObject = <T>(value: Record<string, T>): Record<string, T> =>
  Object.fromEntries(Object.entries(value).sort((left, right) => left[0].localeCompare(right[0])));

const readExecutionState = (repoRoot: string): ExecutionStateArtifact =>
  readJsonArtifact<ExecutionStateArtifact>(path.join(repoRoot, EXECUTION_STATE_PATH));

const writeExecutionState = (repoRoot: string, state: ExecutionStateArtifact): void => {
  writeJsonArtifact(path.join(repoRoot, EXECUTION_STATE_PATH), {
    ...state,
    lanes: sortObject(state.lanes),
    workers: sortObject(state.workers)
  });
};

const parseRunSequence = (runId: string): number => {
  const match = /^pb-run-(\d+)$/.exec(runId);
  return match ? Number.parseInt(match[1] ?? '0', 10) : 0;
};

const nextRunId = (repoRoot: string): string => {
  const statePath = path.join(repoRoot, EXECUTION_STATE_PATH);
  if (!fs.existsSync(statePath)) {
    return 'pb-run-001';
  }

  try {
    const previous = readJsonArtifact<ExecutionStateArtifact>(statePath);
    const next = parseRunSequence(previous.run_id) + 1;
    return `pb-run-${String(next).padStart(3, '0')}`;
  } catch {
    return 'pb-run-001';
  }
};

const deterministicIso = (input: string, minSeconds = 0): string => {
  const digest = createHash('sha256').update(input).digest('hex').slice(0, 8);
  const offsetSeconds = (Number.parseInt(digest, 16) % 86400) + minSeconds;
  return new Date(offsetSeconds * 1000).toISOString();
};

const laneStartTimestamp = (runId: string, laneId: string): string => deterministicIso(`${runId}:${laneId}:start`);
const laneFinishTimestamp = (runId: string, laneId: string): string => deterministicIso(`${runId}:${laneId}:finish`, 60);

const toDurationMs = (startedAt?: string, finishedAt?: string): number => {
  if (!startedAt || !finishedAt) return 0;
  const duration = Date.parse(finishedAt) - Date.parse(startedAt);
  return Number.isFinite(duration) && duration > 0 ? duration : 0;
};

const emitSignalRecords = (repoRoot: string, laneId: string, signalValues: { laneExecutionDurationMs: number; workerSuccessRate: number; retryPressure: number }): void => {
  const telemetryPath = path.join(repoRoot, PROCESS_TELEMETRY_PATH);
  const existing: ProcessTelemetryArtifact = fs.existsSync(telemetryPath)
    ? (JSON.parse(fs.readFileSync(telemetryPath, 'utf8')) as ProcessTelemetryArtifact)
    : {
        schemaVersion: '1.0',
        kind: 'process-telemetry',
        generatedAt: new Date(0).toISOString(),
        records: [],
        summary: {
          total_records: 0,
          total_task_duration_ms: 0,
          average_task_duration_ms: 0,
          total_retry_count: 0,
          first_pass_success_count: 0,
          average_merge_conflict_risk: 0,
          total_files_touched_unique: 0,
          total_validators_run_unique: 0,
          task_family_counts: {},
          validators_run_counts: {},
          reasoning_scope_counts: { narrow: 0, module: 0, repository: 0, 'cross-repo': 0 },
          route_id_counts: {},
          task_profile_id_counts: {},
          rule_packs_selected_counts: {},
          required_validations_selected_counts: {},
          optional_validations_selected_counts: {},
          total_validation_duration_ms: 0,
          total_planning_duration_ms: 0,
          total_apply_duration_ms: 0,
          human_intervention_required_count: 0,
          actual_merge_conflict_count: 0,
          average_parallel_lane_count: 0,
          over_validation_signal_count: 0,
          under_validation_signal_count: 0
        }
      };

  const baseRecord = (id: string, signalName: string, value: number): ProcessTelemetryRecord => ({
    id,
    recordedAt: deterministicIso(id),
    task_family: signalName,
    route_id: laneId,
    task_duration_ms: signalValues.laneExecutionDurationMs,
    files_touched: [],
    validators_run: [],
    retry_count: signalValues.retryPressure,
    merge_conflict_risk: value,
    first_pass_success: signalValues.workerSuccessRate >= 1,
    prompt_size: 0,
    reasoning_scope: 'narrow'
  });

  const newRecords: ProcessTelemetryRecord[] = [
    baseRecord(`exec:${laneId}:lane_execution_duration`, 'lane_execution_duration', signalValues.laneExecutionDurationMs),
    baseRecord(`exec:${laneId}:worker_success_rate`, 'worker_success_rate', signalValues.workerSuccessRate),
    baseRecord(`exec:${laneId}:retry_pressure`, 'retry_pressure', signalValues.retryPressure)
  ];

  const merged = normalizeProcessTelemetryArtifact({
    ...existing,
    records: [...existing.records, ...newRecords],
    generatedAt: deterministicIso(`telemetry:${laneId}`)
  });

  fs.mkdirSync(path.dirname(telemetryPath), { recursive: true });
  fs.writeFileSync(telemetryPath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
};


const emitLaneOutcomeScore = (repoRoot: string, laneId: string, signalValues: { laneExecutionDurationMs: number; workerSuccessRate: number; retryPressure: number }): void => {
  const telemetryPath = path.join(repoRoot, OUTCOME_TELEMETRY_PATH);
  const existing: OutcomeTelemetryArtifact = fs.existsSync(telemetryPath)
    ? (JSON.parse(fs.readFileSync(telemetryPath, 'utf8')) as OutcomeTelemetryArtifact)
    : {
        schemaVersion: '1.0',
        kind: 'outcome-telemetry',
        generatedAt: new Date(0).toISOString(),
        records: [],
        lane_scores: [],
        summary: {
          total_records: 0,
          sum_plan_churn: 0,
          sum_apply_retries: 0,
          sum_dependency_drift: 0,
          sum_contract_breakage: 0,
          docs_mismatch_count: 0,
          ci_failure_category_counts: {}
        }
      };

  const laneScore = computeLaneOutcomeScore({
    laneId,
    executionDurationMs: signalValues.laneExecutionDurationMs,
    retryCount: signalValues.retryPressure,
    successRate: signalValues.workerSuccessRate
  });

  const merged = normalizeOutcomeTelemetryArtifact({
    ...existing,
    lane_scores: [...(existing.lane_scores ?? []), laneScore],
    generatedAt: deterministicIso(`outcome:${laneId}:${laneScore.score}`)
  });

  fs.mkdirSync(path.dirname(telemetryPath), { recursive: true });
  fs.writeFileSync(telemetryPath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
};

export async function startExecution(worksetPlan: WorksetPlanArtifact, repoRoot = process.cwd()): Promise<ExecutionRun> {
  const runId = nextRunId(repoRoot);
  const startedAt = deterministicIso(runId);

  const lanes = Object.fromEntries(
    [...worksetPlan.lanes]
      .sort((left, right) => left.lane_id.localeCompare(right.lane_id))
      .map((lane) => [
        lane.lane_id,
        {
          lane_id: lane.lane_id,
          state: lane.worker_ready ? ('ready' as LaneRuntimeState) : ('blocked' as LaneRuntimeState)
        }
      ])
  );

  writeExecutionState(repoRoot, {
    version: 1,
    run_id: runId,
    started_at: startedAt,
    status: 'running',
    lanes,
    workers: {}
  });

  return { runId, startedAt, lanes };
}

export async function updateLaneState(laneId: string, state: LaneRuntimeState, repoRoot = process.cwd()): Promise<void> {
  const execution = readExecutionState(repoRoot);
  const current = execution.lanes[laneId] ?? { lane_id: laneId, state: 'ready' as LaneRuntimeState };

  execution.lanes[laneId] = {
    ...current,
    state,
    ...(state === 'running' ? { started_at: current.started_at ?? laneStartTimestamp(execution.run_id, laneId) } : {}),
    ...(state === 'completed' || state === 'failed' ? { finished_at: laneFinishTimestamp(execution.run_id, laneId) } : {})
  };

  writeExecutionState(repoRoot, execution);
}

export async function recordWorkerResult(laneId: string, workerId: string, result: WorkerResult, repoRoot = process.cwd()): Promise<void> {
  const execution = readExecutionState(repoRoot);
  const lane = execution.lanes[laneId] ?? { lane_id: laneId, state: 'ready' as LaneRuntimeState };
  const finalState = result.status === 'completed' ? 'completed' : 'failed';
  const startedAt = lane.started_at ?? laneStartTimestamp(execution.run_id, laneId);
  const finishedAt = laneFinishTimestamp(execution.run_id, laneId);

  execution.lanes[laneId] = {
    ...lane,
    state: finalState,
    started_at: startedAt,
    finished_at: finishedAt,
    worker: workerId
  };

  execution.workers[workerId] = {
    lane_id: laneId,
    status: finalState,
    retries: Math.max(0, Math.trunc(result.retries ?? 0)),
    ...(result.summary ? { summary: result.summary } : {})
  };

  const durationMs = toDurationMs(startedAt, finishedAt);
  const scoreSignals = {
    laneExecutionDurationMs: durationMs,
    workerSuccessRate: finalState === 'completed' ? 1 : 0,
    retryPressure: Math.max(0, Math.trunc(result.retries ?? 0))
  };

  emitSignalRecords(repoRoot, laneId, scoreSignals);
  emitLaneOutcomeScore(repoRoot, laneId, scoreSignals);

  writeExecutionState(repoRoot, execution);
}

export async function finalizeExecution(runId: string, repoRoot = process.cwd()): Promise<void> {
  const execution = readExecutionState(repoRoot);
  if (execution.run_id !== runId) {
    return;
  }

  const laneStates = Object.values(execution.lanes).map((lane) => lane.state);
  execution.status = laneStates.some((state) => state === 'failed') ? 'failed' : laneStates.every((state) => state === 'completed') ? 'completed' : 'running';
  writeExecutionState(repoRoot, execution);
}
