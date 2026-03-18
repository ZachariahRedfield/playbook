import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const loadFleet = vi.fn();

vi.mock("./receiptIngest.js", async () => {
  const actual = await vi.importActual<typeof import("./receiptIngest.js")>("./receiptIngest.js");
  return {
    ...actual,
    loadFleet,
  };
});

const buildFleetAdoptionWorkQueue = vi.fn();
const buildFleetCodexExecutionPlan = vi.fn();
const buildFleetExecutionReceipt = vi.fn();
const buildFleetUpdatedAdoptionState = vi.fn();
const deriveNextAdoptionQueueFromUpdatedState = vi.fn();

vi.mock("@zachariahredfield/playbook-engine", () => ({
  buildFleetAdoptionWorkQueue,
  buildFleetCodexExecutionPlan,
  buildFleetExecutionReceipt,
  buildFleetUpdatedAdoptionState,
  deriveNextAdoptionQueueFromUpdatedState,
}));

const makeTempDir = (): string =>
  fs.mkdtempSync(path.join(os.tmpdir(), "playbook-replay-"));

const outcomeInput = {
  schemaVersion: "1.0",
  kind: "fleet-adoption-execution-outcome-input",
  generated_at: "2026-01-03T00:00:00.000Z",
  session_id: "session-1",
  prompt_outcomes: [],
};

const updatedState = {
  schemaVersion: "1.0",
  kind: "fleet-adoption-updated-state",
  generated_at: "2026-01-03T00:00:00.000Z",
  execution_plan_digest: "digest",
  session_id: "session-1",
  summary: {
    repos_total: 1,
    by_reconciliation_status: {
      completed_as_planned: 1,
      completed_with_drift: 0,
      partial: 0,
      failed: 0,
      blocked: 0,
      not_run: 0,
      stale_plan_or_superseded: 0,
    },
    action_counts: { needs_retry: 0, needs_replan: 0, needs_review: 0 },
    repos_needing_retry: [],
    repos_needing_replan: [],
    repos_needing_review: [],
    stale_or_superseded_repo_ids: [],
    blocked_repo_ids: [],
    completed_repo_ids: ["repo-a"],
  },
  repos: [],
};

const nextQueue = {
  schemaVersion: "1.0",
  kind: "fleet-adoption-work-queue",
  generated_at: "2026-01-03T00:00:00.000Z",
  total_repos: 1,
  queue_source: "updated_state",
  work_items: [],
  waves: [],
  grouped_actions: [],
  blocked_items: [],
};

const receipt = {
  schemaVersion: "1.0",
  kind: "fleet-adoption-execution-receipt",
  generated_at: "2026-01-03T00:00:00.000Z",
  execution_plan_digest: "digest",
  session_id: "session-1",
  wave_results: [],
  prompt_results: [],
  repo_results: [],
  artifact_deltas: [],
  blockers: [],
  verification_summary: {
    prompts_total: 1,
    verification_passed_count: 1,
    succeeded_count: 1,
    failed_count: 0,
    partial_count: 0,
    mismatch_count: 0,
    not_run_count: 0,
    repos_needing_retry: [],
    planned_vs_actual_drift: [],
  },
};

describe("replayExecutionOutcomeInput", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    loadFleet.mockReturnValue({ repos_by_priority: [] });
    buildFleetAdoptionWorkQueue.mockReturnValue({ generated_at: outcomeInput.generated_at });
    buildFleetCodexExecutionPlan.mockReturnValue({ codex_prompts: [], generated_at: outcomeInput.generated_at });
    buildFleetExecutionReceipt.mockReturnValue(receipt);
    buildFleetUpdatedAdoptionState.mockReturnValue(updatedState);
    deriveNextAdoptionQueueFromUpdatedState.mockReturnValue(nextQueue);
  });

  it("classifies replay as completed_as_planned when replay matches committed downstream state", async () => {
    const cwd = makeTempDir();
    fs.mkdirSync(path.join(cwd, ".playbook"), { recursive: true });
    fs.writeFileSync(path.join(cwd, ".playbook", "execution-updated-state.json"), JSON.stringify(updatedState, null, 2));

    const { replayExecutionOutcomeInput } = await import("./replay.js");
    const replayed = replayExecutionOutcomeInput(cwd, outcomeInput);

    expect(replayed.classification).toBe("completed_as_planned");
    expect(replayed.deterministic).toBe(true);
    expect(replayed.evidence.committed_updated_state.matches).toBe(true);
    expect(replayed.summary.changed).toContain("replay reproduced the currently committed downstream state");
  });

  it("classifies replay as mismatch when committed updated-state differs and does not mutate artifacts", async () => {
    const cwd = makeTempDir();
    fs.mkdirSync(path.join(cwd, ".playbook"), { recursive: true });
    const committedPath = path.join(cwd, ".playbook", "execution-updated-state.json");
    fs.writeFileSync(committedPath, JSON.stringify({ ...updatedState, summary: { ...updatedState.summary, completed_repo_ids: [] } }, null, 2));
    const before = fs.readFileSync(committedPath, "utf8");

    const { replayExecutionOutcomeInput } = await import("./replay.js");
    const replayed = replayExecutionOutcomeInput(cwd, outcomeInput);

    expect(replayed.classification).toBe("mismatch");
    expect(replayed.evidence.committed_updated_state.matches).toBe(false);
    expect(fs.readFileSync(committedPath, "utf8")).toBe(before);
  });
});
