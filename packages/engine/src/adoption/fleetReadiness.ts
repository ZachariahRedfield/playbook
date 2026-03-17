import type { RepoAdoptionReadiness, RepoAdoptionBlocker, ReadinessLifecycleStage } from './readiness.js';

export type FleetRepoReadinessEntry = {
  repo_id: string;
  repo_name: string;
  readiness: RepoAdoptionReadiness;
};

export type FleetPriorityStage =
  | 'repo_not_connected'
  | 'playbook_not_detected'
  | 'index_pending'
  | 'plan_pending'
  | 'apply_pending'
  | 'ready';

export type FleetBlockerFrequency = {
  blocker_code: RepoAdoptionBlocker['code'];
  count: number;
  repo_ids: string[];
};

export type FleetRecommendedAction = {
  command: string;
  count: number;
  repo_ids: string[];
};

export type FleetRepoPriorityEntry = {
  repo_id: string;
  repo_name: string;
  lifecycle_stage: ReadinessLifecycleStage;
  priority_stage: FleetPriorityStage;
  blocker_codes: RepoAdoptionBlocker['code'][];
  next_action: string | null;
};

export type FleetAdoptionReadinessSummary = {
  schemaVersion: '1.0';
  kind: 'fleet-adoption-readiness-summary';
  total_repos: number;
  by_lifecycle_stage: Record<ReadinessLifecycleStage, number>;
  playbook_detected_count: number;
  fallback_proof_ready_count: number;
  cross_repo_eligible_count: number;
  blocker_frequencies: FleetBlockerFrequency[];
  recommended_actions: FleetRecommendedAction[];
  repos_by_priority: FleetRepoPriorityEntry[];
};

const PRIORITY_ORDER: Record<FleetPriorityStage, number> = {
  repo_not_connected: 0,
  playbook_not_detected: 1,
  index_pending: 2,
  plan_pending: 3,
  apply_pending: 4,
  ready: 5
};

const BLOCKER_SEVERITY_ORDER: Record<RepoAdoptionBlocker['code'], number> = {
  repo_not_connected: 0,
  playbook_not_detected: 1,
  index_required: 2,
  plan_required: 3,
  apply_required: 4,
  fallback_proof_prerequisite_missing: 5
};

const toPriorityStage = (readiness: RepoAdoptionReadiness): FleetPriorityStage => {
  if (readiness.connection_status === 'not_connected') {
    return 'repo_not_connected';
  }

  switch (readiness.lifecycle_stage) {
    case 'playbook_not_detected':
      return 'playbook_not_detected';
    case 'playbook_detected_index_pending':
      return 'index_pending';
    case 'indexed_plan_pending':
      return 'plan_pending';
    case 'planned_apply_pending':
      return 'apply_pending';
    case 'not_connected':
      return 'repo_not_connected';
    case 'ready':
    default:
      return 'ready';
  }
};

const highestBlockerSeverity = (blockers: RepoAdoptionBlocker[]): number => {
  if (blockers.length === 0) {
    return Number.MAX_SAFE_INTEGER;
  }

  return blockers
    .map((blocker) => BLOCKER_SEVERITY_ORDER[blocker.code] ?? Number.MAX_SAFE_INTEGER)
    .sort((left, right) => left - right)[0] ?? Number.MAX_SAFE_INTEGER;
};

const emptyLifecycleCounts = (): Record<ReadinessLifecycleStage, number> => ({
  not_connected: 0,
  playbook_not_detected: 0,
  playbook_detected_index_pending: 0,
  indexed_plan_pending: 0,
  planned_apply_pending: 0,
  ready: 0
});

export const buildFleetAdoptionReadinessSummary = (
  repos: FleetRepoReadinessEntry[]
): FleetAdoptionReadinessSummary => {
  const lifecycleCounts = emptyLifecycleCounts();
  const blockerMap = new Map<RepoAdoptionBlocker['code'], Set<string>>();
  const actionMap = new Map<string, Set<string>>();

  let playbookDetectedCount = 0;
  let fallbackProofReadyCount = 0;
  let crossRepoEligibleCount = 0;

  const sortedRepos = [...repos].sort(
    (left, right) => left.repo_id.localeCompare(right.repo_id) || left.repo_name.localeCompare(right.repo_name)
  );

  for (const entry of sortedRepos) {
    const { readiness } = entry;
    lifecycleCounts[readiness.lifecycle_stage] += 1;

    if (readiness.playbook_detected) playbookDetectedCount += 1;
    if (readiness.fallback_proof_ready) fallbackProofReadyCount += 1;
    if (readiness.cross_repo_eligible) crossRepoEligibleCount += 1;

    for (const blocker of readiness.blockers) {
      const current = blockerMap.get(blocker.code) ?? new Set<string>();
      current.add(entry.repo_id);
      blockerMap.set(blocker.code, current);
    }

    for (const action of readiness.recommended_next_steps) {
      const current = actionMap.get(action) ?? new Set<string>();
      current.add(entry.repo_id);
      actionMap.set(action, current);
    }
  }

  const blockerFrequencies: FleetBlockerFrequency[] = [...blockerMap.entries()]
    .map(([blockerCode, repoIds]) => ({
      blocker_code: blockerCode,
      count: repoIds.size,
      repo_ids: [...repoIds].sort((left, right) => left.localeCompare(right))
    }))
    .sort((left, right) => right.count - left.count || left.blocker_code.localeCompare(right.blocker_code));

  const recommendedActions: FleetRecommendedAction[] = [...actionMap.entries()]
    .map(([command, repoIds]) => ({
      command,
      count: repoIds.size,
      repo_ids: [...repoIds].sort((left, right) => left.localeCompare(right))
    }))
    .sort((left, right) => right.count - left.count || left.command.localeCompare(right.command));

  const reposByPriority: FleetRepoPriorityEntry[] = sortedRepos
    .map((entry) => ({
      repo_id: entry.repo_id,
      repo_name: entry.repo_name,
      lifecycle_stage: entry.readiness.lifecycle_stage,
      priority_stage: toPriorityStage(entry.readiness),
      blocker_codes: entry.readiness.blockers.map((blocker) => blocker.code).sort((left, right) => left.localeCompare(right)),
      next_action: entry.readiness.recommended_next_steps[0] ?? null,
      blocker_severity: highestBlockerSeverity(entry.readiness.blockers)
    }))
    .sort(
      (left, right) =>
        PRIORITY_ORDER[left.priority_stage] - PRIORITY_ORDER[right.priority_stage] ||
        left.blocker_severity - right.blocker_severity ||
        left.repo_id.localeCompare(right.repo_id)
    )
    .map(({ blocker_severity: _ignore, ...entry }) => entry);

  return {
    schemaVersion: '1.0',
    kind: 'fleet-adoption-readiness-summary',
    total_repos: repos.length,
    by_lifecycle_stage: lifecycleCounts,
    playbook_detected_count: playbookDetectedCount,
    fallback_proof_ready_count: fallbackProofReadyCount,
    cross_repo_eligible_count: crossRepoEligibleCount,
    blocker_frequencies: blockerFrequencies,
    recommended_actions: recommendedActions,
    repos_by_priority: reposByPriority
  };
};
