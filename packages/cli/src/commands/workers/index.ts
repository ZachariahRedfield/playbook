import fs from 'node:fs';
import path from 'node:path';
import {
  assignWorkersToLanes,
  buildAssignedPrompt,
  buildChangeScopeBundleFromWorkerLaunchPlan,
  buildWorkerLaunchPlan,
  deriveLaneState,
  mergeWorkerResult,
  readWorkerResultsArtifact,
  recordLaneOutcome,
  recordWorkerAssignment,
  safeRecordRepositoryEvent,
  validateWorkerResultInput,
  writeChangeScopeArtifact,
  writeWorkerLaunchPlanArtifact,
  writeWorkerResultsArtifact,
  WORKER_LAUNCH_PLAN_RELATIVE_PATH,
  WORKER_RESULTS_RELATIVE_PATH,
  type LaneStateArtifact,
  type ChangeScopeArtifact,
  type WorksetPlanArtifact,
  type WorkerAssignmentsArtifact,
  type WorkerResultArtifactRef,
  type WorkerResultFragmentRef
} from '@zachariahredfield/playbook-engine';
import { ExitCode } from '../../lib/cliContract.js';

const WORKSET_PLAN_PATH = '.playbook/workset-plan.json';
const LANE_STATE_PATH = '.playbook/lane-state.json';
const WORKER_ASSIGNMENTS_PATH = '.playbook/worker-assignments.json';
const PROMPTS_DIR = '.playbook/prompts';

type WorkerAssignmentEntry = {
  lane_id: string;
  status: 'assigned' | 'blocked' | 'skipped';
  readiness_status: 'ready' | 'blocked';
  assigned_prompt: string;
  blocking_reasons: string[];
  conflict_surface_paths: string[];
};

type WorkerAssignmentsArtifactView = {
  lanes: WorkerAssignmentEntry[];
  readiness_summary: {
    ready_lanes: string[];
    blocked_lanes: Array<{ lane_id: string; reasons: string[] }>;
    conflict_surface_paths: string[];
  };
  workers: unknown[];
  warnings: string[];
};

type WorkersOptions = {
  format: 'text' | 'json';
  quiet: boolean;
  action?: 'assign' | 'submit' | 'launch-plan';
  from?: string;
};

type WorkerResultSubmitInput = {
  lane_id: string;
  task_ids: string[];
  worker_type: string;
  completion_status: 'in_progress' | 'completed' | 'blocked';
  summary: string;
  blockers?: string[];
  unresolved_items?: string[];
  fragment_refs?: WorkerResultFragmentRef[];
  proof_refs?: WorkerResultArtifactRef[];
  artifact_refs?: WorkerResultArtifactRef[];
};

const readJsonArtifact = <T>(cwd: string, artifactPath: string): T | undefined => {
  const absolutePath = path.join(cwd, artifactPath);
  if (!fs.existsSync(absolutePath)) return undefined;
  return JSON.parse(fs.readFileSync(absolutePath, 'utf8')) as T;
};

const writeJsonArtifact = (cwd: string, artifactPath: string, payload: unknown): void => {
  const absolutePath = path.join(cwd, artifactPath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
};

const resolveLaneState = (cwd: string, worksetPlan: WorksetPlanArtifact): LaneStateArtifact =>
  deriveLaneState(worksetPlan, WORKSET_PLAN_PATH, { workerResults: readWorkerResultsArtifact(cwd) });

const writeAssignedPrompts = (cwd: string, assignments: WorkerAssignmentsArtifactView, worksetPlan?: WorksetPlanArtifact): string[] => {
  const lanePromptsById = new Map((worksetPlan?.lanes ?? []).map((lane: { lane_id: string; codex_prompt: string }) => [lane.lane_id, lane.codex_prompt]));
  const written: string[] = [];

  for (const lane of assignments.lanes.filter((entry) => entry.status === 'assigned')) {
    const codexPrompt = lanePromptsById.get(lane.lane_id) ?? '';
    const markdown = buildAssignedPrompt(lane.lane_id, codexPrompt);
    const promptPath = path.join(cwd, lane.assigned_prompt);
    fs.mkdirSync(path.dirname(promptPath), { recursive: true });
    fs.writeFileSync(promptPath, `${markdown.trimEnd()}\n`, 'utf8');
    written.push(lane.assigned_prompt);
  }

  return written.sort((left, right) => left.localeCompare(right));
};

const printAssignText = (assignments: WorkerAssignmentsArtifactView): void => {
  console.log('Worker Assignments');
  console.log('──────────────────');
  console.log(`Assigned lanes: ${assignments.lanes.filter((lane) => lane.status === 'assigned').length}`);
  console.log(`Blocked lanes: ${assignments.lanes.filter((lane) => lane.status === 'blocked').length}`);
  console.log(`Skipped lanes: ${assignments.lanes.filter((lane) => lane.status === 'skipped').length}`);
  console.log(`Workers: ${assignments.workers.length}`);
  if (assignments.readiness_summary.ready_lanes.length > 0) console.log(`Ready lane IDs: ${assignments.readiness_summary.ready_lanes.join(', ')}`);
  if (assignments.readiness_summary.blocked_lanes.length > 0) {
    console.log('Blocked lane reasons:');
    for (const blocked of assignments.readiness_summary.blocked_lanes) {
      console.log(`- ${blocked.lane_id}: ${blocked.reasons.join('; ') || 'blocked'}`);
    }
  }
  if (assignments.readiness_summary.conflict_surface_paths.length > 0) {
    console.log(`Conflict surfaces: ${assignments.readiness_summary.conflict_surface_paths.join(', ')}`);
  }
};

const printSubmitText = (payload: { decision: string; affected_surfaces: string[]; blockers: string[]; next_action: string | null }): void => {
  console.log('Worker Submit');
  console.log('─────────────');
  console.log(`Decision: ${payload.decision}`);
  console.log(`Affected surfaces: ${payload.affected_surfaces.length > 0 ? payload.affected_surfaces.join(', ') : 'none'}`);
  console.log(`Blockers: ${payload.blockers.length > 0 ? payload.blockers.join('; ') : 'none'}`);
  console.log(`Next action: ${payload.next_action ?? 'none'}`);
};

const printError = (options: WorkersOptions, message: string): void => {
  if (options.format === 'json') {
    console.log(JSON.stringify({ schemaVersion: '1.0', command: 'workers', action: options.action ?? 'status', error: message }, null, 2));
    return;
  }
  console.error(message);
};

const parseWorkerResultInput = (cwd: string, from: string): WorkerResultSubmitInput => {
  const absolutePath = path.isAbsolute(from) ? from : path.join(cwd, from);
  return JSON.parse(fs.readFileSync(absolutePath, 'utf8')) as WorkerResultSubmitInput;
};

const runAssign = async (cwd: string, options: WorkersOptions, worksetPlan: WorksetPlanArtifact): Promise<number> => {
  const laneState = resolveLaneState(cwd, worksetPlan);
  writeJsonArtifact(cwd, LANE_STATE_PATH, laneState);

  const assignments = assignWorkersToLanes(laneState, worksetPlan) as WorkerAssignmentsArtifactView;
  const promptPaths = writeAssignedPrompts(cwd, assignments, worksetPlan);
  writeJsonArtifact(cwd, WORKER_ASSIGNMENTS_PATH, assignments);

  safeRecordRepositoryEvent(() => {
    for (const lane of [...assignments.lanes].sort((left, right) => left.lane_id.localeCompare(right.lane_id))) {
      recordWorkerAssignment(cwd, {
        lane_id: lane.lane_id,
        worker_id: `worker-${lane.lane_id}`,
        assignment_status: lane.status,
        ...(lane.assigned_prompt ? { assigned_prompt: lane.assigned_prompt } : {}),
        related_artifacts: [{ path: WORKER_ASSIGNMENTS_PATH, kind: 'worker_assignments' }]
      });

      recordLaneOutcome(cwd, {
        lane_id: lane.lane_id,
        outcome: lane.status === 'assigned' ? 'success' : lane.status === 'blocked' ? 'blocked' : 'partial',
        summary: lane.status === 'assigned' ? 'worker assigned and prompt emitted' : lane.status === 'blocked' ? 'lane blocked from worker assignment' : 'lane skipped during deterministic assignment',
        related_artifacts: [{ path: WORKER_ASSIGNMENTS_PATH, kind: 'worker_assignments' }]
      });
    }
  });

  if (options.format === 'json') {
    console.log(JSON.stringify({ schemaVersion: '1.0', command: 'workers', action: options.action ?? 'status', worker_assignments_path: WORKER_ASSIGNMENTS_PATH, prompts_dir: PROMPTS_DIR, written_prompts: promptPaths, worker_assignments: assignments }, null, 2));
    return ExitCode.Success;
  }

  if (!options.quiet) {
    printAssignText(assignments);
    console.log(`Artifact: ${WORKER_ASSIGNMENTS_PATH}`);
    console.log(`Prompts: ${promptPaths.length > 0 ? promptPaths.join(', ') : `${PROMPTS_DIR} (none written)`}`);
  }
  return ExitCode.Success;
};

const runLaunchPlan = async (cwd: string, options: WorkersOptions, worksetPlan: WorksetPlanArtifact): Promise<number> => {
  const laneState = resolveLaneState(cwd, worksetPlan);
  writeJsonArtifact(cwd, LANE_STATE_PATH, laneState);

  const assignments = assignWorkersToLanes(laneState, worksetPlan) as WorkerAssignmentsArtifact;
  writeJsonArtifact(cwd, WORKER_ASSIGNMENTS_PATH, assignments);

  const launchPlan = buildWorkerLaunchPlan(cwd, {
    worksetPlan,
    laneState,
    workerAssignments: assignments,
    worksetPlanPath: WORKSET_PLAN_PATH,
    laneStatePath: LANE_STATE_PATH,
    workerAssignmentsPath: WORKER_ASSIGNMENTS_PATH
  });
  writeWorkerLaunchPlanArtifact(cwd, launchPlan);
  const changeScopeBundle = buildChangeScopeBundleFromWorkerLaunchPlan(launchPlan);
  writeChangeScopeArtifact(cwd, changeScopeBundle);

  if (options.format === 'json') {
    console.log(JSON.stringify({
      schemaVersion: '1.0',
      command: 'workers',
      action: 'launch-plan',
      worker_launch_plan_path: WORKER_LAUNCH_PLAN_RELATIVE_PATH,
      worker_launch_plan: launchPlan
    }, null, 2));
    return ExitCode.Success;
  }

  if (!options.quiet) {
    console.log('Worker Launch Plan');
    console.log('──────────────────');
    console.log(`Launch-eligible lanes: ${launchPlan.summary.launchEligibleLanes.length}`);
    console.log(`Blocked lanes: ${launchPlan.summary.blockedLanes.length}`);
    console.log(`Artifact: ${WORKER_LAUNCH_PLAN_RELATIVE_PATH}`);
  }

  return ExitCode.Success;
};

const runSubmit = async (cwd: string, options: WorkersOptions, worksetPlan: WorksetPlanArtifact): Promise<number> => {
  if (!options.from) {
    printError(options, 'playbook workers submit: --from <path> is required.');
    return ExitCode.Failure;
  }

  const input = parseWorkerResultInput(cwd, options.from);
  const changeScope = readJsonArtifact<ChangeScopeArtifact>(cwd, '.playbook/change-scope.json');
  const validationErrors = validateWorkerResultInput(worksetPlan, input, { changeScope });
  if (validationErrors.length > 0) {
    printError(options, `playbook workers submit: ${validationErrors.join('; ')}`);
    return ExitCode.Failure;
  }

  const existing = readWorkerResultsArtifact(cwd);
  const merged = mergeWorkerResult(existing, input);
  writeWorkerResultsArtifact(cwd, merged.artifact);

  const laneState = deriveLaneState(worksetPlan, WORKSET_PLAN_PATH, { workerResults: merged.artifact });
  writeJsonArtifact(cwd, LANE_STATE_PATH, laneState);

  const laneEntry = laneState.lanes.find((lane: LaneStateArtifact['lanes'][number]) => lane.lane_id === merged.result.lane_id);
  const affectedSurfaces = [
    ...merged.result.fragment_refs.map((ref: NonNullable<typeof merged.result.fragment_refs>[number]) => ref.target_path),
    ...merged.result.proof_refs.map((ref: NonNullable<typeof merged.result.proof_refs>[number]) => ref.path),
    ...merged.result.artifact_refs.map((ref: NonNullable<typeof merged.result.artifact_refs>[number]) => ref.path)
  ].sort((left, right) => left.localeCompare(right));
  const nextAction = laneEntry?.protected_doc_consolidation.next_command ?? (merged.result.completion_status === 'completed' ? 'pnpm playbook lanes --json' : null);
  const decision = merged.result.completion_status === 'completed' ? 'accepted worker result' : merged.result.completion_status === 'blocked' ? 'accepted blocked worker result' : 'accepted in-progress worker result';

  if (options.format === 'json') {
    console.log(JSON.stringify({
      schemaVersion: '1.0',
      command: 'workers',
      action: 'submit',
      decision,
      worker_results_path: WORKER_RESULTS_RELATIVE_PATH,
      lane_state_path: LANE_STATE_PATH,
      result: merged.result,
      lane_state: laneState,
      affected_surfaces: affectedSurfaces,
      blockers: [...merged.result.blockers, ...merged.result.unresolved_items].sort((a, b) => a.localeCompare(b)),
      next_action: nextAction
    }, null, 2));
    return ExitCode.Success;
  }

  if (!options.quiet) {
    printSubmitText({
      decision,
      affected_surfaces: affectedSurfaces,
      blockers: [...merged.result.blockers, ...merged.result.unresolved_items].sort((a, b) => a.localeCompare(b)),
      next_action: nextAction
    });
  }

  return ExitCode.Success;
};

export const runWorkers = async (cwd: string, options: WorkersOptions): Promise<number> => {
  const worksetPlan = readJsonArtifact<WorksetPlanArtifact>(cwd, WORKSET_PLAN_PATH);
  if (!worksetPlan) {
    printError(options, `playbook workers: missing workset plan at ${WORKSET_PLAN_PATH}. Run "playbook orchestrate --tasks-file <path>" first.`);
    return ExitCode.Failure;
  }

  if (options.action === 'submit') return runSubmit(cwd, options, worksetPlan);
  if (options.action === 'launch-plan') return runLaunchPlan(cwd, options, worksetPlan);
  return runAssign(cwd, options, worksetPlan);
};
