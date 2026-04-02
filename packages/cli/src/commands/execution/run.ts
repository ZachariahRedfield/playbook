import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  type WorksetPlanArtifact,
  buildFleetAdoptionWorkQueue,
  buildFleetCodexExecutionPlan,
  evaluateRuntimeCapabilityAuthorization,
  type ExecutionResult,
  readInteropRuntime,
  WORKER_LAUNCH_PLAN_RELATIVE_PATH,
  type RuntimeCapabilityAuthorizationResult,
  type WorkerLaunchPlanArtifact
} from '@zachariahredfield/playbook-engine';
import { ExitCode } from '../../lib/cliContract.js';
import { emitCommandFailure, printCommandHelp } from '../../lib/commandSurface.js';
import { createCommandQualityTracker } from '../../lib/commandQuality.js';
import { loadFleet, persistExecutionControlLoop } from './receiptIngest.js';

const WORKSET_PLAN_PATH = '.playbook/workset-plan.json';
const EXECUTION_STATE_PATH = '.playbook/execution-state.json';
const ORCHESTRATION_RUNS_DIR = '.playbook/execution-runs';
const EXECUTION_MERGE_GUARDS_PATH = '.playbook/execution-merge-guards.json';
const LIFELINE_INTEROP_RUNTIME_PATH = '.playbook/lifeline-interop-runtime.json';

type ExecuteOptions = {
  format: 'text' | 'json';
  quiet: boolean;
  help?: boolean;
  workerAdapter?: string;
};

type LaneRuntimeState = 'blocked' | 'ready' | 'running' | 'completed' | 'failed';

type ExecutionModule = {
  startExecution?: (
    worksetPlan: WorksetPlanArtifact,
    launchPlan: WorkerLaunchPlanArtifact,
    repoRoot?: string,
    options?: { runtimeCapabilityFingerprint?: string | null }
  ) => Promise<{ runId: string; laneStatuses: Record<string, 'pending' | 'running' | 'completed' | 'failed' | 'blocked'> }>;
  updateLaneState?: (laneId: string, state: LaneRuntimeState, repoRoot?: string) => Promise<void>;
  recordWorkerResult?: (laneId: string, workerId: string, result: { status: 'completed' | 'failed'; retries?: number; summary?: string }, repoRoot?: string) => Promise<void>;
  finalizeExecution?: (runId: string, repoRoot?: string) => Promise<void>;
  evaluateExecutionMergeGuardForRun?: (repoRoot: string, runId: string) => {
    run_id: string;
    mergeEligible: boolean;
    blockingReasons: string[];
    unresolvedReceipts: string[];
    protectedDocUnresolved: string[];
    failedOrBlockedLaneRefs: string[];
    pendingFollowups: string[];
    staleOrConflictedState: boolean;
  } | undefined;
};

type LaneStateLike = {
  lane_id: string;
  launchEligible: boolean;
  blockers: string[];
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

const normalizeLaunchArtifactInput = (value: WorkerLaunchPlanArtifact): WorkerLaunchPlanArtifact | undefined => {
  if (value && typeof value === 'object' && value.kind === 'worker-launch-plan' && Array.isArray(value.lanes)) {
    return value;
  }
  return undefined;
};

const validateLaunchPlan = (
  cwd: string,
  worksetPlan: WorksetPlanArtifact,
  launchPlan: WorkerLaunchPlanArtifact | undefined
): { ok: true; launchPlan: WorkerLaunchPlanArtifact; eligibleLanes: LaneStateLike[]; runtimeCapabilityAuthorization: RuntimeCapabilityAuthorizationResult } | { ok: false; summary: string; findingId: string; message: string; nextActions: string[] } => {
  if (!launchPlan) {
    return {
      ok: false,
      summary: `Execution failed: missing prerequisite artifact ${WORKER_LAUNCH_PLAN_RELATIVE_PATH}.`,
      findingId: 'execute.worker-launch-plan.missing',
      message: `Missing required artifact: ${WORKER_LAUNCH_PLAN_RELATIVE_PATH}. Managed execution requires explicit launch authorization.`,
      nextActions: ['Run `playbook workers assign` to derive deterministic worker launch authorization before execute.']
    };
  }

  const plannedLaneIds = [...worksetPlan.lanes].map((lane) => lane.lane_id).sort((a, b) => a.localeCompare(b));
  const authorizedLaneIds = [...launchPlan.lanes].map((lane) => lane.lane_id).sort((a, b) => a.localeCompare(b));
  if (plannedLaneIds.length !== authorizedLaneIds.length || plannedLaneIds.some((laneId, index) => laneId !== authorizedLaneIds[index])) {
    return {
      ok: false,
      summary: `Execution failed: stale launch authorization in ${WORKER_LAUNCH_PLAN_RELATIVE_PATH}.`,
      findingId: 'execute.worker-launch-plan.stale',
      message: `Launch authorization lanes do not match ${WORKSET_PLAN_PATH}; regenerate worker launch authorization.`,
      nextActions: ['Re-run `playbook workers assign` after orchestration updates to refresh .playbook/worker-launch-plan.json before execute.']
    };
  }

  const blockedLanes: Array<{ lane_id: string; blockers: string[] }> = launchPlan.lanes
    .filter((lane: WorkerLaunchPlanArtifact['lanes'][number]) => !lane.launchEligible)
    .map((lane: WorkerLaunchPlanArtifact['lanes'][number]) => ({ lane_id: lane.lane_id, blockers: [...lane.blockers].sort((a, b) => a.localeCompare(b)) }))
    .sort((left: { lane_id: string }, right: { lane_id: string }) => left.lane_id.localeCompare(right.lane_id));
  if (blockedLanes.length > 0) {
    const blockedSummary = blockedLanes.map((lane) => `${lane.lane_id}: ${lane.blockers.join('; ') || 'blocked'}`).join(' | ');
    return {
      ok: false,
      summary: 'Execution blocked by deterministic worker launch authorization.',
      findingId: 'execute.worker-launch-plan.blocked',
      message: `Blocked lanes in ${WORKER_LAUNCH_PLAN_RELATIVE_PATH}: ${blockedSummary}`,
      nextActions: ['Resolve listed launch blockers (capability, protected-doc consolidation, dependency state, verify/policy blockers) and regenerate launch authorization via `playbook workers assign`.']
    };
  }

  const eligibleLanes = launchPlan.lanes
    .map((lane: WorkerLaunchPlanArtifact['lanes'][number]) => ({ lane_id: lane.lane_id, launchEligible: lane.launchEligible, blockers: [...lane.blockers] }))
    .filter((lane: LaneStateLike) => lane.launchEligible)
    .sort((left: LaneStateLike, right: LaneStateLike) => left.lane_id.localeCompare(right.lane_id));
  if (eligibleLanes.length === 0) {
    return {
      ok: false,
      summary: 'Execution blocked: no launch-authorized lanes were found.',
      findingId: 'execute.worker-launch-plan.no-eligible-lanes',
      message: `No lanes in ${WORKER_LAUNCH_PLAN_RELATIVE_PATH} are launchEligible=true.`,
      nextActions: ['Run `playbook workers assign` after unblocking lane readiness and governance gates.']
    };
  }

  const runtime = readInteropRuntime(cwd);
  const runtimeCapabilityAuthorization = evaluateRuntimeCapabilityAuthorization(launchPlan, runtime);
  if (!runtimeCapabilityAuthorization.ok) {
    const blockerSummary = runtimeCapabilityAuthorization.blockers
      .map((blocker: RuntimeCapabilityAuthorizationResult['blockers'][number]) => `${blocker.lane_id}: ${blocker.blocker_code}; capabilities=${blocker.blocked_capability_ids.join(',') || 'none'}`)
      .join(' | ');
    return {
      ok: false,
      summary: 'Execution blocked by runtime capability authorization.',
      findingId: 'execute.runtime-capability-authorization.blocked',
      message: `Runtime capability authorization blocked launch-eligible lanes using ${LIFELINE_INTEROP_RUNTIME_PATH}: ${blockerSummary}`,
      nextActions: [
        'Register or repair required runtime capability declarations before execute.',
        'Resolve stale/conflicted capability registration state in `.playbook/lifeline-interop-runtime.json` and rerun execute.'
      ]
    };
  }

  return { ok: true, launchPlan, eligibleLanes, runtimeCapabilityAuthorization };
};

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
      artifacts: [EXECUTION_STATE_PATH, ORCHESTRATION_RUNS_DIR, EXECUTION_MERGE_GUARDS_PATH, '.playbook/execution-outcome-input.json', '.playbook/execution-updated-state.json']
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

    const rawLaunchPlan = readJsonArtifact<WorkerLaunchPlanArtifact>(cwd, WORKER_LAUNCH_PLAN_RELATIVE_PATH);
    const launchPlan = rawLaunchPlan ? normalizeLaunchArtifactInput(rawLaunchPlan) : undefined;
    const launchPlanValidation = validateLaunchPlan(cwd, worksetPlan, launchPlan);
    if (!launchPlanValidation.ok) {
      const exitCode = emitCommandFailure('execute', options, launchPlanValidation);
      tracker.finish({
        inputsSummary: launchPlanValidation.findingId,
        artifactsRead: [WORKSET_PLAN_PATH, WORKER_LAUNCH_PLAN_RELATIVE_PATH, LIFELINE_INTEROP_RUNTIME_PATH],
        successStatus: 'failure',
        warningsCount: 1
      });
      return exitCode;
    }

    const engineModule = (await import('@zachariahredfield/playbook-engine')) as unknown as ExecutionModule;
    if (!engineModule.startExecution || !engineModule.updateLaneState || !engineModule.recordWorkerResult || !engineModule.finalizeExecution) {
      throw new Error('playbook execute: execution supervisor exports are unavailable on this build.');
    }

    const run = await engineModule.startExecution(worksetPlan, launchPlanValidation.launchPlan, cwd, {
      runtimeCapabilityFingerprint: launchPlanValidation.runtimeCapabilityAuthorization.runtime_capability_fingerprint
    });
    const laneStateArtifact = path.join(cwd, EXECUTION_STATE_PATH);
    if (!fs.existsSync(laneStateArtifact)) {
      throw new Error('playbook execute: execution state artifact initialization failed.');
    }

    const resumedLaneIds: string[] = [];
    for (const lane of launchPlanValidation.eligibleLanes) {
      if (run.laneStatuses[lane.lane_id] === 'completed') {
        resumedLaneIds.push(lane.lane_id);
        continue;
      }
      await engineModule.updateLaneState(lane.lane_id, 'running', cwd);
      await engineModule.recordWorkerResult(lane.lane_id, `worker-${lane.lane_id}`, { status: 'completed', retries: 0, summary: 'deterministic execution success (launch-authorized)' }, cwd);
    }

    await engineModule.finalizeExecution(run.runId, cwd);

    const mergeGuard = engineModule.evaluateExecutionMergeGuardForRun ? engineModule.evaluateExecutionMergeGuardForRun(cwd, run.runId) : undefined;
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
            orchestration_runs_path: ORCHESTRATION_RUNS_DIR,
            resumed_lane_ids: resumedLaneIds,
            lanes,
            execution_status: status,
            execution_merge_guards_path: EXECUTION_MERGE_GUARDS_PATH,
            runtime_capability_fingerprint: launchPlanValidation.runtimeCapabilityAuthorization.runtime_capability_fingerprint,
            merge_guard: mergeGuard
          },
          null,
          2
        )
      );
      const exitCode = status === 'SUCCESS' ? ExitCode.Success : ExitCode.Failure;
      tracker.finish({
        inputsSummary: `lanes=${worksetPlan.lanes.length}`,
        artifactsRead: [WORKSET_PLAN_PATH, WORKER_LAUNCH_PLAN_RELATIVE_PATH, LIFELINE_INTEROP_RUNTIME_PATH],
        artifactsWritten: [EXECUTION_STATE_PATH, ORCHESTRATION_RUNS_DIR, EXECUTION_MERGE_GUARDS_PATH],
        downstreamArtifactsProduced: [EXECUTION_STATE_PATH, ORCHESTRATION_RUNS_DIR, EXECUTION_MERGE_GUARDS_PATH],
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
      artifactsRead: [WORKSET_PLAN_PATH, WORKER_LAUNCH_PLAN_RELATIVE_PATH, LIFELINE_INTEROP_RUNTIME_PATH],
      artifactsWritten: [EXECUTION_STATE_PATH, ORCHESTRATION_RUNS_DIR],
      downstreamArtifactsProduced: [EXECUTION_STATE_PATH, ORCHESTRATION_RUNS_DIR],
      successStatus: exitCode === ExitCode.Success ? 'success' : 'partial'
    });
    return exitCode;
  } catch (error) {
    tracker.finish({
      inputsSummary: options.workerAdapter ? 'bridge runtime failure' : 'execution runtime failure',
      artifactsRead: options.workerAdapter ? [] : [WORKSET_PLAN_PATH, WORKER_LAUNCH_PLAN_RELATIVE_PATH, LIFELINE_INTEROP_RUNTIME_PATH],
      artifactsWritten: [EXECUTION_STATE_PATH],
      successStatus: 'failure',
      warningsCount: 1
    });
    throw error;
  }
};
