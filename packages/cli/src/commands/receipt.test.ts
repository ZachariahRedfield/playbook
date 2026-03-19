import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExitCode } from "../lib/cliContract.js";

const buildRepoAdoptionReadiness = vi.fn();
const buildFleetAdoptionReadinessSummary = vi.fn();
const buildFleetAdoptionWorkQueue = vi.fn();
const buildFleetCodexExecutionPlan = vi.fn();
const ingestExecutionResults = vi.fn();
const loadReplayExecutionOutcomeInput = vi.fn();
const replayExecutionOutcomeInput = vi.fn();

vi.mock("@zachariahredfield/playbook-engine", () => ({
  buildRepoAdoptionReadiness,
  buildFleetAdoptionReadinessSummary,
  buildFleetAdoptionWorkQueue,
  buildFleetCodexExecutionPlan,
  ingestExecutionResults,
}));

vi.mock("./execution/replay.js", () => ({
  loadReplayExecutionOutcomeInput,
  replayExecutionOutcomeInput,
}));

const makeTempDir = (): string =>
  fs.mkdtempSync(path.join(os.tmpdir(), "playbook-receipt-"));

describe("runReceipt", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    buildRepoAdoptionReadiness.mockReturnValue({
      lifecycle_stage: "planned_apply_pending",
    });
    buildFleetAdoptionReadinessSummary.mockReturnValue({ total_repos: 1 });
    buildFleetAdoptionWorkQueue.mockReturnValue({
      generated_at: "2026-01-01T00:00:00.000Z",
    });
    buildFleetCodexExecutionPlan.mockReturnValue({
      generated_at: "2026-01-02T00:00:00.000Z",
    });
    ingestExecutionResults.mockReturnValue({
      execution_outcome_input: {
        schemaVersion: "1.0",
        kind: "fleet-adoption-execution-outcome-input",
        generated_at: "2026-01-03T00:00:00.000Z",
        session_id: "session-1",
        prompt_outcomes: [],
      },
      receipt: {
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
          prompts_total: 0,
          verification_passed_count: 0,
          succeeded_count: 0,
          failed_count: 0,
          partial_count: 0,
          mismatch_count: 0,
          not_run_count: 0,
          repos_needing_retry: [],
          planned_vs_actual_drift: [],
        },
      },
      updated_state: {
        schemaVersion: "1.0",
        kind: "fleet-adoption-updated-state",
        generated_at: "2026-01-03T00:00:00.000Z",
        execution_plan_digest: "digest",
        session_id: "session-1",
        summary: {
          repos_total: 0,
          by_reconciliation_status: {
            completed_as_planned: 0,
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
          completed_repo_ids: [],
        },
        repos: [],
      },
      next_queue: { queue_source: "updated_state", work_items: [] },
      story_transition: null,
    });
    loadReplayExecutionOutcomeInput.mockReturnValue({
      outcomeInput: {
        schemaVersion: "1.0",
        kind: "fleet-adoption-execution-outcome-input",
        generated_at: "2026-01-03T00:00:00.000Z",
        session_id: "session-1",
        prompt_outcomes: [],
      },
      inputArtifactPath: ".playbook/execution-outcome-input.json",
      replayMode: "current",
    });
    replayExecutionOutcomeInput.mockReturnValue({
      schemaVersion: "1.0",
      kind: "fleet-adoption-execution-replay",
      generated_at: "2026-01-03T00:00:00.000Z",
      input_artifact_path: ".playbook/execution-outcome-input.json",
      classification: "completed_as_planned",
      deterministic: true,
      replay_mode: "current",
      receipt: { kind: "fleet-adoption-execution-receipt" },
      updated_state: { kind: "fleet-adoption-updated-state" },
      next_queue: { kind: "fleet-adoption-work-queue", queue_source: "updated_state" },
      evidence: {
        replay_deterministic: true,
        committed_updated_state: { matches: true, compared: true, path: ".playbook/execution-updated-state.json", differences: [] },
        derived_next_queue_from_committed_updated_state: { matches: true, compared: true, path: ".playbook/execution-updated-state.json -> derived next_queue", differences: [] },
        drift_summary: {
          mismatch_count: 0,
          stale_or_superseded_count: 0,
          completed_with_drift_count: 0,
          retry_count: 0,
          review_count: 0,
        },
      },
      summary: {
        what_happened: "Replay reproduced the canonical execution downstream state without drift.",
        matched_plan: true,
        changed: ["replay reproduced the currently committed downstream state"],
        next_steps: ["No action required; replay matched the canonical downstream state."],
      },
    });
  });

  it("writes execution outcome input and returns the control-loop payload", async () => {
    const cwd = makeTempDir();
    fs.writeFileSync(
      path.join(cwd, "results.json"),
      JSON.stringify(
        [
          {
            repo_id: "repo-a",
            prompt_id: "wave_1:apply_lane:repo-a",
            status: "success",
          },
        ],
        null,
        2,
      ),
    );
    const { runReceipt } = await import("./receipt.js");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    const exitCode = await runReceipt(cwd, ["ingest", "results.json"], {
      format: "json",
      quiet: false,
    });

    expect(exitCode).toBe(ExitCode.Success);
    expect(ingestExecutionResults).toHaveBeenCalled();
    expect(
      fs.existsSync(
        path.join(cwd, ".playbook", "execution-outcome-input.json"),
      ),
    ).toBe(true);
    const payload = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0]));
    expect(payload.command).toBe("receipt");
    expect(payload.mode).toBe("ingest");
    expect(payload.written_artifacts.execution_outcome_input).toBe(
      ".playbook/execution-outcome-input.json",
    );
    expect(payload.written_artifacts.execution_receipt).toBe(
      ".playbook/execution-receipt.json",
    );
    expect(payload.story_transition).toBeNull();

    logSpy.mockRestore();
  });

  it("replays the canonical execution outcome input in json mode", async () => {
    const cwd = makeTempDir();
    const { runReceipt } = await import("./receipt.js");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    const exitCode = await runReceipt(cwd, ["replay"], {
      format: "json",
      quiet: false,
    });

    expect(exitCode).toBe(ExitCode.Success);
    expect(loadReplayExecutionOutcomeInput).toHaveBeenCalledWith(cwd, undefined);
    expect(replayExecutionOutcomeInput).toHaveBeenCalled();
    const payload = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0]));
    expect(payload.command).toBe("receipt");
    expect(payload.mode).toBe("replay");
    expect(payload.classification).toBe("completed_as_planned");

    logSpy.mockRestore();
  });
});
