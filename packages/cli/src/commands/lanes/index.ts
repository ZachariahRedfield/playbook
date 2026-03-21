import fs from 'node:fs';
import path from 'node:path';
import {
  applyLaneLifecycleTransition,
  deriveLaneState,
  type LaneLifecycleTransition,
  type LaneStateArtifact,
  type WorksetPlanArtifact
} from '@zachariahredfield/playbook-engine';
import { ExitCode } from '../../lib/cliContract.js';
import { renderBriefReport } from '../../lib/briefText.js';

const WORKSET_PLAN_PATH = '.playbook/workset-plan.json';
const LANE_STATE_PATH = '.playbook/lane-state.json';

type LanesOptions = {
  format: 'text' | 'json';
  quiet: boolean;
  action?: LaneLifecycleTransition['action'];
  laneId?: string;
};

const printText = (result: LaneStateArtifact): void => {
  const firstBlocked = result.lanes.find((entry: (typeof result.lanes)[number]) => entry.status === 'blocked');
  console.log(
    renderBriefReport({
      title: 'Lane state',
      decision: result.blocked_lanes.length > 0 ? `${result.blocked_lanes.length} lane(s) blocked` : `${result.ready_lanes.length} lane(s) ready`,
      affectedSurfaces: [result.workset_plan_path, `${result.ready_lanes.length} ready`, `${result.merge_readiness.merge_ready_lanes.length} merge-ready`],
      blockers: [firstBlocked ? `${firstBlocked.lane_id}: ${firstBlocked.blocked_reasons.join('; ') || 'blocked'}` : null],
      nextAction: result.ready_lanes[0] ? `Assign worker for ${result.ready_lanes[0].lane_id}` : 'Resolve blocked lanes before worker assignment',
      sections: [{ heading: 'Why', items: [`Running: ${result.running_lanes.length}`, `Completed: ${result.completed_lanes.length}`] }]
    })
  );
};

const readWorksetPlan = (cwd: string): WorksetPlanArtifact | undefined => {
  const worksetPlanFile = path.join(cwd, WORKSET_PLAN_PATH);
  if (!fs.existsSync(worksetPlanFile)) {
    return undefined;
  }

  return JSON.parse(fs.readFileSync(worksetPlanFile, 'utf8')) as WorksetPlanArtifact;
};

const readLaneState = (cwd: string): LaneStateArtifact | undefined => {
  const laneStateFile = path.join(cwd, LANE_STATE_PATH);
  if (!fs.existsSync(laneStateFile)) {
    return undefined;
  }

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

    const currentLaneState = readLaneState(cwd) ?? deriveLaneState(worksetPlan, WORKSET_PLAN_PATH);
    const transition = applyLaneLifecycleTransition(worksetPlan, WORKSET_PLAN_PATH, currentLaneState, {
      action: options.action,
      lane_id: options.laneId
    });

    writeLaneState(cwd, transition.laneState);

    if (options.format === 'json') {
      console.log(
        JSON.stringify(
          {
            schemaVersion: '1.0',
            command: 'lanes',
            lifecycle_action: options.action,
            lane_id: options.laneId,
            applied: transition.applied,
            reason: transition.reason,
            lane_state_path: LANE_STATE_PATH,
            lane_state: transition.laneState
          },
          null,
          2
        )
      );
    } else if (!options.quiet) {
      if (transition.applied) {
        console.log(`Applied proposal-only lane transition: ${options.action} ${options.laneId}`);
      } else {
        console.log(`Lane transition not applied: ${transition.reason ?? 'unknown reason'}`);
      }
      printText(transition.laneState);
    }

    return transition.applied ? ExitCode.Success : ExitCode.Failure;
  }

  const laneState = deriveLaneState(worksetPlan, WORKSET_PLAN_PATH);
  writeLaneState(cwd, laneState);

  if (options.format === 'json') {
    console.log(
      JSON.stringify(
        {
          schemaVersion: '1.0',
          command: 'lanes',
          lane_state_path: LANE_STATE_PATH,
          lane_state: laneState
        },
        null,
        2
      )
    );
    return laneState.blocked_lanes.length > 0 ? ExitCode.Failure : ExitCode.Success;
  }

  if (!options.quiet) {
    printText(laneState);
  }

  return laneState.blocked_lanes.length > 0 ? ExitCode.Failure : ExitCode.Success;
};
