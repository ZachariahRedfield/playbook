import { describe, expect, it } from 'vitest';
import { buildFleetAdoptionWorkQueue } from './workQueue.js';
import type { FleetAdoptionReadinessSummary } from './fleetReadiness.js';

const makeFleet = (): FleetAdoptionReadinessSummary => ({
  schemaVersion: '1.0',
  kind: 'fleet-adoption-readiness-summary',
  total_repos: 5,
  by_lifecycle_stage: {
    not_connected: 0,
    playbook_not_detected: 1,
    playbook_detected_index_pending: 1,
    indexed_plan_pending: 1,
    planned_apply_pending: 1,
    ready: 1
  },
  playbook_detected_count: 4,
  fallback_proof_ready_count: 2,
  cross_repo_eligible_count: 4,
  blocker_frequencies: [],
  recommended_actions: [],
  repos_by_priority: [
    { repo_id: 'repo-a', repo_name: 'Repo A', lifecycle_stage: 'playbook_not_detected', priority_stage: 'playbook_not_detected', blocker_codes: ['playbook_not_detected'], next_action: 'pnpm playbook init' },
    { repo_id: 'repo-b', repo_name: 'Repo B', lifecycle_stage: 'playbook_detected_index_pending', priority_stage: 'index_pending', blocker_codes: ['index_required'], next_action: 'pnpm playbook index --json' },
    { repo_id: 'repo-c', repo_name: 'Repo C', lifecycle_stage: 'indexed_plan_pending', priority_stage: 'plan_pending', blocker_codes: ['plan_required'], next_action: 'pnpm playbook verify --json && pnpm playbook plan --json' },
    { repo_id: 'repo-d', repo_name: 'Repo D', lifecycle_stage: 'planned_apply_pending', priority_stage: 'apply_pending', blocker_codes: ['apply_required'], next_action: 'pnpm playbook apply --json' },
    { repo_id: 'repo-e', repo_name: 'Repo E', lifecycle_stage: 'ready', priority_stage: 'ready', blocker_codes: [], next_action: null }
  ]
});

describe('buildFleetAdoptionWorkQueue', () => {
  it('generates deterministic work items and stable ordering', () => {
    const fleet = makeFleet();
    const first = buildFleetAdoptionWorkQueue(fleet, { generatedAt: '2026-01-01T00:00:00.000Z' });
    const second = buildFleetAdoptionWorkQueue(fleet, { generatedAt: '2026-01-01T00:00:00.000Z' });

    expect(first).toEqual(second);
    expect(first.kind).toBe('fleet-adoption-work-queue');
    expect(first.work_items[0]?.item_id).toBe('repo-a:init');
  });

  it('assigns wave_1 to dependency-free items and wave_2 to dependent items', () => {
    const queue = buildFleetAdoptionWorkQueue(makeFleet(), { generatedAt: '2026-01-01T00:00:00.000Z' });

    const repoAInit = queue.work_items.find((item) => item.item_id === 'repo-a:init');
    const repoAIndex = queue.work_items.find((item) => item.item_id === 'repo-a:index');

    expect(repoAInit?.wave).toBe('wave_1');
    expect(repoAInit?.dependencies).toEqual([]);
    expect(repoAIndex?.wave).toBe('wave_2');
    expect(repoAIndex?.dependencies).toEqual(['repo-a:init']);
  });

  it('keeps grouped action lanes stable and parallel-safe', () => {
    const queue = buildFleetAdoptionWorkQueue(makeFleet(), { generatedAt: '2026-01-01T00:00:00.000Z' });
    const indexLane = queue.grouped_actions.find((lane) => lane.parallel_group === 'index lane');

    expect(indexLane?.command).toBe('pnpm playbook index --json');
    expect(indexLane?.repo_ids).toEqual(['repo-a', 'repo-b']);
  });

  it('tracks blocked items with unmet dependencies and stable JSON shape', () => {
    const queue = buildFleetAdoptionWorkQueue(makeFleet(), { generatedAt: '2026-01-01T00:00:00.000Z' });

    expect(Array.isArray(queue.blocked_items)).toBe(true);
    expect(queue.blocked_items.some((item) => item.unmet_dependencies.length > 0)).toBe(true);
    expect(queue).toMatchObject({
      schemaVersion: '1.0',
      kind: 'fleet-adoption-work-queue',
      total_repos: 5
    });
  });
});
