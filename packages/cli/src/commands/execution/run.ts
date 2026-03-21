import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  assignWorkersToLanes,
  type WorksetPlanArtifact,
  buildFleetAdoptionWorkQueue,
  buildFleetCodexExecutionPlan,
  type ExecutionResult
} from '@zachariahredfield/playbook-engine';
import { ExitCode } from '../../lib/cliContract.js';
import { emitCommandFailure, printCommandHelp } from '../../lib/commandSurface.js';
import { createCommandQualityTracker } from '../../lib/commandQuality.js';
import { loadFleet, persistExecutionControlLoop } from './receiptIngest.js';

const WORKSET_PLAN_PATH = '.playbook/workset-plan.json';
const EXECUTION_STATE_PATH = '.playbook/execution-state.json';

type ExecuteOptions = {
  format: 'text' | 'json';
  quiet: boolean;
  help?: boolean;
  workerAdapter?: string;
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
  readiness_status?: 'ready' | 'blocked';
  blocking_reasons?: string[];
  conflict_surface_paths?: string[];
  shared_artifact_risk?: 'low' | 'medium' | 'high';
  assignment_confidence?: number;
  protected_doc_consolidation?: {
    has_protected_doc_work: boolean;
    stage: 'not_applicable' | 'pending' | 'blocked' | 'plan_ready' | 'applied';
    summary: string;
    next_command: string | null;
  };
};

type WorkerAdapterEnvelope = {
  schemaVersion: '1.0';
  kind: 'playbook-worker-adapter-request';
  repo_id: string;
  prompt_id: string;
  lane_id: string;
  wave: string;
  objective: string;
  implementation_plan: string[];
  verification_steps: string[];
  documentation_updates: string[];
};

type WorkerAdapterResult = ExecutionResult & { lane_id?: string };

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

const renderText = (runId: string, lanes: Array<{ lane_id: string; state: string; protected_doc_consolidation?: { stage: string; summary: string; next_command: string | null } }>, status: string): void => {
  console.log('Playbook Execution Run');
  console.log('');
  console.log(`Run ID: ${runId}`);
  console.log('');
  console.log('Lanes:');
  for (const lane of lanes) {
    const marker = lane.state === 'completed' ? '✓' : '✗';
    const consolidationNote = lane.protected_doc_consolidation && lane.protected_doc_consolidation.stage !== 'not_applicable' && lane.protected_doc_consolidation.stage !== 'applied'
      ? ` — ${lane.protected_doc_consolidation.summary}${lane.protected_doc_consolidation.next_command ? `; next command: ${lane.protected_doc_consolidation.next_command}` : ''}`
      : '';
    console.log(`${marker} ${lane.lane_id} ${lane.state}${consolidationNote}`);
  }
  console.log('');
  console.log(`Execution status: ${status}`);
};

const parseWorkerAdapterResult = (raw: string, expectedPromptId: string): WorkerAdapterResult => {
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`worker adapter returned invalid JSON for prompt "${expectedPromptId}"`);
  }
  const value = parsed as Record<string, unknown>;
  if (typeof value.repo_id !== 'string' || value.repo_id.length === 0) {
    throw new Error(`worker adapter result for prompt "${expectedPromptId}" is missing repo_id`);
  }
  if (typeof value.prompt_id !== 'string' || value.prompt_id.length === 0) {
    throw new Error(`worker adapter result for prompt "${expectedPromptId}" is missing prompt_id`);
  }
  if (value.status !== 'success' && value.status !== 'failed' && value.status !== 'not_run') {
    throw new Error(`worker adapter result for prompt "${expectedPromptId}" has unsupported status`);
  }
  if (value.observed_transition !== undefined) {
    const transition = value.observed_transition as Record<string, unknown>;
    if (!transition || typeof transition !== 'object' || typeof transition.from !== 'string' || typeof transition.to !== 'string') {
      throw new Error(`worker adapter result for prompt "${expectedPromptId}" has invalid observed_transition`);
    }
  }
  return {
    repo_id: value.repo_id,
    prompt_id: value.prompt_id,
    lane_id: typeof value.lane_id === 'string' ? value.lane_id : undefined,
    status: value.status,
    observed_transition: value.observed_transition as ExecutionResult['observed_transition'] | undefined,
    error: typeof value.error === 'string' ? value.error : undefined
  };
};

const invokeWorkerAdapter = (command: string, payload: WorkerAdapterEnvelope, cwd: string): WorkerAdapterResult => {
  const result = spawnSync(command, {
    cwd,
    shell: true,
    input: JSON.stringify(payload),
    encoding: 'utf8'
  });

  if (result.error) {
    throw new Error(`worker adapter failed for prompt "${payload.prompt_id}": ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`worker adapter exited with code ${result.status ?? 'unknown'} for prompt "${payload.prompt_id}": ${(result.stderr || result.stdout || '').trim()}`);
  }

  return parseWorkerAdapterResult(result.stdout, payload.prompt_id);
};

const buildAdapterEnvelope = (prompt: ReturnType<typeof buildFleetCodexExecutionPlan>['codex_prompts'][number]): WorkerAdapterEnvelope => ({
  schemaVersion: '1.0',
  kind: 'playbook-worker-adapter-request',
  repo_id: prompt.repo_id,
  prompt_id: prompt.prompt_id,
  lane_id: prompt.lane_id,
  wave: prompt.wave,
  objective: prompt.objective,
  implementation_plan: [...prompt.implementation_plan],
  verification_steps: [...prompt.verification_steps],
  documentation_updates: [...prompt.documentation_updates]
});

const runWorkerBridge = async (cwd: string, options: ExecuteOptions, tracker: ReturnType<typeof createCommandQualityTracker>): Promise<number> => {
  const workerAdapter = options.workerAdapter;
  if (!workerAdapter) {
    throw new Error('playbook execute: missing --worker-adapter for execution bridge mode.');
  }

  const fleet = loadFleet(cwd);
  const queue = buildFleetAdoptionWorkQueue(fleet);
  const executionPlan = buildFleetCodexExecutionPlan(queue);
  const prompts = [...executionPlan.codex_prompts].sort((left, right) => left.prompt_id.localeCompare(right.prompt_id));
  const executionResults: ExecutionResult[] = [];

  for (const prompt of prompts) {
    const adapterResult = invokeWorkerAdapter(workerAdapter, buildAdapterEnvelope(prompt), cwd);
    if (adapterResult.prompt_id !== prompt.prompt_id) {
      throw new Error(`worker adapter prompt_id mismatch: expected "${prompt.prompt_id}", received "${adapterResult.prompt_id}"`);
    }
    if (adapterResult.repo_id !== prompt.repo_id) {
      throw new Error(`worker adapter repo_id mismatch for prompt "${prompt.prompt_id}": expected "${prompt.repo_id}", received "${adapterResult.repo_id}"`);
    }
    executionResults.push({
      repo_id: adapterResult.repo_id,
      prompt_id: adapterResult.prompt_id,
      status: adapterResult.status,
      observed_transition: adapterResult.observed_transition,
      error: adapterResult.error
    });
  }

  const ingested = persistExecutionControlLoop(cwd, executionResults, {
    sessionId: 'execute-bridge',
    generatedAt: new Date().toISOString()
  });

  const payload = {
    schemaVersion: '1.0',
    command: 'execute',
    mode: 'bridge',
    worker_adapter: workerAdapter,
    prompts_executed: prompts.map((prompt) => prompt.prompt_id),
    execution_outcome_input: ingested.execution_outcome_input,
    receipt: ingested.receipt_with_promotion,
    updated_state: ingested.updated_state,
    next_queue: ingested.next_queue,
    promotion: ingested.promotion,
    written_artifacts: ingested.written_artifacts
  };

  if (options.format === 'json') {
    console.log(JSON.stringify(payload, null, 2));
  } else if (!options.quiet) {
    console.log(`Executed ${prompts.length} prompt(s) through worker adapter.`);
    console.log(`Wrote canonical outcome input: ${ingested.written_artifacts.execution_outcome_input}`);
    console.log(`Updated-state repos needing retry: ${ingested.updated_state.summary.repos_needing_retry.length}`);
  }

  tracker.finish({
    inputsSummary: `bridge-prompts=${prompts.length}`,
    artifactsWritten: [
      ingested.written_artifacts.execution_outcome_input,
      ingested.written_artifacts.updated_state,
      ingested.written_artifacts.staged_updated_state
    ],
    downstreamArtifactsProduced: [
      ingested.written_artifacts.execution_outcome_input,
      ingested.written_artifacts.updated_state
    ],
    successStatus: ingested.promotion.promoted ? 'success' : 'partial'
  });
  return ingested.promotion.promoted ? ExitCode.Success : ExitCode.Failure;
};

export const runExecution = async (cwd: string, options: ExecuteOptions): Promise<number> => {
  if (options.help) {
    printCommandHelp({
      usage: 'playbook execute [options]',
      description: 'Execute orchestration lanes through the deterministic execution supervisor runtime or bridge deterministic adoption prompts into canonical receipt/update ingestion.',
      options: ['--json                     Alias for --format=json', '--format <text|json>       Output format', '--quiet                    Suppress success output in text mode', '--worker-adapter <command> Execute deterministic adoption prompts through an external adapter and write canonical outcome artifacts', '--help                     Show help'],
      artifacts: [EXECUTION_STATE_PATH, '.playbook/execution-outcome-input.json', '.playbook/execution-updated-state.json']
    });
    return ExitCode.Success;
  }

  const tracker = createCommandQualityTracker(cwd, 'execute');

  try {
    if (options.workerAdapter) {
      return await runWorkerBridge(cwd, options, tracker);
    }

    const worksetPlan = readJsonArtifact<WorksetPlanArtifact>(cwd, WORKSET_PLAN_PATH);
    if (!worksetPlan) {
      const exitCode = emitCommandFailure('execute', options, {
        summary: `Execution failed: missing prerequisite artifact ${WORKSET_PLAN_PATH}.`,
        findingId: 'execute.workset-plan.missing',
        message: `Missing required artifact: ${WORKSET_PLAN_PATH}.`,
        nextActions: ['Run `playbook orchestrate --tasks-file <path>` or `playbook orchestrate --goal "<goal>"` before execute, or provide `--worker-adapter` to bridge deterministic adoption prompts into canonical receipt/update ingestion.']
      });
      tracker.finish({ inputsSummary: 'missing workset plan', artifactsRead: [WORKSET_PLAN_PATH], successStatus: 'failure', warningsCount: 1 });
      return exitCode;
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
          readiness_status: lane.readiness_status ?? (lane.worker_ready ? 'ready' : 'blocked'),
          dependency_level: lane.dependency_level,
          dependencies_satisfied: lane.worker_ready,
          blocked_reasons: lane.worker_ready ? [] : ['worker prerequisites are not satisfied'],
          blocking_reasons: [...(lane.blocking_reasons ?? [])],
          conflict_surface_paths: [...(lane.conflict_surface_paths ?? [])],
          shared_artifact_risk: lane.shared_artifact_risk ?? 'low',
          assignment_confidence: lane.assignment_confidence ?? 0.5,
          verification_summary: { status: lane.worker_ready ? 'pending' : 'blocked', required_checks: [], optional_checks: [], notes: [] },
          merge_ready: false,
          worker_ready: lane.worker_ready,
          protected_doc_consolidation: lane.protected_doc_consolidation ?? { has_protected_doc_work: false, stage: 'not_applicable', summary: 'no protected-doc work', next_command: null }
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
      const exitCode = status === 'SUCCESS' ? ExitCode.Success : ExitCode.Failure;
      tracker.finish({
        inputsSummary: `lanes=${worksetPlan.lanes.length}`,
        artifactsRead: [WORKSET_PLAN_PATH],
        artifactsWritten: [EXECUTION_STATE_PATH],
        downstreamArtifactsProduced: [EXECUTION_STATE_PATH],
        successStatus: exitCode === ExitCode.Success ? 'success' : 'partial'
      });
      return exitCode;
    }

    if (!options.quiet) {
      renderText(run.runId, lanes, status);
    }

    const exitCode = status === 'SUCCESS' ? ExitCode.Success : ExitCode.Failure;
    tracker.finish({
      inputsSummary: `lanes=${worksetPlan.lanes.length}`,
      artifactsRead: [WORKSET_PLAN_PATH],
      artifactsWritten: [EXECUTION_STATE_PATH],
      downstreamArtifactsProduced: [EXECUTION_STATE_PATH],
      successStatus: exitCode === ExitCode.Success ? 'success' : 'partial'
    });
    return exitCode;
  } catch (error) {
    tracker.finish({
      inputsSummary: options.workerAdapter ? 'bridge runtime failure' : 'execution runtime failure',
      artifactsRead: options.workerAdapter ? [] : [WORKSET_PLAN_PATH],
      artifactsWritten: [EXECUTION_STATE_PATH],
      successStatus: 'failure',
      warningsCount: 1
    });
    throw error;
  }
};
