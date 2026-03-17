import type { FleetAdoptionReadinessSummary, FleetPriorityStage, FleetRepoPriorityEntry } from './fleetReadiness.js';
import type { ReadinessLifecycleStage, RepoAdoptionBlocker } from './readiness.js';

export type WorkQueueAction = 'connect' | 'init' | 'index' | 'verify_plan' | 'apply';

export type WorkQueueSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type WorkQueueParallelGroup = 'connect lane' | 'init lane' | 'index lane' | 'verify/plan lane' | 'apply lane';

export type AdoptionWorkItem = {
  item_id: string;
  repo_id: string;
  lifecycle_stage: ReadinessLifecycleStage;
  blocker_codes: RepoAdoptionBlocker['code'][];
  recommended_command: string;
  priority_stage: FleetPriorityStage;
  severity: WorkQueueSeverity;
  parallel_group: WorkQueueParallelGroup;
  dependencies: string[];
  rationale: string;
  wave: 'wave_1' | 'wave_2';
};

export type AdoptionWorkWave = {
  wave: 'wave_1' | 'wave_2';
  item_ids: string[];
  repo_ids: string[];
  action_count: number;
};

export type AdoptionGroupedActionLane = {
  parallel_group: WorkQueueParallelGroup;
  command: string;
  repo_ids: string[];
  item_ids: string[];
};

export type AdoptionBlockedItem = {
  item_id: string;
  repo_id: string;
  unmet_dependencies: string[];
};

export type FleetAdoptionWorkQueue = {
  schemaVersion: '1.0';
  kind: 'fleet-adoption-work-queue';
  generated_at: string;
  total_repos: number;
  work_items: AdoptionWorkItem[];
  waves: AdoptionWorkWave[];
  grouped_actions: AdoptionGroupedActionLane[];
  blocked_items: AdoptionBlockedItem[];
};

const STAGE_ORDER: Record<FleetPriorityStage, number> = {
  repo_not_connected: 0,
  playbook_not_detected: 1,
  index_pending: 2,
  plan_pending: 3,
  apply_pending: 4,
  ready: 5
};

const ACTION_ORDER: Record<WorkQueueAction, number> = {
  connect: 0,
  init: 1,
  index: 2,
  verify_plan: 3,
  apply: 4
};

const COMMAND_BY_ACTION: Record<WorkQueueAction, string> = {
  connect: 'pnpm playbook observer repo add <path>',
  init: 'pnpm playbook init',
  index: 'pnpm playbook index --json',
  verify_plan: 'pnpm playbook verify --json && pnpm playbook plan --json',
  apply: 'pnpm playbook apply --json'
};

const PARALLEL_GROUP_BY_ACTION: Record<WorkQueueAction, WorkQueueParallelGroup> = {
  connect: 'connect lane',
  init: 'init lane',
  index: 'index lane',
  verify_plan: 'verify/plan lane',
  apply: 'apply lane'
};

const SEVERITY_BY_PRIORITY: Record<FleetPriorityStage, WorkQueueSeverity> = {
  repo_not_connected: 'critical',
  playbook_not_detected: 'high',
  index_pending: 'medium',
  plan_pending: 'medium',
  apply_pending: 'low',
  ready: 'info'
};

const toPendingActions = (entry: FleetRepoPriorityEntry): WorkQueueAction[] => {
  switch (entry.priority_stage) {
    case 'repo_not_connected':
      return ['connect', 'init', 'index', 'verify_plan', 'apply'];
    case 'playbook_not_detected':
      return ['init', 'index', 'verify_plan', 'apply'];
    case 'index_pending':
      return ['index', 'verify_plan', 'apply'];
    case 'plan_pending':
      return ['verify_plan', 'apply'];
    case 'apply_pending':
      return ['apply'];
    case 'ready':
    default:
      return [];
  }
};

const rationaleForAction = (action: WorkQueueAction): string => {
  if (action === 'connect') return 'Repository is outside observer-managed fleet context.';
  if (action === 'init') return 'Playbook bootstrap is missing and must be initialized first.';
  if (action === 'index') return 'Repository index is required for deterministic repository intelligence.';
  if (action === 'verify_plan') return 'Governance findings must be converted into a deterministic plan before apply.';
  return 'Apply stage finalizes governed remediation after prior prerequisites are satisfied.';
};

export const buildFleetAdoptionWorkQueue = (
  fleet: FleetAdoptionReadinessSummary,
  options?: { generatedAt?: string }
): FleetAdoptionWorkQueue => {
  const generatedAt = options?.generatedAt ?? new Date().toISOString();
  const workItems: AdoptionWorkItem[] = [];

  const sortedRepos = [...fleet.repos_by_priority].sort(
    (left, right) =>
      STAGE_ORDER[left.priority_stage] - STAGE_ORDER[right.priority_stage] ||
      left.repo_id.localeCompare(right.repo_id)
  );

  for (const repo of sortedRepos) {
    const pendingActions = toPendingActions(repo);
    let previousItemId: string | null = null;

    for (const action of pendingActions) {
      const itemId = `${repo.repo_id}:${action}`;
      const dependencies = previousItemId ? [previousItemId] : [];
      workItems.push({
        item_id: itemId,
        repo_id: repo.repo_id,
        lifecycle_stage: repo.lifecycle_stage,
        blocker_codes: [...repo.blocker_codes],
        recommended_command: COMMAND_BY_ACTION[action],
        priority_stage: repo.priority_stage,
        severity: SEVERITY_BY_PRIORITY[repo.priority_stage],
        parallel_group: PARALLEL_GROUP_BY_ACTION[action],
        dependencies,
        rationale: rationaleForAction(action),
        wave: dependencies.length === 0 ? 'wave_1' : 'wave_2'
      });
      previousItemId = itemId;
    }
  }

  const orderedWorkItems = [...workItems].sort(
    (left, right) =>
      STAGE_ORDER[left.priority_stage] - STAGE_ORDER[right.priority_stage] ||
      ACTION_ORDER[left.item_id.split(':')[1] as WorkQueueAction] - ACTION_ORDER[right.item_id.split(':')[1] as WorkQueueAction] ||
      left.repo_id.localeCompare(right.repo_id)
  );

  const wave1Items = orderedWorkItems.filter((item) => item.wave === 'wave_1');
  const wave2Items = orderedWorkItems.filter((item) => item.wave === 'wave_2');

  const groupedMap = new Map<string, { command: string; itemIds: Set<string>; repoIds: Set<string>; group: WorkQueueParallelGroup }>();
  for (const item of orderedWorkItems) {
    const key = `${item.parallel_group}::${item.recommended_command}`;
    const current = groupedMap.get(key) ?? {
      command: item.recommended_command,
      itemIds: new Set<string>(),
      repoIds: new Set<string>(),
      group: item.parallel_group
    };
    current.itemIds.add(item.item_id);
    current.repoIds.add(item.repo_id);
    groupedMap.set(key, current);
  }

  const groupedActions: AdoptionGroupedActionLane[] = [...groupedMap.values()]
    .map((entry) => ({
      parallel_group: entry.group,
      command: entry.command,
      item_ids: [...entry.itemIds].sort((left, right) => left.localeCompare(right)),
      repo_ids: [...entry.repoIds].sort((left, right) => left.localeCompare(right))
    }))
    .sort((left, right) => left.parallel_group.localeCompare(right.parallel_group) || left.command.localeCompare(right.command));

  return {
    schemaVersion: '1.0',
    kind: 'fleet-adoption-work-queue',
    generated_at: generatedAt,
    total_repos: fleet.total_repos,
    work_items: orderedWorkItems,
    waves: [
      {
        wave: 'wave_1',
        item_ids: wave1Items.map((item) => item.item_id),
        repo_ids: Array.from(new Set(wave1Items.map((item) => item.repo_id))).sort((left, right) => left.localeCompare(right)),
        action_count: wave1Items.length
      },
      {
        wave: 'wave_2',
        item_ids: wave2Items.map((item) => item.item_id),
        repo_ids: Array.from(new Set(wave2Items.map((item) => item.repo_id))).sort((left, right) => left.localeCompare(right)),
        action_count: wave2Items.length
      }
    ],
    grouped_actions: groupedActions,
    blocked_items: orderedWorkItems
      .filter((item) => item.dependencies.length > 0)
      .map((item) => ({ item_id: item.item_id, repo_id: item.repo_id, unmet_dependencies: [...item.dependencies] }))
  };
};
