import { buildExecutionPlan } from '../routing/executionPlan.js';
import { routeTask } from '../routing/routeTask.js';
import { compileCodexPrompt } from '../routing/codexPrompt.js';
import { computeProtectedDocConsolidationStatus, type ProtectedDocConsolidationStatus } from './protectedDocConsolidation.js';

export type WorksetTaskInput = {
  task_id: string;
  task: string;
};

export type WorksetLane = {
  lane_id: string;
  task_ids: string[];
  task_families: string[];
  expected_surfaces: string[];
  likely_conflict_surfaces: string[];
  readiness_status: 'ready' | 'blocked';
  blocking_reasons: string[];
  conflict_surface_paths: string[];
  shared_artifact_risk: 'low' | 'medium' | 'high';
  assignment_confidence: number;
  dependency_level: 'low' | 'medium' | 'high';
  recommended_pr_size: 'small' | 'medium' | 'large';
  worker_ready: boolean;
  codex_prompt: string;
  protected_doc_consolidation: ProtectedDocConsolidationStatus;
};

export type WorksetPlanArtifact = {
  schemaVersion: '1.0';
  kind: 'workset-plan';
  generatedAt: string;
  proposalOnly: true;
  input_tasks: WorksetTaskInput[];
  routed_tasks: Array<{
    task_id: string;
    task: string;
    selected_route: string;
    task_family: string;
    expected_surfaces: string[];
    likely_conflict_surfaces: string[];
    dependency_level: 'low' | 'medium' | 'high';
    recommended_pr_size: 'small' | 'medium' | 'large';
    worker_ready: boolean;
    warnings: string[];
    missing_prerequisites: string[];
  }>;
  lanes: WorksetLane[];
  blocked_tasks: Array<{ task_id: string; reason: string; warnings: string[]; missing_prerequisites: string[] }>;
  dependency_edges: Array<{ from_lane_id: string; to_lane_id: string; reason: string }>;
  validation: {
    overlapping_file_domains: Array<{ lane_ids: string[]; surface_path: string }>;
    conflicting_artifact_ownership: Array<{ lane_ids: string[]; artifact_path: string }>;
    blocked_lane_dependencies: Array<{ lane_id: string; waiting_on_lane_ids: string[] }>;
  };
  merge_risk_notes: string[];
  sourceArtifacts: {
    tasksFile: { available: boolean; artifactPath: string };
    taskExecutionProfile: { available: boolean; artifactPath: string };
    learningState: { available: boolean; artifactPath: string };
  };
  warnings: string[];
};

type RoutedWorksetTask = {
  task_id: string;
  task: string;
  decision: ReturnType<typeof routeTask>;
  executionPlan: ReturnType<typeof buildExecutionPlan>;
  ambiguous: boolean;
};

const TASK_EXECUTION_PROFILE_PATH = '.playbook/task-execution-profile.json';
const LEARNING_STATE_PATH = '.playbook/learning-state.json';

const sortUnique = (values: readonly string[]): string[] => [...new Set(values)].sort((left, right) => left.localeCompare(right));

const LEVEL_ORDER: Record<'low' | 'medium' | 'high', number> = { low: 1, medium: 2, high: 3 };
const SIZE_ORDER: Record<'small' | 'medium' | 'large', number> = { small: 1, medium: 2, large: 3 };

const taskSort = (left: WorksetTaskInput, right: WorksetTaskInput): number => left.task_id.localeCompare(right.task_id);

const levelForLane = (tasks: RoutedWorksetTask[]): 'low' | 'medium' | 'high' =>
  tasks
    .map((task) => task.executionPlan.dependency_level)
    .sort((left, right) => LEVEL_ORDER[right] - LEVEL_ORDER[left])[0] ?? 'high';

const sizeForLane = (tasks: RoutedWorksetTask[]): 'small' | 'medium' | 'large' =>
  tasks
    .map((task) => task.executionPlan.recommended_pr_size)
    .sort((left, right) => SIZE_ORDER[right] - SIZE_ORDER[left])[0] ?? 'large';

const laneCanAcceptTask = (laneTasks: RoutedWorksetTask[], candidate: RoutedWorksetTask): boolean => {
  if (laneTasks.length === 0) return true;

  const laneFamilies = new Set(laneTasks.map((entry) => entry.executionPlan.task_family));
  if (!laneFamilies.has(candidate.executionPlan.task_family)) {
    return false;
  }

  const laneExpected = new Set(laneTasks.flatMap((entry) => entry.executionPlan.expected_surfaces));
  const laneConflicts = new Set(laneTasks.flatMap((entry) => entry.executionPlan.likely_conflict_surfaces));
  const candidateExpected = new Set(candidate.executionPlan.expected_surfaces);
  const candidateConflicts = new Set(candidate.executionPlan.likely_conflict_surfaces);

  for (const surface of candidateExpected) {
    if (laneConflicts.has(surface)) return false;
  }

  for (const surface of laneExpected) {
    if (candidateConflicts.has(surface)) return false;
  }

  return levelForLane(laneTasks) === candidate.executionPlan.dependency_level;
};

const lanePrompt = (laneId: string, laneTasks: RoutedWorksetTask[]): string => {
  const prompts = laneTasks.map((task) => compileCodexPrompt(task.task, task.decision, task.executionPlan).trimEnd());
  const lines: string[] = [];
  lines.push(`Lane ${laneId} objective`);
  lines.push('');
  lines.push('Execute the following routed tasks in one bounded worker lane.');
  lines.push('');
  laneTasks.forEach((task) => {
    lines.push(`- ${task.task_id}: ${task.task}`);
  });
  lines.push('');
  lines.push('Task prompts');
  lines.push('');

  prompts.forEach((prompt, index) => {
    if (index > 0) lines.push('');
    lines.push(`--- ${laneTasks[index]?.task_id} ---`);
    lines.push(prompt);
  });

  lines.push('');
  lines.push('Rule / Pattern / Failure Mode');
  lines.push('');
  lines.push('- Rule — Route compilation should become lane compilation before autonomous orchestration.');
  lines.push('- Pattern — Execution plans become much more valuable when grouped into surface-isolated worker lanes.');
  lines.push('- Failure Mode — Jumping from single-task routing straight to autonomous orchestration skips the safety layer that prevents merge chaos.');

  return `${lines.join('\n')}\n`;
};

const riskFromConflictCount = (count: number): 'low' | 'medium' | 'high' => {
  if (count >= 3) return 'high';
  if (count >= 1) return 'medium';
  return 'low';
};

const confidenceForLane = (workerReady: boolean, dependencyLevel: 'low' | 'medium' | 'high', conflictCount: number): number => {
  const base = dependencyLevel === 'low' ? 0.94 : dependencyLevel === 'medium' ? 0.84 : 0.74;
  const workerPenalty = workerReady ? 0 : 0.24;
  const conflictPenalty = Math.min(0.3, conflictCount * 0.08);
  return Number(Math.max(0.1, Math.min(0.99, base - workerPenalty - conflictPenalty)).toFixed(2));
};

const normalizeSurfacePath = (surface: string): string => surface.replace(/\*+$/g, '').replace(/\/+/g, '/').replace(/\/$/, '');

const surfacesOverlap = (left: string, right: string): boolean => {
  if (left === right) return true;
  if (left.length === 0 || right.length === 0) return false;
  return left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
};

export const buildWorksetPlan = (cwd: string, tasks: WorksetTaskInput[], tasksFilePath: string): WorksetPlanArtifact => {
  const orderedTasks = [...tasks].sort(taskSort);
  const routed: RoutedWorksetTask[] = orderedTasks.map((task) => {
    const decision = routeTask(cwd, task.task);
    const executionPlan = buildExecutionPlan({
      task: task.task,
      decision,
      sourceArtifacts: {
        taskExecutionProfile: { available: false, artifactPath: TASK_EXECUTION_PROFILE_PATH },
        learningState: { available: false, artifactPath: LEARNING_STATE_PATH }
      }
    });

    const ambiguous = decision.warnings.some((warning) => warning.includes('ambiguous task family signals'));

    return {
      task_id: task.task_id,
      task: task.task,
      decision,
      executionPlan,
      ambiguous
    };
  });

  const blockedTasks: WorksetPlanArtifact['blocked_tasks'] = [];
  const laneBuckets: RoutedWorksetTask[][] = [];
  const warnings = new Set<string>();

  for (const task of routed) {
    if (task.decision.route === 'unsupported') {
      blockedTasks.push({
        task_id: task.task_id,
        reason: 'unsupported task family',
        warnings: sortUnique(task.executionPlan.warnings),
        missing_prerequisites: sortUnique(task.executionPlan.missing_prerequisites)
      });
      warnings.add(`blocked unsupported task ${task.task_id}; missing prerequisites remain explicit.`);
      continue;
    }

    if (task.ambiguous) {
      blockedTasks.push({
        task_id: task.task_id,
        reason: 'ambiguous task family requires explicit refinement before lane assignment',
        warnings: sortUnique(task.executionPlan.warnings),
        missing_prerequisites: sortUnique(task.executionPlan.missing_prerequisites)
      });
      warnings.add(`blocked ambiguous task ${task.task_id}; conservative fallback prevents unsafe lane assignment.`);
      continue;
    }

    let assigned = false;
    for (const lane of laneBuckets) {
      if (laneCanAcceptTask(lane, task)) {
        lane.push(task);
        assigned = true;
        break;
      }
    }

    if (!assigned) {
      laneBuckets.push([task]);
    }
  }

  const lanes: WorksetLane[] = laneBuckets
    .map((laneTasks, laneIndex): WorksetLane => {
      const lane_id = `lane-${laneIndex + 1}`;
      return {
        lane_id,
        task_ids: laneTasks.map((task) => task.task_id).sort((a, b) => a.localeCompare(b)),
        task_families: sortUnique(laneTasks.map((task) => task.executionPlan.task_family)),
        expected_surfaces: sortUnique(laneTasks.flatMap((task) => task.executionPlan.expected_surfaces)),
        likely_conflict_surfaces: sortUnique(laneTasks.flatMap((task) => task.executionPlan.likely_conflict_surfaces)),
        readiness_status: laneTasks.every((task) => task.executionPlan.worker_ready) ? 'ready' : 'blocked',
        blocking_reasons: laneTasks.every((task) => task.executionPlan.worker_ready) ? [] : ['worker prerequisites are not satisfied'],
        conflict_surface_paths: sortUnique(laneTasks.flatMap((task) => task.executionPlan.likely_conflict_surfaces)),
        shared_artifact_risk: 'low',
        assignment_confidence: 0,
        dependency_level: levelForLane(laneTasks),
        recommended_pr_size: sizeForLane(laneTasks),
        worker_ready: laneTasks.every((task) => task.executionPlan.worker_ready),
        codex_prompt: lanePrompt(lane_id, laneTasks),
        protected_doc_consolidation: computeProtectedDocConsolidationStatus(cwd, lane_id, sortUnique(laneTasks.flatMap((task) => task.executionPlan.expected_surfaces)))
      };
    })
    .sort((left, right) => left.lane_id.localeCompare(right.lane_id));

  const dependency_edges: WorksetPlanArtifact['dependency_edges'] = [];
  const levelBuckets = new Map<'low' | 'medium' | 'high', string[]>();
  for (const lane of lanes) {
    levelBuckets.set(lane.dependency_level, [...(levelBuckets.get(lane.dependency_level) ?? []), lane.lane_id]);
  }

  const low = (levelBuckets.get('low') ?? []).sort((a, b) => a.localeCompare(b));
  const medium = (levelBuckets.get('medium') ?? []).sort((a, b) => a.localeCompare(b));
  const high = (levelBuckets.get('high') ?? []).sort((a, b) => a.localeCompare(b));

  for (const target of medium) {
    for (const source of low) {
      dependency_edges.push({ from_lane_id: source, to_lane_id: target, reason: 'dependency_level sequencing low->medium' });
    }
  }
  for (const target of high) {
    for (const source of [...low, ...medium]) {
      dependency_edges.push({ from_lane_id: source, to_lane_id: target, reason: 'dependency_level sequencing to high-risk lane' });
    }
  }

  const overlapFindings = new Map<string, { lane_ids: string[]; surface_path: string }>();
  const ownershipFindings = new Map<string, { lane_ids: string[]; artifact_path: string }>();
  const blockedLaneDependencies = new Map<string, string[]>();

  for (let leftIndex = 0; leftIndex < lanes.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < lanes.length; rightIndex += 1) {
      const leftLane = lanes[leftIndex];
      const rightLane = lanes[rightIndex];
      if (!leftLane || !rightLane) continue;

      for (const leftSurface of leftLane.expected_surfaces.map(normalizeSurfacePath)) {
        for (const rightSurface of rightLane.expected_surfaces.map(normalizeSurfacePath)) {
          if (!surfacesOverlap(leftSurface, rightSurface)) continue;
          const key = `${leftLane.lane_id}|${rightLane.lane_id}|${leftSurface}|${rightSurface}`;
          overlapFindings.set(key, {
            lane_ids: [leftLane.lane_id, rightLane.lane_id].sort((a, b) => a.localeCompare(b)),
            surface_path: leftSurface.length <= rightSurface.length ? leftSurface : rightSurface
          });
        }
      }

      const leftConflictSet = new Set(leftLane.likely_conflict_surfaces.map(normalizeSurfacePath));
      const rightConflictSet = new Set(rightLane.likely_conflict_surfaces.map(normalizeSurfacePath));
      for (const leftSurface of leftLane.expected_surfaces.map(normalizeSurfacePath)) {
        if (rightConflictSet.has(leftSurface)) {
          const key = `${leftLane.lane_id}|${rightLane.lane_id}|${leftSurface}`;
          ownershipFindings.set(key, {
            lane_ids: [leftLane.lane_id, rightLane.lane_id].sort((a, b) => a.localeCompare(b)),
            artifact_path: leftSurface
          });
        }
      }
      for (const rightSurface of rightLane.expected_surfaces.map(normalizeSurfacePath)) {
        if (leftConflictSet.has(rightSurface)) {
          const key = `${leftLane.lane_id}|${rightLane.lane_id}|${rightSurface}`;
          ownershipFindings.set(key, {
            lane_ids: [leftLane.lane_id, rightLane.lane_id].sort((a, b) => a.localeCompare(b)),
            artifact_path: rightSurface
          });
        }
      }
    }
  }

  const overlapList = [...overlapFindings.values()].sort((left, right) =>
    left.surface_path === right.surface_path
      ? left.lane_ids.join(',').localeCompare(right.lane_ids.join(','))
      : left.surface_path.localeCompare(right.surface_path)
  );
  const ownershipList = [...ownershipFindings.values()].sort((left, right) =>
    left.artifact_path === right.artifact_path
      ? left.lane_ids.join(',').localeCompare(right.lane_ids.join(','))
      : left.artifact_path.localeCompare(right.artifact_path)
  );

  const laneConflictCounts = new Map<string, number>();
  for (const finding of overlapList) {
    for (const laneId of finding.lane_ids) {
      laneConflictCounts.set(laneId, (laneConflictCounts.get(laneId) ?? 0) + 1);
    }
  }
  for (const finding of ownershipList) {
    for (const laneId of finding.lane_ids) {
      laneConflictCounts.set(laneId, (laneConflictCounts.get(laneId) ?? 0) + 1);
    }
  }

  const lanesWithRisk: WorksetLane[] = lanes.map((lane): WorksetLane => {
    const laneOverlaps = overlapList.filter((finding) => finding.lane_ids.includes(lane.lane_id)).map((finding) => finding.surface_path);
    const laneOwnership = ownershipList
      .filter((finding) => finding.lane_ids.includes(lane.lane_id))
      .map((finding) => finding.artifact_path);
    const conflictSurfacePaths = sortUnique([...lane.conflict_surface_paths, ...laneOverlaps, ...laneOwnership]);
    const conflictCount = laneConflictCounts.get(lane.lane_id) ?? 0;
    return {
      ...lane,
      conflict_surface_paths: conflictSurfacePaths,
      shared_artifact_risk: riskFromConflictCount(conflictCount),
      assignment_confidence: confidenceForLane(lane.worker_ready, lane.dependency_level, conflictCount),
      readiness_status: lane.worker_ready ? 'ready' : 'blocked',
      blocking_reasons: lane.worker_ready ? [] : ['worker prerequisites are not satisfied']
    };
  });

  for (const edge of dependency_edges) {
    const sourceLane = lanesWithRisk.find((lane) => lane.lane_id === edge.from_lane_id);
    if (sourceLane?.readiness_status === 'blocked') {
      blockedLaneDependencies.set(edge.to_lane_id, sortUnique([...(blockedLaneDependencies.get(edge.to_lane_id) ?? []), edge.from_lane_id]));
    }
  }

  const merge_risk_notes = sortUnique(
    lanesWithRisk.flatMap((lane) => lane.conflict_surface_paths.map((surface) => `lane ${lane.lane_id} merge risk surface: ${surface}`))
  );

  return {
    schemaVersion: '1.0',
    kind: 'workset-plan',
    generatedAt: new Date(0).toISOString(),
    proposalOnly: true,
    input_tasks: orderedTasks,
    routed_tasks: routed.map((task) => ({
      task_id: task.task_id,
      task: task.task,
      selected_route: task.decision.route,
      task_family: task.executionPlan.task_family,
      expected_surfaces: sortUnique(task.executionPlan.expected_surfaces),
      likely_conflict_surfaces: sortUnique(task.executionPlan.likely_conflict_surfaces),
      dependency_level: task.executionPlan.dependency_level,
      recommended_pr_size: task.executionPlan.recommended_pr_size,
      worker_ready: task.executionPlan.worker_ready,
      warnings: sortUnique(task.executionPlan.warnings),
      missing_prerequisites: sortUnique(task.executionPlan.missing_prerequisites)
    })),
    lanes: lanesWithRisk,
    blocked_tasks: blockedTasks.sort((left, right) => left.task_id.localeCompare(right.task_id)),
    dependency_edges: dependency_edges.sort((left, right) =>
      left.from_lane_id === right.from_lane_id
        ? left.to_lane_id.localeCompare(right.to_lane_id)
        : left.from_lane_id.localeCompare(right.from_lane_id)
    ),
    validation: {
      overlapping_file_domains: overlapList,
      conflicting_artifact_ownership: ownershipList,
      blocked_lane_dependencies: [...blockedLaneDependencies.entries()]
        .map(([lane_id, waiting_on_lane_ids]) => ({ lane_id, waiting_on_lane_ids }))
        .sort((left, right) => left.lane_id.localeCompare(right.lane_id))
    },
    merge_risk_notes,
    sourceArtifacts: {
      tasksFile: { available: true, artifactPath: tasksFilePath },
      taskExecutionProfile: { available: false, artifactPath: TASK_EXECUTION_PROFILE_PATH },
      learningState: { available: false, artifactPath: LEARNING_STATE_PATH }
    },
    warnings: sortUnique([...warnings])
  };
};
