import fs from "node:fs";
import path from "node:path";
import {
  buildFleetAdoptionReadinessSummary,
  buildFleetAdoptionWorkQueue,
  buildFleetCodexExecutionPlan,
  ingestExecutionResults,
  type ExecutionResult,
  buildRepoAdoptionReadiness,
  readStoriesArtifact,
  findStoryById,
  reconcileStoryExecution,
  validateStoriesArtifact,
  STORIES_RELATIVE_PATH,
  type StoryPlanningReference,
  type StoriesArtifact,
  type StoryLifecycleEvent,
} from "@zachariahredfield/playbook-engine";
import { writeJsonArtifactAbsolute } from "../../lib/jsonArtifact.js";
import {
  previewWorkflowArtifact,
  stageWorkflowArtifact,
} from "../../lib/workflowPromotion.js";
import type { WorkflowPromotion } from "../../lib/workflowPromotion.js";

export const EXECUTION_OUTCOME_INPUT_RELATIVE_PATH = path.join(
  ".playbook",
  "execution-outcome-input.json",
);
export const UPDATED_STATE_RELATIVE_PATH = path.join(
  ".playbook",
  "execution-updated-state.json",
);
export const UPDATED_STATE_STAGING_RELATIVE_PATH = path.join(
  ".playbook",
  "staged",
  "workflow-status-updated",
  "execution-updated-state.json",
);

const EXECUTION_PLAN_RELATIVE_PATH = path.join(".playbook", "execution-plan.json");
const EXECUTION_RECEIPT_RELATIVE_PATH = path.join(".playbook", "execution-receipt.json");

type ObserverRegistry = {
  repos: Array<{ id: string; name: string; root: string }>;
};

type StoryTransitionResult = {
  story_id: string;
  previous_status: string;
  next_status: string;
  promotion: WorkflowPromotion;
} | null;

type StoryLinkedControlLoop<T> = T & {
  story_reference?: StoryPlanningReference;
};

export type PersistedExecutionIngest = ReturnType<typeof ingestExecutionResults> & {
  receipt_with_promotion: StoryLinkedControlLoop<ReturnType<typeof ingestExecutionResults>["receipt"]> & {
    workflow_promotion: WorkflowPromotion;
  };
  updated_state: StoryLinkedControlLoop<ReturnType<typeof ingestExecutionResults>["updated_state"]>;
  execution_outcome_input: StoryLinkedControlLoop<ReturnType<typeof ingestExecutionResults>["execution_outcome_input"]>;
  promotion: WorkflowPromotion;
  story_transition: StoryTransitionResult;
  written_artifacts: {
    execution_outcome_input: string;
    execution_receipt: string;
    updated_state: string;
    staged_updated_state: string;
    stories?: string;
  };
};

const loadStoryReference = (cwd: string): StoryPlanningReference | undefined => {
  const executionPlanPath = path.join(cwd, EXECUTION_PLAN_RELATIVE_PATH);
  if (!fs.existsSync(executionPlanPath)) {
    return undefined;
  }
  const parsed = JSON.parse(fs.readFileSync(executionPlanPath, "utf8")) as {
    story_reference?: StoryPlanningReference;
  };
  return parsed.story_reference;
};

const determineStoryLifecycleEvent = (
  updatedState: ReturnType<typeof ingestExecutionResults>["updated_state"],
): StoryLifecycleEvent | null => {
  if (updatedState.summary.blocked_repo_ids.length > 0) {
    return "receipt_blocked";
  }
  const completedAllRepos =
    updatedState.summary.repos_total > 0 &&
    updatedState.summary.completed_repo_ids.length === updatedState.summary.repos_total &&
    updatedState.summary.repos_needing_retry.length === 0 &&
    updatedState.summary.repos_needing_replan.length === 0 &&
    updatedState.summary.repos_needing_review.length === 0;
  if (completedAllRepos) {
    return "receipt_completed";
  }
  return null;
};

const promoteStoryLifecycle = (
  cwd: string,
  storyReference: StoryPlanningReference | undefined,
  updatedState: ReturnType<typeof ingestExecutionResults>["updated_state"],
): StoryTransitionResult => {
  if (!storyReference) {
    return null;
  }
  const stories = readStoriesArtifact(cwd);
  const current = findStoryById(stories, storyReference.id);
  if (!current) {
    return null;
  }
  const event = determineStoryLifecycleEvent(updatedState);
  if (!event) {
    return null;
  }
  const { artifact: nextArtifact, outcome } = reconcileStoryExecution(stories, storyReference.id, {
    receiptRef: EXECUTION_RECEIPT_RELATIVE_PATH,
    updatedStateRef: UPDATED_STATE_RELATIVE_PATH,
    reconciledAt: updatedState.generated_at,
    event
  });
  const next = findStoryById(nextArtifact, storyReference.id);
  if (!next || outcome === "noop") {
    return null;
  }
  if (outcome === "conflict") {
    return {
      story_id: storyReference.id,
      previous_status: current.status,
      next_status: current.status,
      promotion: previewWorkflowArtifact({
        cwd,
        workflowKind: "story-status",
        candidateRelativePath: ".playbook/stories.staged.json",
        committedRelativePath: STORIES_RELATIVE_PATH,
        artifact: stories,
        validate: () => ["Story reconciliation conflict: canonical story already links to a different receipt and updated-state reference."],
        generatedAt: updatedState.generated_at,
        successSummary: "Story reconciliation preview prepared.",
        blockedSummary: "Story reconciliation conflict; committed backlog state preserved."
      })
    };
  }
  const promotion = stageWorkflowArtifact({
    cwd,
    workflowKind: "story-status",
    candidateRelativePath: ".playbook/stories.staged.json",
    committedRelativePath: STORIES_RELATIVE_PATH,
    artifact: nextArtifact,
    validate: () => validateStoriesArtifact(nextArtifact),
    generatedAt: updatedState.generated_at,
    successSummary: `Updated story ${storyReference.id} to status ${next.status}`,
    blockedSummary: "Story status update blocked; committed backlog state preserved.",
  });
  return {
    story_id: storyReference.id,
    previous_status: current.status,
    next_status: next.status,
    promotion,
  };
};

export const loadFleet = (cwd: string) => {
  const registryPath = path.join(cwd, ".playbook", "observer", "repos.json");
  const registry = fs.existsSync(registryPath)
    ? (JSON.parse(fs.readFileSync(registryPath, "utf8")) as ObserverRegistry)
    : { repos: [{ id: "current-repo", name: path.basename(cwd), root: cwd }] };
  const repos = Array.isArray(registry.repos) ? registry.repos : [];
  return buildFleetAdoptionReadinessSummary(
    repos.map((repo) => ({
      repo_id: repo.id,
      repo_name: repo.name,
      readiness: buildRepoAdoptionReadiness({
        repoRoot: repo.root,
        connected: true,
      }),
    })),
  );
};

export const parseExecutionResults = (raw: string): ExecutionResult[] => {
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed))
    throw new Error("execution results input must be a JSON array");
  return parsed.map((entry, index) => {
    if (!entry || typeof entry !== "object")
      throw new Error(`execution result at index ${index} must be an object`);
    const value = entry as Record<string, unknown>;
    if (typeof value.repo_id !== "string" || value.repo_id.length === 0)
      throw new Error(`execution result at index ${index} is missing repo_id`);
    if (typeof value.prompt_id !== "string" || value.prompt_id.length === 0)
      throw new Error(
        `execution result at index ${index} is missing prompt_id`,
      );
    if (
      value.status !== "success" &&
      value.status !== "failed" &&
      value.status !== "not_run"
    )
      throw new Error(
        `execution result at index ${index} has unsupported status`,
      );
    if (value.observed_transition !== undefined) {
      const transition = value.observed_transition as Record<string, unknown>;
      if (
        !transition ||
        typeof transition !== "object" ||
        typeof transition.from !== "string" ||
        typeof transition.to !== "string"
      ) {
        throw new Error(
          `execution result at index ${index} has invalid observed_transition`,
        );
      }
    }
    return {
      repo_id: value.repo_id,
      prompt_id: value.prompt_id,
      status: value.status,
      observed_transition: value.observed_transition as
        | ExecutionResult["observed_transition"]
        | undefined,
      error: typeof value.error === "string" ? value.error : undefined,
    };
  });
};

export const validateUpdatedStateArtifact = (
  updatedState: ReturnType<typeof ingestExecutionResults>["updated_state"],
  nextQueue: ReturnType<typeof ingestExecutionResults>["next_queue"],
): string[] => {
  const errors: string[] = [];
  if (updatedState.schemaVersion !== "1.0")
    errors.push("schemaVersion must be 1.0");
  if (updatedState.kind !== "fleet-adoption-updated-state")
    errors.push("kind must be fleet-adoption-updated-state");
  if (!Array.isArray(updatedState.repos)) errors.push("repos must be an array");
  if (!updatedState.summary || typeof updatedState.summary !== "object")
    errors.push("summary must be present");
  if (nextQueue.queue_source !== "updated_state")
    errors.push("next queue must be derived from updated_state");
  if (
    Array.isArray(updatedState.repos) &&
    updatedState.summary?.repos_total !== updatedState.repos.length
  )
    errors.push("summary.repos_total must match repos length");
  return errors;
};

export const buildExecutionControlLoop = (
  cwd: string,
  executionResults: ExecutionResult[],
  options?: { generatedAt?: string; sessionId?: string },
) => {
  const fleet = loadFleet(cwd);
  const queue = buildFleetAdoptionWorkQueue(fleet);
  const executionPlan = buildFleetCodexExecutionPlan(queue);
  return ingestExecutionResults(
    fleet,
    queue,
    executionPlan,
    executionResults,
    options,
  );
};

export const persistExecutionControlLoop = (
  cwd: string,
  executionResults: ExecutionResult[],
  options?: { generatedAt?: string; sessionId?: string },
): PersistedExecutionIngest => {
  const ingested = buildExecutionControlLoop(cwd, executionResults, options);
  const storyReference = loadStoryReference(cwd);
  const executionOutcomeInput = storyReference
    ? { ...ingested.execution_outcome_input, story_reference: storyReference }
    : ingested.execution_outcome_input;
  const updatedState = storyReference
    ? { ...ingested.updated_state, story_reference: storyReference }
    : ingested.updated_state;

  const outcomePath = path.join(cwd, EXECUTION_OUTCOME_INPUT_RELATIVE_PATH);
  writeJsonArtifactAbsolute(
    outcomePath,
    executionOutcomeInput as unknown as Record<string, unknown>,
    "receipt",
    { envelope: false },
  );

  const promotionPreview = previewWorkflowArtifact({
    cwd,
    workflowKind: "status-updated",
    candidateRelativePath: UPDATED_STATE_STAGING_RELATIVE_PATH,
    committedRelativePath: UPDATED_STATE_RELATIVE_PATH,
    artifact: updatedState,
    validate: () =>
      validateUpdatedStateArtifact(updatedState, ingested.next_queue),
    generatedAt: updatedState.generated_at,
    successSummary:
      "Staged updated-state candidate validated and ready for promotion into committed adoption state.",
    blockedSummary:
      "Staged updated-state candidate blocked; committed adoption state preserved.",
  });
  const receiptWithPromotion = {
    ...(storyReference ? { ...ingested.receipt, story_reference: storyReference } : ingested.receipt),
    workflow_promotion: promotionPreview,
  };
  writeJsonArtifactAbsolute(
    path.join(cwd, EXECUTION_RECEIPT_RELATIVE_PATH),
    receiptWithPromotion as unknown as Record<string, unknown>,
    "receipt",
    { envelope: false },
  );
  const promotion = stageWorkflowArtifact({
    cwd,
    workflowKind: "status-updated",
    candidateRelativePath: UPDATED_STATE_STAGING_RELATIVE_PATH,
    committedRelativePath: UPDATED_STATE_RELATIVE_PATH,
    artifact: updatedState,
    validate: () =>
      validateUpdatedStateArtifact(updatedState, ingested.next_queue),
    generatedAt: updatedState.generated_at,
    successSummary:
      "Staged updated-state candidate validated and promoted into committed adoption state.",
    blockedSummary:
      "Staged updated-state candidate blocked; committed adoption state preserved.",
  });
  const storyTransition = promoteStoryLifecycle(cwd, storyReference, updatedState);

  return {
    ...ingested,
    execution_outcome_input: executionOutcomeInput,
    receipt_with_promotion: receiptWithPromotion,
    updated_state: updatedState,
    promotion,
    story_transition: storyTransition,
    written_artifacts: {
      execution_outcome_input: EXECUTION_OUTCOME_INPUT_RELATIVE_PATH,
      execution_receipt: EXECUTION_RECEIPT_RELATIVE_PATH,
      updated_state: UPDATED_STATE_RELATIVE_PATH,
      staged_updated_state: UPDATED_STATE_STAGING_RELATIVE_PATH,
      ...(storyTransition ? { stories: STORIES_RELATIVE_PATH } : {}),
    },
  };
};
