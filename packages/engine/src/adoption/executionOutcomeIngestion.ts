import type { FleetAdoptionReadinessSummary } from "./fleetReadiness.js";
import type {
  FleetCodexExecutionPlan,
  CodexExecutionPrompt,
} from "./executionPlan.js";
import type { FleetAdoptionWorkQueue, AdoptionWorkItem } from "./workQueue.js";
import {
  buildFleetExecutionReceipt,
  type FleetExecutionReceipt,
  type FleetExecutionOutcomeInput,
  type ExecutionObservedStatus,
  type LifecycleTransition,
} from "./executionReceipt.js";
import {
  buildFleetUpdatedAdoptionState,
  type FleetUpdatedAdoptionState,
} from "./executionUpdatedState.js";
import { deriveNextAdoptionQueueFromUpdatedState } from "./updatedStateQueue.js";

export type ExecutionResult = {
  repo_id: string;
  prompt_id: string;
  status: "success" | "failed" | "not_run";
  observed_transition?: {
    from: string;
    to: string;
  };
  error?: string;
};

export type IngestExecutionResultsOutput = {
  execution_outcome_input: FleetExecutionOutcomeInput;
  receipt: FleetExecutionReceipt;
  updated_state: FleetUpdatedAdoptionState;
  next_queue: ReturnType<typeof deriveNextAdoptionQueueFromUpdatedState>;
};

const sortResults = (results: ExecutionResult[]): ExecutionResult[] =>
  [...results].sort(
    (left, right) =>
      left.repo_id.localeCompare(right.repo_id) ||
      left.prompt_id.localeCompare(right.prompt_id) ||
      left.status.localeCompare(right.status) ||
      (left.error ?? "").localeCompare(right.error ?? ""),
  );

const statusToObserved = (
  status: ExecutionResult["status"],
): ExecutionObservedStatus => {
  if (status === "success") return "succeeded";
  if (status === "failed") return "failed";
  return "not_run";
};

const inputTransition = (
  result: ExecutionResult,
): LifecycleTransition | undefined => {
  if (!result.observed_transition) return undefined;
  return {
    from: result.observed_transition.from as LifecycleTransition["from"],
    to: result.observed_transition.to as LifecycleTransition["to"],
  };
};

export const buildExecutionOutcomeInputFromResults = (
  plan: FleetCodexExecutionPlan,
  queue: FleetAdoptionWorkQueue,
  results: ExecutionResult[],
  options?: { generatedAt?: string; sessionId?: string },
): FleetExecutionOutcomeInput => {
  const generatedAt = options?.generatedAt ?? new Date().toISOString();
  const sessionId = options?.sessionId ?? `execution-ingest:${generatedAt}`;
  const promptById = new Map(
    plan.codex_prompts.map((prompt) => [prompt.prompt_id, prompt]),
  );
  const queueItemByPromptId = new Map<string, AdoptionWorkItem>();

  for (const item of queue.work_items) {
    const promptId = `${item.wave}:${item.parallel_group.replace(/\s+/g, "_")}:${item.repo_id}`;
    queueItemByPromptId.set(promptId, item);
  }

  const promptOutcomes = sortResults(results).map((result) => {
    const prompt = promptById.get(result.prompt_id);
    if (!prompt) {
      throw new Error(
        `unknown prompt_id "${result.prompt_id}" in execution results`,
      );
    }
    if (prompt.repo_id !== result.repo_id) {
      throw new Error(
        `execution result repo_id mismatch for prompt "${result.prompt_id}": expected "${prompt.repo_id}", received "${result.repo_id}"`,
      );
    }
    const queueItem = queueItemByPromptId.get(result.prompt_id);
    if (!queueItem) {
      throw new Error(`missing queue lineage for prompt "${result.prompt_id}"`);
    }

    return {
      prompt_id: prompt.prompt_id,
      repo_id: prompt.repo_id,
      lane_id: prompt.lane_id,
      status: statusToObserved(result.status),
      verification_passed:
        result.status === "success" && result.observed_transition !== undefined,
      notes: result.error?.trim()
        ? result.error.trim()
        : `execution result ingested: ${result.status}`,
      observed_transition: inputTransition(result),
    };
  });

  return {
    schemaVersion: "1.0",
    kind: "fleet-adoption-execution-outcome-input",
    generated_at: generatedAt,
    session_id: sessionId,
    prompt_outcomes: promptOutcomes,
  };
};

export const ingestExecutionResults = (
  fleet: FleetAdoptionReadinessSummary,
  queue: FleetAdoptionWorkQueue,
  plan: FleetCodexExecutionPlan,
  results: ExecutionResult[],
  options?: { generatedAt?: string; sessionId?: string },
): IngestExecutionResultsOutput => {
  const execution_outcome_input = buildExecutionOutcomeInputFromResults(
    plan,
    queue,
    results,
    options,
  );
  const receipt = buildFleetExecutionReceipt(
    plan,
    queue,
    fleet,
    execution_outcome_input,
    { generatedAt: options?.generatedAt },
  );
  const updated_state = buildFleetUpdatedAdoptionState(
    plan,
    queue,
    fleet,
    receipt,
    { generatedAt: options?.generatedAt },
  );
  const next_queue = deriveNextAdoptionQueueFromUpdatedState(updated_state, {
    generatedAt: options?.generatedAt,
  });

  return { execution_outcome_input, receipt, updated_state, next_queue };
};
