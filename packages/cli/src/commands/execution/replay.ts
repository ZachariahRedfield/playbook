import fs from "node:fs";
import path from "node:path";
import {
  buildFleetAdoptionWorkQueue,
  buildFleetCodexExecutionPlan,
  buildFleetExecutionReceipt,
  buildFleetUpdatedAdoptionState,
  deriveNextAdoptionQueueFromUpdatedState,
  type FleetAdoptionWorkQueue,
  type FleetExecutionOutcomeInput,
  type FleetExecutionReceipt,
  type FleetUpdatedAdoptionState,
} from "@zachariahredfield/playbook-engine";
import { loadFleet } from "./receiptIngest.js";
import { EXECUTION_OUTCOME_INPUT_RELATIVE_PATH, UPDATED_STATE_RELATIVE_PATH } from "./receiptIngest.js";

export type ReplayClassification =
  | "completed_as_planned"
  | "completed_with_drift"
  | "mismatch"
  | "stale_plan_or_superseded";

export type ReplayArtifactComparison = {
  matches: boolean;
  compared: boolean;
  path: string | null;
  differences: string[];
};

export type ExecutionReplayResult = {
  schemaVersion: "1.0";
  kind: "fleet-adoption-execution-replay";
  generated_at: string;
  input_artifact_path: string;
  classification: ReplayClassification;
  deterministic: boolean;
  replay_mode: "current" | "selected";
  receipt: FleetExecutionReceipt;
  updated_state: FleetUpdatedAdoptionState;
  next_queue: FleetAdoptionWorkQueue;
  evidence: {
    replay_deterministic: boolean;
    committed_updated_state: ReplayArtifactComparison;
    derived_next_queue_from_committed_updated_state: ReplayArtifactComparison;
    drift_summary: {
      mismatch_count: number;
      stale_or_superseded_count: number;
      completed_with_drift_count: number;
      retry_count: number;
      review_count: number;
    };
  };
  summary: {
    what_happened: string;
    matched_plan: boolean;
    changed: string[];
    next_steps: string[];
  };
};

const stableStringify = (value: unknown): string => JSON.stringify(value, null, 2);

const normalizeForComparison = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map((entry) => normalizeForComparison(entry));
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  const normalized: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(record)) {
    if (key === "generated_at") continue;
    normalized[key] = normalizeForComparison(entry);
  }
  return normalized;
};

const readJsonIfExists = (absolutePath: string): unknown | null => {
  if (!fs.existsSync(absolutePath)) return null;
  return JSON.parse(fs.readFileSync(absolutePath, "utf8")) as unknown;
};

const compareArtifacts = (current: unknown, baseline: unknown, pathLabel: string | null): ReplayArtifactComparison => {
  if (baseline === null || baseline === undefined) {
    return { matches: false, compared: false, path: pathLabel, differences: ["baseline artifact missing"] };
  }
  const currentText = stableStringify(normalizeForComparison(current));
  const baselineText = stableStringify(normalizeForComparison(baseline));
  return {
    matches: currentText === baselineText,
    compared: true,
    path: pathLabel,
    differences: currentText === baselineText ? [] : ["artifact payload differs from replay output"],
  };
};

export const parseExecutionOutcomeInputArtifact = (raw: string): FleetExecutionOutcomeInput => {
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object") throw new Error("execution outcome input must be a JSON object");
  const value = parsed as Record<string, unknown>;
  if (value.kind !== "fleet-adoption-execution-outcome-input") throw new Error("execution outcome input kind must be fleet-adoption-execution-outcome-input");
  if (!Array.isArray(value.prompt_outcomes)) throw new Error("execution outcome input prompt_outcomes must be an array");
  if (typeof value.generated_at !== "string" || value.generated_at.length === 0) throw new Error("execution outcome input generated_at must be a string");
  if (typeof value.session_id !== "string" || value.session_id.length === 0) throw new Error("execution outcome input session_id must be a string");
  return value as unknown as FleetExecutionOutcomeInput;
};

export const replayExecutionOutcomeInput = (
  cwd: string,
  outcomeInput: FleetExecutionOutcomeInput,
  options?: { inputArtifactPath?: string; replayMode?: "current" | "selected" },
): ExecutionReplayResult => {
  const fleet = loadFleet(cwd);
  const queue = buildFleetAdoptionWorkQueue(fleet, { generatedAt: outcomeInput.generated_at });
  const executionPlan = buildFleetCodexExecutionPlan(queue, { generatedAt: outcomeInput.generated_at });

  const replayReceipt = buildFleetExecutionReceipt(executionPlan, queue, fleet, outcomeInput, {
    generatedAt: outcomeInput.generated_at,
  });
  const replayUpdatedState = buildFleetUpdatedAdoptionState(executionPlan, queue, fleet, replayReceipt, {
    generatedAt: outcomeInput.generated_at,
  });
  const replayNextQueue = deriveNextAdoptionQueueFromUpdatedState(replayUpdatedState, {
    generatedAt: outcomeInput.generated_at,
  });

  const secondReceipt = buildFleetExecutionReceipt(executionPlan, queue, fleet, outcomeInput, {
    generatedAt: outcomeInput.generated_at,
  });
  const secondUpdatedState = buildFleetUpdatedAdoptionState(executionPlan, queue, fleet, secondReceipt, {
    generatedAt: outcomeInput.generated_at,
  });
  const secondNextQueue = deriveNextAdoptionQueueFromUpdatedState(secondUpdatedState, {
    generatedAt: outcomeInput.generated_at,
  });

  const deterministic =
    stableStringify(replayReceipt) === stableStringify(secondReceipt) &&
    stableStringify(replayUpdatedState) === stableStringify(secondUpdatedState) &&
    stableStringify(replayNextQueue) === stableStringify(secondNextQueue);

  const committedUpdatedStatePath = path.join(cwd, UPDATED_STATE_RELATIVE_PATH);
  const committedUpdatedState = readJsonIfExists(committedUpdatedStatePath);
  const committedUpdatedStateComparison = compareArtifacts(
    replayUpdatedState,
    committedUpdatedState,
    fs.existsSync(committedUpdatedStatePath) ? UPDATED_STATE_RELATIVE_PATH : null,
  );
  const committedNextQueueComparison = compareArtifacts(
    replayNextQueue,
    committedUpdatedState
      ? deriveNextAdoptionQueueFromUpdatedState(committedUpdatedState as FleetUpdatedAdoptionState, {
          generatedAt: outcomeInput.generated_at,
        })
      : null,
    fs.existsSync(committedUpdatedStatePath) ? `${UPDATED_STATE_RELATIVE_PATH} -> derived next_queue` : null,
  );

  const byStatus = replayUpdatedState.summary.by_reconciliation_status;
  const mismatchLikeCount =
    replayReceipt.verification_summary.failed_count +
    replayReceipt.verification_summary.partial_count +
    replayReceipt.verification_summary.not_run_count;
  const staleCount = byStatus.stale_plan_or_superseded;
  const driftCount = byStatus.completed_with_drift;

  let classification: ReplayClassification;
  if (!deterministic || !committedUpdatedStateComparison.matches || !committedNextQueueComparison.matches) {
    classification = "mismatch";
  } else if (staleCount > 0) {
    classification = "stale_plan_or_superseded";
  } else if (driftCount > 0 || replayReceipt.verification_summary.mismatch_count > 0 || mismatchLikeCount > 0) {
    classification = "completed_with_drift";
  } else {
    classification = "completed_as_planned";
  }

  const changed: string[] = [];
  if (!committedUpdatedStateComparison.matches) changed.push("updated-state differs from committed canonical artifact");
  if (!committedNextQueueComparison.matches) changed.push("next-queue derived from committed updated-state differs from replay output");
  if (replayReceipt.verification_summary.planned_vs_actual_drift.length > 0) changed.push("planned-vs-actual lifecycle drift was observed in the receipt");
  if (mismatchLikeCount > 0) changed.push("one or more prompts failed, only partially completed, or did not run");
  if (staleCount > 0) changed.push("one or more repos are now classified as stale or superseded");
  if (changed.length === 0) changed.push("replay reproduced the currently committed downstream state");

  const nextSteps = classification === "completed_as_planned"
    ? ["No action required; replay matched the canonical downstream state."]
    : classification === "stale_plan_or_superseded"
      ? ["Run `pnpm playbook verify --json && pnpm playbook plan --json` to generate a fresh deterministic plan."]
      : classification === "completed_with_drift"
        ? ["Review drifted repos before retrying; completed_with_drift is review-first rather than auto-retry.", "Inspect `receipt.verification_summary.planned_vs_actual_drift` and `updated_state.repos[]`. "]
        : ["Inspect committed `.playbook/execution-updated-state.json` and replay output side by side.", "Re-run `pnpm playbook receipt ingest <results.json> --json` only if the committed control-loop artifacts are intentionally being refreshed."];

  return {
    schemaVersion: "1.0",
    kind: "fleet-adoption-execution-replay",
    generated_at: outcomeInput.generated_at,
    input_artifact_path: options?.inputArtifactPath ?? EXECUTION_OUTCOME_INPUT_RELATIVE_PATH,
    classification,
    deterministic,
    replay_mode: options?.replayMode ?? "current",
    receipt: replayReceipt,
    updated_state: replayUpdatedState,
    next_queue: replayNextQueue,
    evidence: {
      replay_deterministic: deterministic,
      committed_updated_state: committedUpdatedStateComparison,
      derived_next_queue_from_committed_updated_state: committedNextQueueComparison,
      drift_summary: {
        mismatch_count: replayReceipt.verification_summary.mismatch_count + mismatchLikeCount,
        stale_or_superseded_count: staleCount,
        completed_with_drift_count: driftCount,
        retry_count: replayUpdatedState.summary.action_counts.needs_retry,
        review_count: replayUpdatedState.summary.action_counts.needs_review,
      },
    },
    summary: {
      what_happened:
        classification === "completed_as_planned"
          ? "Replay reproduced the canonical execution downstream state without drift."
          : classification === "stale_plan_or_superseded"
            ? "Replay shows the ingested outcome now maps to stale or superseded plan state."
            : classification === "completed_with_drift"
              ? "Replay completed deterministically but surfaced execution drift or non-terminal execution variance."
              : "Replay did not match the currently committed downstream state.",
      matched_plan: classification === "completed_as_planned",
      changed,
      next_steps: nextSteps,
    },
  };
};

export const loadReplayExecutionOutcomeInput = (
  cwd: string,
  inputPath?: string,
): { outcomeInput: FleetExecutionOutcomeInput; inputArtifactPath: string; replayMode: "current" | "selected" } => {
  const artifactPath = inputPath ?? EXECUTION_OUTCOME_INPUT_RELATIVE_PATH;
  const absolutePath = path.isAbsolute(artifactPath) ? artifactPath : path.join(cwd, artifactPath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`execution outcome input not found at ${artifactPath}`);
  }
  return {
    outcomeInput: parseExecutionOutcomeInputArtifact(fs.readFileSync(absolutePath, "utf8")),
    inputArtifactPath: path.isAbsolute(artifactPath) ? absolutePath : artifactPath,
    replayMode: inputPath ? "selected" : "current",
  };
};
