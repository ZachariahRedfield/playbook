import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { WorksetPlanArtifact } from '../orchestration/worksetPlan.js';
import type { WorkerLaunchPlanArtifact } from '../orchestration/workerLaunchPlan.js';
import { readJsonArtifact, writeJsonArtifact } from '../artifacts/artifactIO.js';
import {
  normalizeOutcomeTelemetryArtifact,
  normalizeProcessTelemetryArtifact,
  type OutcomeTelemetryArtifact,
  type ProcessTelemetryArtifact,
  type ProcessTelemetryRecord
} from '../telemetry/outcomeTelemetry.js';
import { computeLaneOutcomeScore } from '../telemetry/laneScoring.js';
import { computeRouterAccuracyMetric } from '../telemetry/routerAccuracy.js';
import type { LaneRuntime, LaneRuntimeState } from '@zachariahredfield/playbook-core';
import {
  computeLaunchPlanFingerprint,
  deriveOrchestrationRunId,
  readOrchestrationExecutionRun,
  type OrchestrationExecutionRunState,
  type OrchestrationLaneStatus,
  writeOrchestrationExecutionRun
} from './orchestrationRunState.js';
import { evaluateExecutionMergeGuards } from './mergeGuards.js';

const EXECUTION_STATE_PATH = '.playbook/execution-state.json';
const PROCESS_TELEMETRY_PATH = '.playbook/process-telemetry.json';
const OUTCOME_TELEMETRY_PATH = '.playbook/outcome-telemetry.json';
const EXECUTION_PLAN_PATH = '.playbook/execution-plan.json';
const WORKSET_PLAN_PATH = '.playbook/workset-plan.json';

export type WorkerResult = {
  status: 'completed' | 'failed';
  retries?: number;
  summary?: string;
};

export interface ExecutionRun {
  runId: string;
  startedAt: string;
  resumed: boolean;
  eligibleLaneIds: string[];
  laneStatuses: Record<string, OrchestrationLaneStatus>;
  lanes: Record<string, LaneRuntime & { protected_doc_consolidation?: { has_protected_doc_work: boolean; stage: 'not_applicable' | 'pending' | 'blocked' | 'plan_ready' | 'applied'; summary: string; next_command: string | null } }>;
}

type ExecutionStateArtifact = {
  version: 1;
  run_id: string;
  started_at: string;
  status: 'running' | 'completed' | 'failed';
  lanes: Record<string, LaneRuntime & { protected_doc_consolidation?: { has_protected_doc_work: boolean; stage: 'not_applicable' | 'pending' | 'blocked' | 'plan_ready' | 'applied'; summary: string; next_command: string | null } }>;
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

const deterministicIso = (input: string, minSeconds = 0): string => {
  const digest = createHash('sha256').update(input).digest('hex').slice(0, 8);
  const offsetSeconds = (Number.parseInt(digest, 16) % 86400) + minSeconds;
  return new Date(offsetSeconds * 1000).toISOString();
};

const laneStartTimestamp = (runId: string, laneId: string): string => deterministicIso(`${runId}:${laneId}:start`);
const laneFinishTimestamp = (runId: string, laneId: string): string => deterministicIso(`${runId}:${laneId}:finish`, 60);

const deriveRunStatus = (laneStatuses: OrchestrationLaneStatus[]): OrchestrationExecutionRunState['status'] => {
  if (laneStatuses.some((state) => state === 'failed')) {
    return 'failed';
  }
  if (laneStatuses.every((state) => state === 'completed' || state === 'blocked')) {
    return 'completed';
  }
  return 'running';
};

const reconcileOrchestrationRunState = (
  repoRoot: string,
  runId: string,
  launchPlan: WorkerLaunchPlanArtifact,
  startedAt: string,
  runtimeCapabilityFingerprint: string | null = null
): OrchestrationExecutionRunState => {
  const launchFingerprint = computeLaunchPlanFingerprint(launchPlan);
  const now = new Date().toISOString();
  const launchByLaneId = new Map(launchPlan.lanes.map((lane) => [lane.lane_id, lane]));
  const eligibleLaneIds = launchPlan.lanes.filter((lane) => lane.launchEligible).map((lane) => lane.lane_id).sort((left, right) => left.localeCompare(right));

  let prior: OrchestrationExecutionRunState | null = null;
  try {
    prior = readOrchestrationExecutionRun(repoRoot, runId);
  } catch {
    prior = null;
  }

  if (prior && prior.source_launch_plan_fingerprint !== launchFingerprint) {
    prior = null;
  }

  const laneIds = launchPlan.lanes.map((lane) => lane.lane_id).sort((left, right) => left.localeCompare(right));
  const lanes = Object.fromEntries(
    laneIds.map((laneId) => {
      const launchLane = launchByLaneId.get(laneId);
      const previousLane = prior?.lanes[laneId];
      const defaultStatus: OrchestrationLaneStatus = launchLane?.launchEligible ? 'pending' : 'blocked';
      const status =
        previousLane?.status === 'completed' || previousLane?.status === 'failed' || previousLane?.status === 'running' || previousLane?.status === 'blocked'
          ? previousLane.status
          : defaultStatus;
      return [
        laneId,
        {
          lane_id: laneId,
          status,
          blocker_refs: [...(launchLane?.blockers ?? [])].sort((left, right) => left.localeCompare(right)),
          allowed_write_surfaces: [...(launchLane?.scopeBoundaries.allowed_write_surfaces ?? launchLane?.allowedWriteSurfaces ?? [])].sort((left, right) =>
            left.localeCompare(right)
          ),
          scope_id: launchLane?.scopeBoundaries.scope_id ?? null,
          receipt_refs: [...(previousLane?.receipt_refs ?? [])].sort((left, right) => left.localeCompare(right)),
          worker_id: previousLane?.worker_id ?? (launchLane?.worker_id ?? null),
          started_at: previousLane?.started_at ?? null,
          completed_at: previousLane?.completed_at ?? null,
          updated_at: now
        }
      ];
    })
  );

  const status = deriveRunStatus(Object.values(lanes).map((lane) => lane.status));
  const nextState: OrchestrationExecutionRunState = {
    schemaVersion: '1.0',
    kind: 'orchestration-execution-run-state',
    run_id: runId,
    source_launch_plan_fingerprint: launchFingerprint,
    eligible_lanes: eligibleLaneIds,
    status,
    lanes,
    metadata: {
      runtime: 'execution-supervisor',
      resumed_from_interrupted_run: prior !== null && prior.status === 'running',
      reconcile_revision: (prior?.metadata.reconcile_revision ?? 0) + 1,
      runtime_capability_fingerprint: runtimeCapabilityFingerprint ?? prior?.metadata.runtime_capability_fingerprint ?? null
    },
    created_at: prior?.created_at ?? startedAt,
    updated_at: now,
    completed_at: status === 'running' ? null : (prior?.completed_at ?? now)
  };

  writeOrchestrationExecutionRun(repoRoot, nextState);
  return nextState;
};

const tryReadArtifact = <T>(repoRoot: string, relativePath: string): T | undefined => {
  const artifactPath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(artifactPath)) {
    return undefined;
  }

  return JSON.parse(fs.readFileSync(artifactPath, 'utf8')) as T;
};

const toDurationMs = (startedAt?: string, finishedAt?: string): number => {
  if (!startedAt || !finishedAt) return 0;
  const duration = Date.parse(finishedAt) - Date.parse(startedAt);
  return Number.isFinite(duration) && duration > 0 ? duration : 0;
};

const emitSignalRecords = (
  repoRoot: string,
  laneId: string,
  signalValues: { laneExecutionDurationMs: number; workerSuccessRate: number; retryPressure: number },
  routerAccuracyMetric?: ReturnType<typeof computeRouterAccuracyMetric>
): void => {
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
          under_validation_signal_count: 0,
          router_accuracy_records: 0,
          average_router_fit_score: 0,
          average_lane_delta: 0,
          average_validation_delta: 0
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
    ...(routerAccuracyMetric
      ? {
          predicted_parallel_lanes: routerAccuracyMetric.predicted_parallel_lanes,
          actual_parallel_lanes: routerAccuracyMetric.actual_parallel_lanes,
          predicted_validation_cost: routerAccuracyMetric.predicted_validation_cost,
          actual_validation_cost: routerAccuracyMetric.actual_validation_cost,
          router_fit_score: routerAccuracyMetric.router_fit_score
        }
      : {}),
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

export async function startExecution(
  worksetPlan: WorksetPlanArtifact,
  launchPlan: WorkerLaunchPlanArtifact,
  repoRoot = process.cwd(),
  options: { runtimeCapabilityFingerprint?: string | null } = {}
): Promise<ExecutionRun> {
  const runId = deriveOrchestrationRunId(launchPlan);
  const startedAt = deterministicIso(runId);
  const launchByLaneId = new Map(launchPlan.lanes.map((lane) => [lane.lane_id, lane]));
  const runState = reconcileOrchestrationRunState(repoRoot, runId, launchPlan, startedAt, options.runtimeCapabilityFingerprint ?? null);

  const lanes = Object.fromEntries(
    [...worksetPlan.lanes]
      .sort((left, right) => left.lane_id.localeCompare(right.lane_id))
      .map((lane) => [
        lane.lane_id,
        {
          lane_id: lane.lane_id,
          state:
            runState.lanes[lane.lane_id]?.status === 'completed'
              ? ('completed' as LaneRuntimeState)
              : runState.lanes[lane.lane_id]?.status === 'failed'
                ? ('failed' as LaneRuntimeState)
                : runState.lanes[lane.lane_id]?.status === 'running'
                  ? ('running' as LaneRuntimeState)
                  : launchByLaneId.get(lane.lane_id)?.launchEligible
                    ? ('ready' as LaneRuntimeState)
                    : ('blocked' as LaneRuntimeState),
          protected_doc_consolidation: lane.protected_doc_consolidation
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
  evaluateExecutionMergeGuards(repoRoot);

  return {
    runId,
    startedAt,
    resumed: runState.metadata.resumed_from_interrupted_run,
    eligibleLaneIds: [...runState.eligible_lanes],
    laneStatuses: Object.fromEntries(Object.entries(runState.lanes).map(([laneId, state]) => [laneId, state.status])),
    lanes
  };
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

  try {
    const runState = readOrchestrationExecutionRun(repoRoot, execution.run_id);
    const now = new Date().toISOString();
    const status: OrchestrationLaneStatus = state === 'ready' ? 'pending' : state;
    runState.lanes[laneId] = {
      ...(runState.lanes[laneId] ?? {
        lane_id: laneId,
        blocker_refs: [],
        receipt_refs: [],
        worker_id: null,
        started_at: null,
        completed_at: null,
        updated_at: now
      }),
      status,
      ...(status === 'running' && !runState.lanes[laneId]?.started_at ? { started_at: laneStartTimestamp(execution.run_id, laneId) } : {}),
      ...(status === 'completed' || status === 'failed' ? { completed_at: laneFinishTimestamp(execution.run_id, laneId) } : {}),
      updated_at: now
    };
    runState.status = deriveRunStatus(Object.values(runState.lanes).map((lane) => lane.status));
    runState.updated_at = now;
    runState.completed_at = runState.status === 'running' ? null : now;
    writeOrchestrationExecutionRun(repoRoot, runState);
  } catch {
    // no-op: backwards compatibility for runtimes without orchestration run-state artifacts
  }

  evaluateExecutionMergeGuards(repoRoot);
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

  emitLaneOutcomeScore(repoRoot, laneId, scoreSignals);

  const executionPlan = tryReadArtifact<any>(repoRoot, EXECUTION_PLAN_PATH);
  const worksetPlan = tryReadArtifact<any>(repoRoot, WORKSET_PLAN_PATH);
  const executionState = tryReadArtifact<any>(repoRoot, EXECUTION_STATE_PATH);
  const outcomeTelemetry = tryReadArtifact<OutcomeTelemetryArtifact>(repoRoot, OUTCOME_TELEMETRY_PATH);
  const processTelemetry = tryReadArtifact<ProcessTelemetryArtifact>(repoRoot, PROCESS_TELEMETRY_PATH);

  const routerAccuracyMetric =
    executionPlan && worksetPlan && executionState && outcomeTelemetry
      ? computeRouterAccuracyMetric({
          laneId,
          executionPlan,
          worksetPlan,
          executionState,
          outcomeTelemetry,
          processTelemetry
        })
      : undefined;

  emitSignalRecords(repoRoot, laneId, scoreSignals, routerAccuracyMetric);

  writeExecutionState(repoRoot, execution);

  try {
    const runState = readOrchestrationExecutionRun(repoRoot, execution.run_id);
    const now = new Date().toISOString();
    const current = runState.lanes[laneId] ?? {
      lane_id: laneId,
      status: 'pending' as OrchestrationLaneStatus,
      blocker_refs: [],
      receipt_refs: [],
      worker_id: null,
      started_at: null,
      completed_at: null,
      updated_at: now
    };
    runState.lanes[laneId] = {
      ...current,
      status: finalState,
      worker_id: workerId,
      started_at: current.started_at ?? startedAt,
      completed_at: finishedAt,
      updated_at: now,
      receipt_refs: [...new Set([...current.receipt_refs, `execution-state:${execution.run_id}:lane:${laneId}:worker:${workerId}`])].sort((left, right) => left.localeCompare(right))
    };
    runState.status = deriveRunStatus(Object.values(runState.lanes).map((lane) => lane.status));
    runState.updated_at = now;
    runState.completed_at = runState.status === 'running' ? null : now;
    writeOrchestrationExecutionRun(repoRoot, runState);
  } catch {
    // no-op: backwards compatibility for runtimes without orchestration run-state artifacts
  }

  evaluateExecutionMergeGuards(repoRoot);
}

export async function finalizeExecution(runId: string, repoRoot = process.cwd()): Promise<void> {
  const execution = readExecutionState(repoRoot);
  if (execution.run_id !== runId) {
    return;
  }

  const laneStates = Object.values(execution.lanes).map((lane) => lane.state);
  execution.status = laneStates.some((state) => state === 'failed') ? 'failed' : laneStates.every((state) => state === 'completed') ? 'completed' : 'running';
  writeExecutionState(repoRoot, execution);

  try {
    const runState = readOrchestrationExecutionRun(repoRoot, runId);
    const now = new Date().toISOString();
    runState.status = deriveRunStatus(Object.values(runState.lanes).map((lane) => lane.status));
    runState.updated_at = now;
    runState.completed_at = runState.status === 'running' ? null : now;
    writeOrchestrationExecutionRun(repoRoot, runState);
  } catch {
    // no-op: backwards compatibility for runtimes without orchestration run-state artifacts
  }

  evaluateExecutionMergeGuards(repoRoot);
}
