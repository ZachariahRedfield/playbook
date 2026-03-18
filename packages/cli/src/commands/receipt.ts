import fs from "node:fs";
import path from "node:path";
import {
  buildFleetAdoptionReadinessSummary,
  buildFleetAdoptionWorkQueue,
  buildFleetCodexExecutionPlan,
  ingestExecutionResults,
  type ExecutionResult,
} from "@zachariahredfield/playbook-engine";
import { ExitCode } from "../lib/cliContract.js";
import { writeJsonArtifactAbsolute } from "../lib/jsonArtifact.js";
import {
  previewWorkflowArtifact,
  stageWorkflowArtifact,
} from "../lib/workflowPromotion.js";
import type { WorkflowPromotion } from "../lib/workflowPromotion.js";
import { buildRepoAdoptionReadiness } from "@zachariahredfield/playbook-engine";

const EXECUTION_OUTCOME_INPUT_RELATIVE_PATH = path.join(
  ".playbook",
  "execution-outcome-input.json",
);
const UPDATED_STATE_RELATIVE_PATH = path.join(
  ".playbook",
  "execution-updated-state.json",
);
const UPDATED_STATE_STAGING_RELATIVE_PATH = path.join(
  ".playbook",
  "staged",
  "workflow-status-updated",
  "execution-updated-state.json",
);

type ReceiptOptions = { format: "text" | "json"; quiet: boolean };
type ObserverRegistry = {
  repos: Array<{ id: string; name: string; root: string }>;
};

type ReceiptResult = {
  schemaVersion: "1.0";
  command: "receipt";
  mode: "ingest";
  receipt: ReturnType<typeof ingestExecutionResults>["receipt"];
  updated_state: ReturnType<typeof ingestExecutionResults>["updated_state"];
  next_queue: ReturnType<typeof ingestExecutionResults>["next_queue"];
  execution_outcome_input: ReturnType<
    typeof ingestExecutionResults
  >["execution_outcome_input"];
  promotion: WorkflowPromotion;
  written_artifacts: {
    execution_outcome_input: string;
    updated_state: string;
    staged_updated_state: string;
  };
};

const readOptionValue = (args: string[], optionName: string): string | null => {
  const exactIndex = args.findIndex((arg) => arg === optionName);
  if (exactIndex >= 0) return args[exactIndex + 1] ?? null;
  const prefixed = args.find((arg) => arg.startsWith(`${optionName}=`));
  return prefixed ? prefixed.slice(optionName.length + 1) || null : null;
};

const loadFleet = (cwd: string) => {
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

const parseExecutionResults = (raw: string): ExecutionResult[] => {
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

const validateUpdatedStateArtifact = (
  updatedState: ReceiptResult["updated_state"],
  nextQueue: ReceiptResult["next_queue"],
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

const printHelp = (): void => {
  console.log(
    `Usage: playbook receipt ingest <file> [--json]\n\nSubcommands:\n  ingest <file>    Ingest explicit execution results into receipt -> updated-state -> next-queue`,
  );
};

export const runReceipt = async (
  cwd: string,
  args: string[],
  options: ReceiptOptions,
): Promise<number> => {
  try {
    const subcommand = args.find((arg) => !arg.startsWith("-"));
    if (!subcommand || args.includes("--help") || args.includes("-h")) {
      printHelp();
      return subcommand ? ExitCode.Success : ExitCode.Failure;
    }
    if (subcommand !== "ingest") {
      throw new Error(
        "playbook receipt: unsupported subcommand. Use `playbook receipt ingest <file>`.",
      );
    }
    const ingestArgs = args
      .slice(args.indexOf("ingest") + 1)
      .filter((arg) => !arg.startsWith("--"));
    const fileArg = ingestArgs[0] ?? readOptionValue(args, "--file");
    if (!fileArg)
      throw new Error("playbook receipt ingest: missing <file> argument");
    const absoluteInput = path.isAbsolute(fileArg)
      ? fileArg
      : path.join(cwd, fileArg);
    const executionResults = parseExecutionResults(
      fs.readFileSync(absoluteInput, "utf8"),
    );
    const fleet = loadFleet(cwd);
    const queue = buildFleetAdoptionWorkQueue(fleet);
    const executionPlan = buildFleetCodexExecutionPlan(queue);
    const ingested = ingestExecutionResults(
      fleet,
      queue,
      executionPlan,
      executionResults,
    );

    const outcomePath = path.join(cwd, EXECUTION_OUTCOME_INPUT_RELATIVE_PATH);
    writeJsonArtifactAbsolute(
      outcomePath,
      ingested.execution_outcome_input as unknown as Record<string, unknown>,
      "receipt",
      { envelope: false },
    );

    const promotionPreview = previewWorkflowArtifact({
      cwd,
      workflowKind: "status-updated",
      candidateRelativePath: UPDATED_STATE_STAGING_RELATIVE_PATH,
      committedRelativePath: UPDATED_STATE_RELATIVE_PATH,
      artifact: ingested.updated_state,
      validate: () =>
        validateUpdatedStateArtifact(
          ingested.updated_state,
          ingested.next_queue,
        ),
      generatedAt: ingested.updated_state.generated_at,
      successSummary:
        "Staged updated-state candidate validated and ready for promotion into committed adoption state.",
      blockedSummary:
        "Staged updated-state candidate blocked; committed adoption state preserved.",
    });
    const receiptWithPromotion = {
      ...ingested.receipt,
      workflow_promotion: promotionPreview,
    };
    const promotion = stageWorkflowArtifact({
      cwd,
      workflowKind: "status-updated",
      candidateRelativePath: UPDATED_STATE_STAGING_RELATIVE_PATH,
      committedRelativePath: UPDATED_STATE_RELATIVE_PATH,
      artifact: ingested.updated_state,
      validate: () =>
        validateUpdatedStateArtifact(
          ingested.updated_state,
          ingested.next_queue,
        ),
      generatedAt: ingested.updated_state.generated_at,
      successSummary:
        "Staged updated-state candidate validated and promoted into committed adoption state.",
      blockedSummary:
        "Staged updated-state candidate blocked; committed adoption state preserved.",
    });

    const payload: ReceiptResult = {
      schemaVersion: "1.0",
      command: "receipt",
      mode: "ingest",
      receipt: receiptWithPromotion,
      updated_state: ingested.updated_state,
      next_queue: ingested.next_queue,
      execution_outcome_input: ingested.execution_outcome_input,
      promotion,
      written_artifacts: {
        execution_outcome_input: EXECUTION_OUTCOME_INPUT_RELATIVE_PATH,
        updated_state: UPDATED_STATE_RELATIVE_PATH,
        staged_updated_state: UPDATED_STATE_STAGING_RELATIVE_PATH,
      },
    };

    if (options.format === "json")
      console.log(JSON.stringify(payload, null, 2));
    else if (!options.quiet) {
      console.log(`Ingested execution results: ${executionResults.length}`);
      console.log(
        `Receipt prompts: ${payload.receipt.verification_summary.prompts_total}`,
      );
      console.log(
        `Updated-state repos needing retry: ${payload.updated_state.summary.repos_needing_retry.length}`,
      );
      console.log(`Next-queue items: ${payload.next_queue.work_items.length}`);
      console.log(
        `Wrote: ${payload.written_artifacts.execution_outcome_input}`,
      );
    }
    return promotion.promoted ? ExitCode.Success : ExitCode.Failure;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (options.format === "json")
      console.log(
        JSON.stringify(
          { schemaVersion: "1.0", command: "receipt", error: message },
          null,
          2,
        ),
      );
    else console.error(message);
    return ExitCode.Failure;
  }
};
