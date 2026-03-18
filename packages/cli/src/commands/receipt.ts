import fs from "node:fs";
import path from "node:path";
import { ExitCode } from "../lib/cliContract.js";
import {
  parseExecutionResults,
  persistExecutionControlLoop,
} from "./execution/receiptIngest.js";
import {
  loadReplayExecutionOutcomeInput,
  replayExecutionOutcomeInput,
  type ExecutionReplayResult,
} from "./execution/replay.js";

type ReceiptOptions = { format: "text" | "json"; quiet: boolean };

type ReceiptIngestResult = {
  schemaVersion: "1.0";
  command: "receipt";
  mode: "ingest";
  receipt: ReturnType<typeof persistExecutionControlLoop>["receipt_with_promotion"];
  updated_state: ReturnType<typeof persistExecutionControlLoop>["updated_state"];
  next_queue: ReturnType<typeof persistExecutionControlLoop>["next_queue"];
  execution_outcome_input: ReturnType<typeof persistExecutionControlLoop>["execution_outcome_input"];
  promotion: ReturnType<typeof persistExecutionControlLoop>["promotion"];
  story_transition: ReturnType<typeof persistExecutionControlLoop>["story_transition"];
  written_artifacts: ReturnType<typeof persistExecutionControlLoop>["written_artifacts"];
};

const readOptionValue = (args: string[], optionName: string): string | null => {
  const exactIndex = args.findIndex((arg) => arg === optionName);
  if (exactIndex >= 0) return args[exactIndex + 1] ?? null;
  const prefixed = args.find((arg) => arg.startsWith(`${optionName}=`));
  return prefixed ? prefixed.slice(optionName.length + 1) || null : null;
};

type ReceiptReplayCliResult = {
  schemaVersion: "1.0";
  command: "receipt";
  mode: "replay";
} & ExecutionReplayResult;

const printHelp = (): void => {
  console.log(
    `Usage: playbook receipt <subcommand> [options]\n\nSubcommands:\n  ingest <file>    Ingest explicit execution results into receipt -> updated-state -> next-queue\n  replay           Re-run canonical receipt -> updated-state -> next-queue from an execution outcome input artifact`,
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
    if (subcommand !== "ingest" && subcommand !== "replay") {
      throw new Error(
        "playbook receipt: unsupported subcommand. Use `playbook receipt ingest <file>` or `playbook receipt replay`.",
      );
    }

    if (subcommand === "replay") {
      const inputPath =
        readOptionValue(args, "--input") ??
        readOptionValue(args, "--file") ??
        undefined;
      const { outcomeInput, inputArtifactPath, replayMode } =
        loadReplayExecutionOutcomeInput(cwd, inputPath);
      const replayed = replayExecutionOutcomeInput(cwd, outcomeInput, {
        inputArtifactPath,
        replayMode,
      });

      const payload: ReceiptReplayCliResult = {
        ...replayed,
        command: "receipt",
        mode: "replay",
      };

      if (options.format === "json")
        console.log(JSON.stringify(payload, null, 2));
      else if (!options.quiet) {
        console.log(`Replay classification: ${payload.classification}`);
        console.log(
          `Replay deterministic: ${payload.deterministic ? "yes" : "no"}`,
        );
        console.log(
          `Matched plan: ${payload.summary.matched_plan ? "yes" : "no"}`,
        );
        console.log(`Changed: ${payload.summary.changed.join("; ")}`);
        console.log(`What happened: ${payload.summary.what_happened}`);
        console.log(`Next: ${payload.summary.next_steps.join(" ")}`);
      }
      return payload.classification === "mismatch"
        ? ExitCode.Failure
        : ExitCode.Success;
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
    const ingested = persistExecutionControlLoop(cwd, executionResults);

    const payload: ReceiptIngestResult = {
      schemaVersion: "1.0",
      command: "receipt",
      mode: "ingest",
      receipt: ingested.receipt_with_promotion,
      updated_state: ingested.updated_state,
      next_queue: ingested.next_queue,
      execution_outcome_input: ingested.execution_outcome_input,
      promotion: ingested.promotion,
      story_transition: ingested.story_transition,
      written_artifacts: ingested.written_artifacts,
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
    return ingested.promotion.promoted ? ExitCode.Success : ExitCode.Failure;
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
