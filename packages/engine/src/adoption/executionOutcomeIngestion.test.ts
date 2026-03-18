import { describe, expect, it } from "vitest";
import { buildFleetAdoptionWorkQueue } from "./workQueue.js";
import { buildFleetCodexExecutionPlan } from "./executionPlan.js";
import { ingestExecutionResults } from "./executionOutcomeIngestion.js";
import type { FleetAdoptionReadinessSummary } from "./fleetReadiness.js";

const makeFleet = (): FleetAdoptionReadinessSummary => ({
  schemaVersion: "1.0",
  kind: "fleet-adoption-readiness-summary",
  total_repos: 2,
  by_lifecycle_stage: {
    not_connected: 0,
    playbook_not_detected: 0,
    playbook_detected_index_pending: 0,
    indexed_plan_pending: 1,
    planned_apply_pending: 1,
    ready: 0,
  },
  playbook_detected_count: 2,
  fallback_proof_ready_count: 2,
  cross_repo_eligible_count: 2,
  blocker_frequencies: [],
  recommended_actions: [],
  repos_by_priority: [
    {
      repo_id: "repo-a",
      repo_name: "Repo A",
      lifecycle_stage: "indexed_plan_pending",
      priority_stage: "plan_pending",
      blocker_codes: ["plan_required"],
      next_action: "pnpm playbook verify --json && pnpm playbook plan --json",
    },
    {
      repo_id: "repo-b",
      repo_name: "Repo B",
      lifecycle_stage: "planned_apply_pending",
      priority_stage: "apply_pending",
      blocker_codes: ["apply_required"],
      next_action: "pnpm playbook apply --json",
    },
  ],
});

describe("ingestExecutionResults", () => {
  it("converts deterministic execution results into receipt, updated-state, and next-queue without rereading repo outcomes", () => {
    const fleet = makeFleet();
    const queue = buildFleetAdoptionWorkQueue(fleet, {
      generatedAt: "2026-01-01T00:00:00.000Z",
    });
    const plan = buildFleetCodexExecutionPlan(queue, {
      generatedAt: "2026-01-02T00:00:00.000Z",
    });
    const promptA = plan.codex_prompts.find(
      (entry) => entry.repo_id === "repo-a",
    );
    const promptB = plan.codex_prompts.find(
      (entry) => entry.repo_id === "repo-b",
    );

    const result = ingestExecutionResults(
      fleet,
      queue,
      plan,
      [
        {
          repo_id: "repo-b",
          prompt_id: promptB!.prompt_id,
          status: "success",
          observed_transition: { from: "planned_apply_pending", to: "ready" },
        },
        {
          repo_id: "repo-a",
          prompt_id: promptA!.prompt_id,
          status: "failed",
          observed_transition: {
            from: "indexed_plan_pending",
            to: "indexed_plan_pending",
          },
          error: "verify stayed red",
        },
      ],
      { generatedAt: "2026-01-03T00:00:00.000Z", sessionId: "session-123" },
    );

    expect(
      result.execution_outcome_input.prompt_outcomes.map(
        (entry) => entry.prompt_id,
      ),
    ).toEqual([promptA!.prompt_id, promptB!.prompt_id]);
    expect(
      result.receipt.repo_results.find((entry) => entry.repo_id === "repo-a"),
    ).toMatchObject({ status: "failed", retry_recommended: true });
    expect(
      result.receipt.repo_results.find((entry) => entry.repo_id === "repo-b"),
    ).toMatchObject({
      status: "success",
      observed_transition: { to: "ready", from: "planned_apply_pending" },
    });
    expect(result.updated_state.summary.repos_needing_retry).toEqual([
      "repo-a",
    ]);
    expect(result.next_queue.queue_source).toBe("updated_state");
    expect(result.next_queue.work_items.map((entry) => entry.repo_id)).toEqual([
      "repo-a",
    ]);
  });
});
