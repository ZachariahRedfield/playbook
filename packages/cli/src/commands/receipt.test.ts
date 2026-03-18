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

vi.mock("@zachariahredfield/playbook-engine", () => ({
  buildRepoAdoptionReadiness,
  buildFleetAdoptionReadinessSummary,
  buildFleetAdoptionWorkQueue,
  buildFleetCodexExecutionPlan,
  ingestExecutionResults,
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

    logSpy.mockRestore();
  });
});
