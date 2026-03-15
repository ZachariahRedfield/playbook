import fs from 'node:fs';
import path from 'node:path';
import {
  assignWorkersToLanes,
  buildAssignedPrompt,
  deriveLaneState,
  recordLaneOutcome,
  recordWorkerAssignment,
  safeRecordRepositoryEvent,
  type LaneStateArtifact,
  type WorksetPlanArtifact
} from '@zachariahredfield/playbook-engine';
import { ExitCode } from '../../lib/cliContract.js';

const WORKSET_PLAN_PATH = '.playbook/workset-plan.json';
const LANE_STATE_PATH = '.playbook/lane-state.json';
const WORKER_ASSIGNMENTS_PATH = '.playbook/worker-assignments.json';
const PROMPTS_DIR = '.playbook/prompts';


type WorkerAssignmentEntry = {
  lane_id: string;
  status: 'assigned' | 'blocked' | 'skipped';
  assigned_prompt: string;
};

type WorkerAssignmentsArtifactView = {
  lanes: WorkerAssignmentEntry[];
  workers: unknown[];
  warnings: string[];
};

type WorkersOptions = {
  format: 'text' | 'json';
  quiet: boolean;
  action?: 'assign';
};

const readJsonArtifact = <T>(cwd: string, artifactPath: string): T | undefined => {
  const absolutePath = path.join(cwd, artifactPath);
  if (!fs.existsSync(absolutePath)) {
    return undefined;
  }

  return JSON.parse(fs.readFileSync(absolutePath, 'utf8')) as T;
};

const writeJsonArtifact = (cwd: string, artifactPath: string, payload: unknown): void => {
  const absolutePath = path.join(cwd, artifactPath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
};

const resolveLaneState = (cwd: string, worksetPlan: WorksetPlanArtifact): LaneStateArtifact =>
  readJsonArtifact<LaneStateArtifact>(cwd, LANE_STATE_PATH) ?? deriveLaneState(worksetPlan, WORKSET_PLAN_PATH);

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

const printText = (assignments: WorkerAssignmentsArtifactView): void => {
  console.log('Worker Assignments');
  console.log('──────────────────');
  console.log(`Assigned lanes: ${assignments.lanes.filter((lane) => lane.status === 'assigned').length}`);
  console.log(`Blocked lanes: ${assignments.lanes.filter((lane) => lane.status === 'blocked').length}`);
  console.log(`Skipped lanes: ${assignments.lanes.filter((lane) => lane.status === 'skipped').length}`);
  console.log(`Workers: ${assignments.workers.length}`);
};

const printError = (options: WorkersOptions, message: string): void => {
  if (options.format === 'json') {
    console.log(JSON.stringify({ schemaVersion: '1.0', command: 'workers', error: message }, null, 2));
    return;
  }
  console.error(message);
};

export const runWorkers = async (cwd: string, options: WorkersOptions): Promise<number> => {
  const worksetPlan = readJsonArtifact<WorksetPlanArtifact>(cwd, WORKSET_PLAN_PATH);
  if (!worksetPlan) {
    printError(options, `playbook workers: missing workset plan at ${WORKSET_PLAN_PATH}. Run "playbook orchestrate --tasks-file <path>" first.`);
    return ExitCode.Failure;
  }

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
        ...(lane.assigned_prompt ? { assigned_prompt: lane.assigned_prompt } : {})
      });

      recordLaneOutcome(cwd, {
        lane_id: lane.lane_id,
        outcome: lane.status === 'assigned' ? 'success' : lane.status === 'blocked' ? 'blocked' : 'partial',
        summary: lane.status === 'assigned' ? 'worker assigned and prompt emitted' : lane.status === 'blocked' ? 'lane blocked from worker assignment' : 'lane skipped during deterministic assignment'
      });
    }
  });

  if (options.format === 'json') {
    console.log(
      JSON.stringify(
        {
          schemaVersion: '1.0',
          command: 'workers',
          action: options.action ?? 'status',
          worker_assignments_path: WORKER_ASSIGNMENTS_PATH,
          prompts_dir: PROMPTS_DIR,
          written_prompts: promptPaths,
          worker_assignments: assignments
        },
        null,
        2
      )
    );
    return ExitCode.Success;
  }

  if (!options.quiet) {
    printText(assignments);
    console.log(`Artifact: ${WORKER_ASSIGNMENTS_PATH}`);
    console.log(`Prompts: ${promptPaths.length > 0 ? promptPaths.join(', ') : `${PROMPTS_DIR} (none written)`}`);
  }

  return ExitCode.Success;
};
