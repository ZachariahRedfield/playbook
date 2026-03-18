import { describe, expect, it } from "vitest";
import { buildFleetAdoptionWorkQueue } from "./workQueue.js";
import { buildFleetCodexExecutionPlan } from "./executionPlan.js";
import {
  buildFleetExecutionReceipt,
  type FleetExecutionOutcomeInput,
} from "./executionReceipt.js";
import { buildFleetUpdatedAdoptionState } from "./executionUpdatedState.js";
import type { FleetAdoptionReadinessSummary } from "./fleetReadiness.js";

const makeFleet = (): FleetAdoptionReadinessSummary => ({
  schemaVersion: "1.0",
  kind: "fleet-adoption-readiness-summary",
  total_repos: 3,
  by_lifecycle_stage: {
    not_connected: 0,
    playbook_not_detected: 0,
    playbook_detected_index_pending: 0,
    indexed_plan_pending: 0,
    planned_apply_pending: 3,
    ready: 0,
  },
  playbook_detected_count: 3,
  fallback_proof_ready_count: 3,
  cross_repo_eligible_count: 3,
  blocker_frequencies: [],
  recommended_actions: [],
  repos_by_priority: [
    {
      repo_id: "repo-a",
      lifecycle_stage: "planned_apply_pending",
      priority_stage: "apply_pending",
      blocker_codes: [],
      next_action: "pnpm playbook apply --json",
      blocker_severity: null,
    },
    {
      repo_id: "repo-b",
      lifecycle_stage: "planned_apply_pending",
      priority_stage: "apply_pending",
      blocker_codes: [],
      next_action: "pnpm playbook apply --json",
      blocker_severity: null,
    },
    {
      repo_id: "repo-c",
      lifecycle_stage: "planned_apply_pending",
      priority_stage: "apply_pending",
      blocker_codes: [],
      next_action: "pnpm playbook apply --json",
      blocker_severity: null,
    },
  ],
});

const outcome = (
  entries: FleetExecutionOutcomeInput["prompt_outcomes"],
): FleetExecutionOutcomeInput => ({
  schemaVersion: "1.0",
  kind: "fleet-adoption-execution-outcome-input",
  generated_at: "2026-01-03T00:00:00.000Z",
  session_id: "session-1",
  prompt_outcomes: entries,
});

describe("buildFleetUpdatedAdoptionState", () => {
  it("marks exact-match completions as completed_as_planned with no follow-up action", () => {
    const fleet = makeFleet();
    fleet.repos_by_priority = [fleet.repos_by_priority[0]!];
    fleet.total_repos = 1;
    fleet.by_lifecycle_stage.planned_apply_pending = 1;
    const queue = buildFleetAdoptionWorkQueue(fleet, {
      generatedAt: "2026-01-01T00:00:00.000Z",
    });
    const plan = buildFleetCodexExecutionPlan(queue, {
      generatedAt: "2026-01-02T00:00:00.000Z",
    });
    const prompt = plan.codex_prompts[0]!;
    const readyFleet = makeFleet();
    readyFleet.repos_by_priority = [
      {
        ...readyFleet.repos_by_priority[0]!,
        repo_id: "repo-a",
        lifecycle_stage: "ready",
        priority_stage: "ready",
        next_action: null,
      },
    ];
    readyFleet.total_repos = 1;
    readyFleet.by_lifecycle_stage.planned_apply_pending = 0;
    readyFleet.by_lifecycle_stage.ready = 1;
    const receipt = buildFleetExecutionReceipt(
      plan,
      queue,
      readyFleet,
      outcome([
        {
          prompt_id: prompt.prompt_id,
          repo_id: prompt.repo_id,
          lane_id: prompt.lane_id,
          status: "succeeded",
          verification_passed: true,
        },
      ]),
    );

    const updated = buildFleetUpdatedAdoptionState(
      plan,
      queue,
      readyFleet,
      receipt,
      { generatedAt: "2026-01-04T00:00:00.000Z" },
    );

    expect(updated.repos[0]?.reconciliation_status).toBe(
      "completed_as_planned",
    );
    expect(updated.repos[0]?.action_state).toEqual({
      needs_retry: false,
      needs_replan: false,
      needs_review: false,
    });
    expect(updated.summary.completed_repo_ids).toEqual(["repo-a"]);
    expect(updated.summary.action_counts).toEqual({
      needs_retry: 0,
      needs_replan: 0,
      needs_review: 0,
    });
  });

  it("separates blocked outcome from retry follow-up action", () => {
    const fleet = makeFleet();
    fleet.repos_by_priority = [fleet.repos_by_priority[0]!];
    fleet.total_repos = 1;
    fleet.by_lifecycle_stage.planned_apply_pending = 1;
    const queue = buildFleetAdoptionWorkQueue(fleet, {
      generatedAt: "2026-01-01T00:00:00.000Z",
    });
    const plan = buildFleetCodexExecutionPlan(queue, {
      generatedAt: "2026-01-02T00:00:00.000Z",
    });
    const prompt = plan.codex_prompts[0]!;
    const blockedFleet = makeFleet();
    blockedFleet.repos_by_priority = [blockedFleet.repos_by_priority[0]!];
    blockedFleet.total_repos = 1;
    const receipt = buildFleetExecutionReceipt(
      plan,
      queue,
      blockedFleet,
      outcome([
        {
          prompt_id: prompt.prompt_id,
          repo_id: prompt.repo_id,
          lane_id: prompt.lane_id,
          status: "failed",
          verification_passed: false,
          blockers: [
            {
              blocker_code: "manual_followup",
              message: "manual intervention required",
            },
          ],
        },
      ]),
    );

    const updated = buildFleetUpdatedAdoptionState(
      plan,
      queue,
      blockedFleet,
      receipt,
    );

    expect(updated.repos[0]?.reconciliation_status).toBe("blocked");
    expect(updated.repos[0]?.action_state).toEqual({
      needs_retry: false,
      needs_replan: false,
      needs_review: true,
    });
    expect(updated.summary.by_reconciliation_status.blocked).toBe(1);
    expect(updated.summary.action_counts.needs_retry).toBe(0);
  });

  it("marks partial and failed outcomes as observed classes with retry follow-up separated in action_state", () => {
    const fleet = makeFleet();
    const queue = buildFleetAdoptionWorkQueue(fleet, {
      generatedAt: "2026-01-01T00:00:00.000Z",
    });
    const plan = buildFleetCodexExecutionPlan(queue, {
      generatedAt: "2026-01-02T00:00:00.000Z",
    });
    const prompts = Object.fromEntries(
      plan.codex_prompts.map((prompt) => [prompt.repo_id, prompt]),
    );
    const reconciledFleet = makeFleet();
    const receipt = buildFleetExecutionReceipt(
      plan,
      queue,
      reconciledFleet,
      outcome([
        {
          prompt_id: prompts["repo-a"]!.prompt_id,
          repo_id: "repo-a",
          lane_id: prompts["repo-a"]!.lane_id,
          status: "partial",
          verification_passed: false,
        },
        {
          prompt_id: prompts["repo-b"]!.prompt_id,
          repo_id: "repo-b",
          lane_id: prompts["repo-b"]!.lane_id,
          status: "failed",
          verification_passed: false,
        },
        {
          prompt_id: prompts["repo-c"]!.prompt_id,
          repo_id: "repo-c",
          lane_id: prompts["repo-c"]!.lane_id,
          status: "not_run",
          verification_passed: false,
        },
      ]),
    );

    const updated = buildFleetUpdatedAdoptionState(
      plan,
      queue,
      reconciledFleet,
      receipt,
    );
    const byRepo = Object.fromEntries(
      updated.repos.map((repo) => [repo.repo_id, repo]),
    );

    expect(byRepo["repo-a"]?.reconciliation_status).toBe("partial");
    expect(byRepo["repo-a"]?.action_state).toEqual({
      needs_retry: true,
      needs_replan: false,
      needs_review: false,
    });
    expect(byRepo["repo-b"]?.reconciliation_status).toBe("failed");
    expect(byRepo["repo-b"]?.action_state).toEqual({
      needs_retry: true,
      needs_replan: false,
      needs_review: false,
    });
    expect(byRepo["repo-c"]?.reconciliation_status).toBe("not_run");
    expect(byRepo["repo-c"]?.action_state).toEqual({
      needs_retry: true,
      needs_replan: false,
      needs_review: false,
    });
    expect(updated.summary.by_reconciliation_status.partial).toBe(1);
    expect(updated.summary.by_reconciliation_status.failed).toBe(1);
    expect(updated.summary.action_counts.needs_retry).toBe(3);
    expect(updated.summary.repos_needing_retry).toEqual([
      "repo-a",
      "repo-b",
      "repo-c",
    ]);
  });

  it("marks stale_plan_or_superseded separately from replan and review follow-up", () => {
    const fleet = makeFleet();
    fleet.repos_by_priority = [fleet.repos_by_priority[0]!];
    fleet.total_repos = 1;
    fleet.by_lifecycle_stage.planned_apply_pending = 1;
    const queue = buildFleetAdoptionWorkQueue(fleet, {
      generatedAt: "2026-01-01T00:00:00.000Z",
    });
    const plan = buildFleetCodexExecutionPlan(queue, {
      generatedAt: "2026-01-02T00:00:00.000Z",
    });
    const prompt = plan.codex_prompts[0]!;
    const staleFleet = makeFleet();
    staleFleet.repos_by_priority = [
      {
        ...staleFleet.repos_by_priority[0]!,
        repo_id: "repo-a",
        lifecycle_stage: "planned_apply_pending",
        priority_stage: "apply_pending",
        next_action: "pnpm playbook apply --json",
      },
    ];
    staleFleet.total_repos = 1;
    const receipt = buildFleetExecutionReceipt(
      plan,
      queue,
      staleFleet,
      outcome([
        {
          prompt_id: prompt.prompt_id,
          repo_id: "repo-a",
          lane_id: prompt.lane_id,
          status: "succeeded",
          verification_passed: true,
          observed_transition: {
            from: "planned_apply_pending",
            to: "planned_apply_pending",
          },
          notes: "superseded by newer plan",
        },
      ]),
    );

    const updated = buildFleetUpdatedAdoptionState(
      plan,
      queue,
      staleFleet,
      receipt,
    );

    expect(updated.repos[0]?.reconciliation_status).toBe(
      "stale_plan_or_superseded",
    );
    expect(updated.repos[0]?.action_state).toEqual({
      needs_retry: false,
      needs_replan: true,
      needs_review: true,
    });
    expect(updated.summary.stale_or_superseded_repo_ids).toEqual(["repo-a"]);
    expect(updated.summary.repos_needing_replan).toEqual(["repo-a"]);
  });

  it("classifies successful planned-vs-actual drift as completed_with_drift and review-only follow-up", () => {
    const fleet = makeFleet();
    fleet.repos_by_priority = [fleet.repos_by_priority[0]!];
    fleet.total_repos = 1;
    fleet.by_lifecycle_stage.planned_apply_pending = 1;
    const queue = buildFleetAdoptionWorkQueue(fleet, {
      generatedAt: "2026-01-01T00:00:00.000Z",
    });
    const plan = buildFleetCodexExecutionPlan(queue, {
      generatedAt: "2026-01-02T00:00:00.000Z",
    });
    const prompt = plan.codex_prompts[0]!;
    const driftFleet = makeFleet();
    driftFleet.repos_by_priority = [
      {
        ...driftFleet.repos_by_priority[0]!,
        repo_id: "repo-a",
        lifecycle_stage: "indexed_plan_pending",
        priority_stage: "plan_pending",
        next_action: "pnpm playbook verify --json && pnpm playbook plan --json",
      },
    ];
    driftFleet.total_repos = 1;
    driftFleet.by_lifecycle_stage.planned_apply_pending = 0;
    driftFleet.by_lifecycle_stage.indexed_plan_pending = 1;
    const receipt = buildFleetExecutionReceipt(
      plan,
      queue,
      driftFleet,
      outcome([
        {
          prompt_id: prompt.prompt_id,
          repo_id: "repo-a",
          lane_id: prompt.lane_id,
          status: "succeeded",
          verification_passed: true,
          observed_transition: {
            from: "planned_apply_pending",
            to: "indexed_plan_pending",
          },
          notes: "drifted back to planning stage",
        },
      ]),
    );

    const updated = buildFleetUpdatedAdoptionState(
      plan,
      queue,
      driftFleet,
      receipt,
    );

    expect(updated.repos[0]?.reconciliation_status).toBe(
      "completed_with_drift",
    );
    expect(updated.repos[0]?.action_state).toEqual({
      needs_retry: false,
      needs_replan: false,
      needs_review: true,
    });
    expect(updated.summary.by_reconciliation_status.completed_with_drift).toBe(
      1,
    );
    expect(updated.summary.action_counts).toEqual({
      needs_retry: 0,
      needs_replan: 0,
      needs_review: 1,
    });
  });
});
