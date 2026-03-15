import fs from 'node:fs';
import path from 'node:path';
import { assignWorkersToLanes, type WorksetPlanArtifact } from '@zachariahredfield/playbook-engine';
import { ExitCode } from '../../lib/cliContract.js';

const WORKSET_PLAN_PATH = '.playbook/workset-plan.json';
const EXECUTION_STATE_PATH = '.playbook/execution-state.json';

type ExecuteOptions = {
  format: 'text' | 'json';
  quiet: boolean;
};

type LaneRuntimeState = 'blocked' | 'ready' | 'running' | 'completed' | 'failed';

type ExecutionModule = {
  startExecution?: (worksetPlan: WorksetPlanArtifact, repoRoot?: string) => Promise<{ runId: string }>;
  updateLaneState?: (laneId: string, state: LaneRuntimeState, repoRoot?: string) => Promise<void>;
  recordWorkerResult?: (laneId: string, workerId: string, result: { status: 'completed' | 'failed'; retries?: number; summary?: string }, repoRoot?: string) => Promise<void>;
  finalizeExecution?: (runId: string, repoRoot?: string) => Promise<void>;
};

type LaneStateLike = {
  lane_id: string;
  task_ids: string[];
  dependency_level: 'low' | 'medium' | 'high';
  worker_ready: boolean;
};

const readJsonArtifact = <T>(cwd: string, artifactPath: string): T | undefined => {
  const absolutePath = path.join(cwd, artifactPath);
  if (!fs.existsSync(absolutePath)) {
    return undefined;
  }

  const parsed = JSON.parse(fs.readFileSync(absolutePath, 'utf8')) as { data?: unknown } | T;
  if (parsed && typeof parsed === 'object' && 'data' in (parsed as { data?: unknown })) {
    return (parsed as { data: T }).data;
  }

  return parsed as T;
};

const renderText = (runId: string, lanes: Array<{ lane_id: string; state: string }>, status: string): void => {
  console.log('Playbook Execution Run');
  console.log('');
  console.log(`Run ID: ${runId}`);
  console.log('');
  console.log('Lanes:');
  for (const lane of lanes) {
    const marker = lane.state === 'completed' ? '✓' : '✗';
    console.log(`${marker} ${lane.lane_id} ${lane.state}`);
  }
  console.log('');
  console.log(`Execution status: ${status}`);
};

export const runExecution = async (cwd: string, options: ExecuteOptions): Promise<number> => {
  const worksetPlan = readJsonArtifact<WorksetPlanArtifact>(cwd, WORKSET_PLAN_PATH);
  if (!worksetPlan) {
    const message = `playbook execute: missing workset plan at ${WORKSET_PLAN_PATH}. Run \"playbook orchestrate\" first.`;
    if (options.format === 'json') {
      console.log(JSON.stringify({ schemaVersion: '1.0', command: 'execute', error: message }, null, 2));
    } else {
      console.error(message);
    }
    return ExitCode.Failure;
  }

  const engineModule = (await import('@zachariahredfield/playbook-engine')) as unknown as ExecutionModule;
  if (!engineModule.startExecution || !engineModule.updateLaneState || !engineModule.recordWorkerResult || !engineModule.finalizeExecution) {
    throw new Error('playbook execute: execution supervisor exports are unavailable on this build.');
  }

  const run = await engineModule.startExecution(worksetPlan, cwd);
  const laneStateArtifact = path.join(cwd, EXECUTION_STATE_PATH);
  if (!fs.existsSync(laneStateArtifact)) {
    throw new Error('playbook execute: execution state artifact initialization failed.');
  }

  const laneInputs: LaneStateLike[] = worksetPlan.lanes.map((lane: LaneStateLike) => ({ ...lane }));
  const workerAssignments = assignWorkersToLanes(
    {
      schemaVersion: '1.0',
      kind: 'lane-state',
      generatedAt: new Date(0).toISOString(),
      proposalOnly: true,
      workset_plan_path: WORKSET_PLAN_PATH,
      lanes: laneInputs.map((lane) => ({
        lane_id: lane.lane_id,
        task_ids: [...lane.task_ids].sort((a, b) => a.localeCompare(b)),
        status: lane.worker_ready ? 'ready' : 'blocked',
        dependency_level: lane.dependency_level,
        dependencies_satisfied: lane.worker_ready,
        blocked_reasons: lane.worker_ready ? [] : ['worker prerequisites are not satisfied'],
        verification_summary: { status: lane.worker_ready ? 'pending' : 'blocked', required_checks: [], optional_checks: [], notes: [] },
        merge_ready: false,
        worker_ready: lane.worker_ready
      })),
      blocked_lanes: laneInputs.filter((lane) => !lane.worker_ready).map((lane) => lane.lane_id).sort((a, b) => a.localeCompare(b)),
      ready_lanes: laneInputs.filter((lane) => lane.worker_ready).map((lane) => lane.lane_id).sort((a, b) => a.localeCompare(b)),
      running_lanes: [],
      completed_lanes: [],
      merge_ready_lanes: [],
      dependency_status: { total_edges: worksetPlan.dependency_edges.length, satisfied_edges: 0, unsatisfied_edges: worksetPlan.dependency_edges.length },
      merge_readiness: { merge_ready_lanes: [], not_merge_ready_lanes: [] },
      verification_status: { status: 'pending', lanes_pending_verification: [], lanes_blocked_from_verification: [] },
      warnings: []
    },
    worksetPlan
  );

  const orderedAssignments = [...workerAssignments.lanes].sort((left, right) => left.lane_id.localeCompare(right.lane_id));

  for (const lane of orderedAssignments) {
    if (lane.status !== 'assigned') {
      await engineModule.updateLaneState(lane.lane_id, 'failed', cwd);
      await engineModule.recordWorkerResult(lane.lane_id, `worker-${lane.lane_id}`, { status: 'failed', retries: 1, summary: 'lane was not assignment-ready' }, cwd);
      continue;
    }

    await engineModule.updateLaneState(lane.lane_id, 'running', cwd);
    await engineModule.recordWorkerResult(lane.lane_id, `worker-${lane.lane_id}`, { status: 'completed', retries: 0, summary: 'deterministic execution success' }, cwd);
  }

  await engineModule.finalizeExecution(run.runId, cwd);

  const executionState = readJsonArtifact<{ status: string; lanes: Record<string, { lane_id: string; state: string }> }>(cwd, EXECUTION_STATE_PATH);
  const lanes = Object.values(executionState?.lanes ?? {}).sort((left, right) => left.lane_id.localeCompare(right.lane_id));
  const status = executionState?.status === 'completed' ? 'SUCCESS' : executionState?.status === 'running' ? 'RUNNING' : 'FAILED';

  if (options.format === 'json') {
    console.log(
      JSON.stringify(
        {
          schemaVersion: '1.0',
          command: 'execute',
          run_id: run.runId,
          execution_state_path: EXECUTION_STATE_PATH,
          lanes,
          execution_status: status
        },
        null,
        2
      )
    );
    return status === 'SUCCESS' ? ExitCode.Success : ExitCode.Failure;
  }

  if (!options.quiet) {
    renderText(run.runId, lanes, status);
  }

  return status === 'SUCCESS' ? ExitCode.Success : ExitCode.Failure;
};
