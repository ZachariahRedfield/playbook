import type { WorksetPlanArtifact, WorksetLane } from './worksetPlan.js';
import type { ProtectedDocConsolidationStatus } from './protectedDocConsolidation.js';

export type LaneExecutionStatus = 'blocked' | 'ready' | 'running' | 'completed' | 'merge_ready';

export type LaneStateEntry = {
  lane_id: string;
  task_ids: string[];
  status: LaneExecutionStatus;
  readiness_status: 'ready' | 'blocked';
  dependency_level: 'low' | 'medium' | 'high';
  dependencies_satisfied: boolean;
  blocked_reasons: string[];
  blocking_reasons: string[];
  conflict_surface_paths: string[];
  shared_artifact_risk: 'low' | 'medium' | 'high';
  assignment_confidence: number;
  verification_summary: {
    status: 'pending' | 'blocked';
    required_checks: string[];
    optional_checks: string[];
    notes: string[];
  };
  merge_ready: boolean;
  worker_ready: boolean;
  protected_doc_consolidation: ProtectedDocConsolidationStatus;
};

export type LaneStateArtifact = {
  schemaVersion: '1.0';
  kind: 'lane-state';
  generatedAt: string;
  proposalOnly: true;
  workset_plan_path: string;
  lanes: LaneStateEntry[];
  blocked_lanes: string[];
  ready_lanes: string[];
  running_lanes: string[];
  completed_lanes: string[];
  merge_ready_lanes: string[];
  dependency_status: {
    total_edges: number;
    satisfied_edges: number;
    unsatisfied_edges: number;
  };
  merge_readiness: {
    merge_ready_lanes: string[];
    not_merge_ready_lanes: Array<{ lane_id: string; reasons: string[] }>;
  };
  verification_status: {
    status: 'pending' | 'blocked';
    lanes_pending_verification: string[];
    lanes_blocked_from_verification: string[];
  };
  warnings: string[];
};

export type LaneLifecycleTransition = {
  action: 'start' | 'complete';
  lane_id: string;
};

export type LaneLifecycleTransitionResult = {
  laneState: LaneStateArtifact;
  applied: boolean;
  reason?: string;
};

const sortUnique = (values: readonly string[]): string[] => [...new Set(values)].sort((left, right) => left.localeCompare(right));

const blockedTaskLaneId = (taskId: string): string => `blocked-${taskId}`;

const mapDependencyGates = (worksetPlan: WorksetPlanArtifact): Map<string, string[]> => {
  const incoming = new Map<string, string[]>();
  for (const lane of worksetPlan.lanes) {
    incoming.set(lane.lane_id, []);
  }

  for (const edge of worksetPlan.dependency_edges) {
    const existing = incoming.get(edge.to_lane_id) ?? [];
    incoming.set(edge.to_lane_id, sortUnique([...existing, edge.from_lane_id]));
  }

  return incoming;
};

const verificationNotesForStatus = (
  lane: WorksetLane,
  status: LaneExecutionStatus,
  blockedReasons: string[],
  dependencyGates: string[]
): string[] => {
  const notes: string[] = [];
  if (blockedReasons.length > 0) {
    notes.push('verification deferred because lane lifecycle remains blocked');
  }
  if (status === 'ready') {
    notes.push('lane is ready for deterministic proposal-only start transition');
  }
  if (status === 'running') {
    notes.push('lane is running in proposal-only mode; no worker or branch automation is executed');
  }
  if (status === 'completed') {
    notes.push('lane is completed in proposal-only mode and awaiting conservative merge-readiness recomputation');
  }
  if (status === 'merge_ready') {
    notes.push('lane reached conservative merge-ready state; merge automation remains disabled');
  }
  if (dependencyGates.length > 0 && blockedReasons.some((reason) => reason.includes('waiting on dependency lane'))) {
    notes.push('dependency gates remain unresolved for this lane');
  }
  if (lane.likely_conflict_surfaces.length > 0) {
    notes.push('shared-risk surfaces require explicit merge coordination before verification sign-off');
  }
  if (lane.protected_doc_consolidation.stage !== 'not_applicable') {
    notes.push(lane.protected_doc_consolidation.summary);
  }

  return sortUnique(notes.length > 0 ? notes : ['verification remains pending under deterministic proposal-only controls']);
};

const determineStatus = (
  lane: WorksetLane,
  blockedReasons: string[],
  dependenciesSatisfied: boolean,
  override: LaneExecutionStatus | undefined,
  dependencyGates: string[]
): LaneExecutionStatus => {
  if (!dependenciesSatisfied || blockedReasons.length > 0) {
    return 'blocked';
  }

  if (override === 'running' || override === 'completed' || override === 'merge_ready') {
    return override === 'merge_ready' ? 'completed' : override;
  }

  if (override === 'blocked') {
    return 'blocked';
  }

  if (override === 'ready') {
    return 'ready';
  }

  if (dependencyGates.length > 0) {
    return 'ready';
  }

  return 'ready';
};

const isRealLane = (laneId: string): boolean => !laneId.startsWith('blocked-');

const toLaneStateEntry = (
  lane: WorksetLane,
  blockedReasons: string[],
  dependenciesSatisfied: boolean,
  dependencyGates: string[],
  override: LaneExecutionStatus | undefined
): LaneStateEntry => {
  const reasons = sortUnique([
    ...blockedReasons,
    ...(dependenciesSatisfied ? [] : dependencyGates.map((gateLane) => `waiting on dependency lane ${gateLane}`))
  ]);

  const status = determineStatus(lane, reasons, dependenciesSatisfied, override, dependencyGates);
  const verificationStatus = status === 'blocked' ? 'blocked' : 'pending';
  const readiness_status = lane.readiness_status === 'blocked' || reasons.length > 0 || !dependenciesSatisfied ? 'blocked' : 'ready';

  return {
    lane_id: lane.lane_id,
    task_ids: [...lane.task_ids].sort((left, right) => left.localeCompare(right)),
    status,
    readiness_status,
    dependency_level: lane.dependency_level,
    dependencies_satisfied: dependenciesSatisfied,
    blocked_reasons: reasons,
    blocking_reasons: [...reasons],
    conflict_surface_paths: [...lane.conflict_surface_paths],
    shared_artifact_risk: lane.shared_artifact_risk,
    assignment_confidence: lane.assignment_confidence,
    verification_summary: {
      status: verificationStatus,
      required_checks: ['pnpm -r build', 'pnpm test'],
      optional_checks: ['pnpm playbook contracts --json', 'pnpm playbook docs audit --json'],
      notes: verificationNotesForStatus(lane, status, reasons, dependencyGates)
    },
    merge_ready: false,
    worker_ready: lane.worker_ready,
    protected_doc_consolidation: lane.protected_doc_consolidation
  };
};

const recomputeMergeReadyStatuses = (
  entries: LaneStateEntry[],
  lanesById: Map<string, WorksetLane>,
  hasBlockedTasks: boolean
): LaneStateEntry[] => {
  const realLanes = entries.filter((entry) => isRealLane(entry.lane_id));
  const unresolvedRealLanes = realLanes.filter((entry) => entry.status !== 'completed' && entry.status !== 'merge_ready');
  const noUnresolvedLanes = unresolvedRealLanes.length === 0;

  return entries.map((entry) => {
    if (!isRealLane(entry.lane_id)) {
      return { ...entry, merge_ready: false };
    }

    const sourceLane = lanesById.get(entry.lane_id);
    const hasConflictSurfaces = Boolean(sourceLane && sourceLane.likely_conflict_surfaces.length > 0);
    const consolidationResolved =
      entry.protected_doc_consolidation.stage === 'not_applicable' || entry.protected_doc_consolidation.stage === 'applied';
    const mergeReady =
      entry.status === 'completed' &&
      entry.worker_ready &&
      entry.dependencies_satisfied &&
      !hasConflictSurfaces &&
      !hasBlockedTasks &&
      noUnresolvedLanes &&
      consolidationResolved;

    if (mergeReady) {
      return {
        ...entry,
        status: 'merge_ready',
        merge_ready: true,
        verification_summary: {
          ...entry.verification_summary,
          notes: sortUnique([...entry.verification_summary.notes, 'lane transitioned to merge_ready under conservative lifecycle constraints'])
        }
      };
    }

    return { ...entry, merge_ready: false };
  });
};

const deriveFromOverrides = (
  worksetPlan: WorksetPlanArtifact,
  worksetPlanPath: string,
  laneStatusOverrides: Readonly<Record<string, LaneExecutionStatus>>
): LaneStateArtifact => {
  const dependencyGates = mapDependencyGates(worksetPlan);
  const laneById = new Map(worksetPlan.lanes.map((lane) => [lane.lane_id, lane]));

  const sortedLaneIds = [...laneById.keys()].sort((left, right) => left.localeCompare(right));
  const laneEntries: LaneStateEntry[] = [];

  for (const laneId of sortedLaneIds) {
    const lane = laneById.get(laneId);
    if (!lane) continue;

    const dependencyIds = dependencyGates.get(laneId) ?? [];
    const dependenciesSatisfied = dependencyIds.every((dependencyId) => {
      const dependencyStatus = laneStatusOverrides[dependencyId];
      const dependencyLane = laneById.get(dependencyId);
      const dependencyCompleted = dependencyStatus === 'completed' || dependencyStatus === 'merge_ready';
      return dependencyCompleted && Boolean(dependencyLane?.worker_ready);
    });

    const blockedReasons: string[] = [...lane.blocking_reasons];
    if (!lane.worker_ready && !blockedReasons.includes('worker prerequisites are not satisfied')) {
      blockedReasons.push('worker prerequisites are not satisfied');
    }

    laneEntries.push(toLaneStateEntry(lane, blockedReasons, dependenciesSatisfied, dependencyIds, laneStatusOverrides[laneId]));
  }

  const blockedTaskEntries = [...worksetPlan.blocked_tasks]
    .sort((left, right) => left.task_id.localeCompare(right.task_id))
    .map((blockedTask): LaneStateEntry => ({
      lane_id: blockedTaskLaneId(blockedTask.task_id),
      task_ids: [blockedTask.task_id],
      status: 'blocked',
      readiness_status: 'blocked',
      dependency_level: 'high',
      dependencies_satisfied: false,
      blocked_reasons: sortUnique([blockedTask.reason, ...blockedTask.warnings, ...blockedTask.missing_prerequisites]),
      blocking_reasons: sortUnique([blockedTask.reason, ...blockedTask.warnings, ...blockedTask.missing_prerequisites]),
      conflict_surface_paths: [],
      shared_artifact_risk: 'high',
      assignment_confidence: 0.1,
      verification_summary: {
        status: 'blocked',
        required_checks: [],
        optional_checks: [],
        notes: ['blocked task must be refined before lane execution or verification can begin']
      },
      merge_ready: false,
      worker_ready: false,
      protected_doc_consolidation: { has_protected_doc_work: false, stage: 'not_applicable', summary: 'no protected-doc work', next_command: null }
    }));

  const mergedEntries = [...laneEntries, ...blockedTaskEntries].sort((left, right) => left.lane_id.localeCompare(right.lane_id));
  const orderedLanes = recomputeMergeReadyStatuses(mergedEntries, laneById, blockedTaskEntries.length > 0);

  const blocked_lanes = orderedLanes.filter((lane) => lane.status === 'blocked').map((lane) => lane.lane_id);
  const ready_lanes = orderedLanes.filter((lane) => lane.status === 'ready').map((lane) => lane.lane_id);
  const running_lanes = orderedLanes.filter((lane) => lane.status === 'running').map((lane) => lane.lane_id);
  const completed_lanes = orderedLanes.filter((lane) => lane.status === 'completed').map((lane) => lane.lane_id);
  const merge_ready_lanes = orderedLanes.filter((lane) => lane.status === 'merge_ready').map((lane) => lane.lane_id);

  const totalEdges = worksetPlan.dependency_edges.length;
  const unsatisfiedEdges = worksetPlan.dependency_edges.filter((edge) => {
    const targetLane = orderedLanes.find((lane) => lane.lane_id === edge.to_lane_id);
    return !targetLane?.dependencies_satisfied;
  }).length;

  const notMergeReady = orderedLanes
    .filter((lane) => !lane.merge_ready)
    .map((lane) => ({
      lane_id: lane.lane_id,
      reasons: sortUnique([
        ...(lane.status === 'blocked' ? lane.blocked_reasons : []),
        ...(lane.status !== 'merge_ready' ? ['lane has not reached merge_ready lifecycle state'] : []),
        ...(lane.worker_ready ? [] : ['worker prerequisites are not satisfied']),
        ...(lane.protected_doc_consolidation.stage === 'pending' ? ['pending protected-doc consolidation'] : []),
        ...(lane.protected_doc_consolidation.stage === 'blocked' ? ['blocked by conflicts'] : []),
        ...(lane.protected_doc_consolidation.stage === 'plan_ready' ? ['pending protected-doc consolidation'] : []),
        ...(lane.protected_doc_consolidation.stage === 'applied' || lane.protected_doc_consolidation.stage === 'not_applicable' ? [] : (lane.protected_doc_consolidation.next_command ? [`next command: ${lane.protected_doc_consolidation.next_command}`] : []))
      ])
    }))
    .sort((left, right) => left.lane_id.localeCompare(right.lane_id));

  const warnings = sortUnique([
    ...worksetPlan.warnings,
    ...(blocked_lanes.length > 0 ? ['one or more lanes remain blocked; autonomous execution must stay disabled'] : []),
    ...(ready_lanes.length === 0 && running_lanes.length === 0
      ? ['no lanes are in a startable or active state; refine blocked or dependency-gated work before execution']
      : []),
    ...(notMergeReady.length > 0 ? ['merge readiness is conservative and only true for safely completed lanes'] : [])
  ]);

  return {
    schemaVersion: '1.0',
    kind: 'lane-state',
    generatedAt: new Date(0).toISOString(),
    proposalOnly: true,
    workset_plan_path: worksetPlanPath,
    lanes: orderedLanes,
    blocked_lanes,
    ready_lanes,
    running_lanes,
    completed_lanes,
    merge_ready_lanes,
    dependency_status: {
      total_edges: totalEdges,
      satisfied_edges: totalEdges - unsatisfiedEdges,
      unsatisfied_edges: unsatisfiedEdges
    },
    merge_readiness: {
      merge_ready_lanes,
      not_merge_ready_lanes: notMergeReady
    },
    verification_status: {
      status: blocked_lanes.length > 0 ? 'blocked' : 'pending',
      lanes_pending_verification: orderedLanes
        .filter((lane) => lane.verification_summary.status === 'pending')
        .map((lane) => lane.lane_id),
      lanes_blocked_from_verification: orderedLanes
        .filter((lane) => lane.verification_summary.status === 'blocked')
        .map((lane) => lane.lane_id)
    },
    warnings
  };
};

export const deriveLaneState = (
  worksetPlan: WorksetPlanArtifact,
  worksetPlanPath: string,
  options?: { laneStatusOverrides?: Readonly<Record<string, LaneExecutionStatus>> }
): LaneStateArtifact => {
  const fallbackOverrides: Record<string, LaneExecutionStatus> = Object.fromEntries(
    worksetPlan.lanes.map((lane) => [lane.lane_id, lane.worker_ready ? 'ready' : 'blocked'])
  );

  const laneStatusOverrides = { ...fallbackOverrides, ...(options?.laneStatusOverrides ?? {}) };
  return deriveFromOverrides(worksetPlan, worksetPlanPath, laneStatusOverrides);
};

const laneStatusMap = (laneState: LaneStateArtifact): Record<string, LaneExecutionStatus> =>
  Object.fromEntries(laneState.lanes.map((lane) => [lane.lane_id, lane.status]));

export const applyLaneLifecycleTransition = (
  worksetPlan: WorksetPlanArtifact,
  worksetPlanPath: string,
  currentLaneState: LaneStateArtifact,
  transition: LaneLifecycleTransition
): LaneLifecycleTransitionResult => {
  const statuses = laneStatusMap(currentLaneState);
  const targetStatus = statuses[transition.lane_id];

  if (!targetStatus) {
    return {
      laneState: currentLaneState,
      applied: false,
      reason: `lane ${transition.lane_id} was not found in current lane-state`
    };
  }

  if (!isRealLane(transition.lane_id)) {
    return {
      laneState: currentLaneState,
      applied: false,
      reason: `lane ${transition.lane_id} is a blocked-task sentinel and cannot transition`
    };
  }

  if (transition.action === 'start') {
    if (targetStatus !== 'ready') {
      return {
        laneState: currentLaneState,
        applied: false,
        reason: `lane ${transition.lane_id} must be in ready state to transition to running`
      };
    }

    const next = deriveLaneState(worksetPlan, worksetPlanPath, {
      laneStatusOverrides: { ...statuses, [transition.lane_id]: 'running' }
    });

    const nextStatus = next.lanes.find((lane) => lane.lane_id === transition.lane_id)?.status;
    if (nextStatus !== 'running') {
      return {
        laneState: next,
        applied: false,
        reason: `lane ${transition.lane_id} remained ${nextStatus ?? 'unknown'} after deterministic dependency gating`
      };
    }

    return { laneState: next, applied: true };
  }

  if (targetStatus !== 'running') {
    return {
      laneState: currentLaneState,
      applied: false,
      reason: `lane ${transition.lane_id} must be running before it can be completed`
    };
  }

  const next = deriveLaneState(worksetPlan, worksetPlanPath, {
    laneStatusOverrides: { ...statuses, [transition.lane_id]: 'completed' }
  });

  const nextStatus = next.lanes.find((lane) => lane.lane_id === transition.lane_id)?.status;
  if (nextStatus !== 'completed' && nextStatus !== 'merge_ready') {
    return {
      laneState: next,
      applied: false,
      reason: `lane ${transition.lane_id} remained ${nextStatus ?? 'unknown'} after completion transition`
    };
  }

  return { laneState: next, applied: true };
};
