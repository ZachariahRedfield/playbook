import fs from 'node:fs';
import path from 'node:path';
import {
  applyLaneLifecycleTransition,
  deriveLaneState,
  readWorkerResultsArtifact,
  type LaneLifecycleTransition,
  type LaneStateArtifact,
  type WorksetPlanArtifact
} from '@zachariahredfield/playbook-engine';
import { ExitCode } from '../../lib/cliContract.js';

const WORKSET_PLAN_PATH = '.playbook/workset-plan.json';
const LANE_STATE_PATH = '.playbook/lane-state.json';

type LanesOptions = {
  format: 'text' | 'json';
  quiet: boolean;
  action?: LaneLifecycleTransition['action'];
  laneId?: string;
};

const printText = (result: LaneStateArtifact): void => {
  console.log('Lane State');
  console.log('──────────');
  console.log(`Workset plan: ${result.workset_plan_path}`);
  console.log(`Blocked lanes: ${result.blocked_lanes.length}`);
  console.log(`Ready lanes: ${result.ready_lanes.length}`);
  console.log(`Running lanes: ${result.running_lanes.length}`);
  console.log(`Completed lanes: ${result.completed_lanes.length}`);
  console.log(`Merge-ready lanes: ${result.merge_readiness.merge_ready_lanes.length}`);

  const consolidationSummaries = result.lanes
    .filter((lane: LaneStateArtifact['lanes'][number]) => lane.protected_doc_consolidation.stage !== 'not_applicable' && lane.protected_doc_consolidation.stage !== 'applied')
    .map((lane: LaneStateArtifact['lanes'][number]) => `- ${lane.lane_id}: ${lane.protected_doc_consolidation.summary}${lane.protected_doc_consolidation.next_command ? `; next command: ${lane.protected_doc_consolidation.next_command}` : ''}`);

  if (consolidationSummaries.length > 0) {
    console.log('');
    console.log('Protected-doc consolidation:');
    for (const summary of consolidationSummaries) console.log(summary);
  }

  if (result.blocked_lanes.length > 0) {
    console.log('');
    console.log('Blocked lane details:');
    for (const lane of result.lanes.filter((entry: LaneStateArtifact['lanes'][number]) => entry.status === 'blocked')) {
      console.log(`- ${lane.lane_id}: ${lane.blocked_reasons.join('; ') || 'blocked'}`);
      if (lane.conflict_surface_paths.length > 0) console.log(`  conflict surfaces: ${lane.conflict_surface_paths.join(', ')}`);
    }
  }
};

const readWorksetPlan = (cwd: string): WorksetPlanArtifact | undefined => {
  const worksetPlanFile = path.join(cwd, WORKSET_PLAN_PATH);
  if (!fs.existsSync(worksetPlanFile)) return undefined;
  return JSON.parse(fs.readFileSync(worksetPlanFile, 'utf8')) as WorksetPlanArtifact;
};

const readLaneState = (cwd: string): LaneStateArtifact | undefined => {
  const laneStateFile = path.join(cwd, LANE_STATE_PATH);
  if (!fs.existsSync(laneStateFile)) return undefined;
  return JSON.parse(fs.readFileSync(laneStateFile, 'utf8')) as LaneStateArtifact;
};

const writeLaneState = (cwd: string, laneState: LaneStateArtifact): void => {
  fs.mkdirSync(path.join(cwd, '.playbook'), { recursive: true });
  fs.writeFileSync(path.join(cwd, LANE_STATE_PATH), `${JSON.stringify(laneState, null, 2)}\n`, 'utf8');
};

const printError = (options: LanesOptions, message: string): void => {
  if (options.format === 'json') {
    console.log(JSON.stringify({ schemaVersion: '1.0', command: 'lanes', error: message }, null, 2));
    return;
  }
  console.error(message);
};

const deriveCurrentLaneState = (cwd: string, worksetPlan: WorksetPlanArtifact): LaneStateArtifact =>
  deriveLaneState(worksetPlan, WORKSET_PLAN_PATH, { workerResults: readWorkerResultsArtifact(cwd) });

export const runLanes = async (cwd: string, options: LanesOptions): Promise<number> => {
  const worksetPlan = readWorksetPlan(cwd);
  if (!worksetPlan) {
    printError(options, `playbook lanes: missing workset plan at ${WORKSET_PLAN_PATH}. Run "playbook orchestrate --tasks-file <path>" first.`);
    return ExitCode.Failure;
  }

  if (options.action) {
    if (!options.laneId) {
      printError(options, 'playbook lanes: lane id is required for lifecycle transitions.');
      return ExitCode.Failure;
    }

    const currentLaneState = readLaneState(cwd) ?? deriveCurrentLaneState(cwd, worksetPlan);
    const transition = applyLaneLifecycleTransition(worksetPlan, WORKSET_PLAN_PATH, currentLaneState, {
      action: options.action,
      lane_id: options.laneId
    });

    writeLaneState(cwd, transition.laneState);

    if (options.format === 'json') {
      console.log(JSON.stringify({ schemaVersion: '1.0', command: 'lanes', lifecycle_action: options.action, lane_id: options.laneId, applied: transition.applied, reason: transition.reason, lane_state_path: LANE_STATE_PATH, lane_state: transition.laneState }, null, 2));
    } else if (!options.quiet) {
      console.log(transition.applied ? `Applied proposal-only lane transition: ${options.action} ${options.laneId}` : `Lane transition not applied: ${transition.reason ?? 'unknown reason'}`);
      printText(transition.laneState);
    }

    return transition.applied ? ExitCode.Success : ExitCode.Failure;
  }

  const laneState = deriveCurrentLaneState(cwd, worksetPlan);
  writeLaneState(cwd, laneState);

  if (options.format === 'json') {
    console.log(JSON.stringify({ schemaVersion: '1.0', command: 'lanes', lane_state_path: LANE_STATE_PATH, lane_state: laneState }, null, 2));
    return laneState.blocked_lanes.length > 0 ? ExitCode.Failure : ExitCode.Success;
  }

  if (!options.quiet) printText(laneState);
  return laneState.blocked_lanes.length > 0 ? ExitCode.Failure : ExitCode.Success;
};
