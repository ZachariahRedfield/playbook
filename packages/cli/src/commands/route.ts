import fs from "node:fs";
import path from "node:path";
import {
  buildExecutionPlan,
  routeTask,
  type ExecutionPlanArtifact,
  compileCodexPrompt,
  type LearningStateSnapshotArtifact,
  type RouteDecision,
  recordRouteDecision,
  safeRecordRepositoryEvent,
  readStoriesArtifact,
  findStoryById,
  buildStoryRouteTask,
  toStoryPlanningReference,
  deriveStoryTransitionPreview,
  linkStoryToPlan,
  validateStoriesArtifact,
  STORIES_RELATIVE_PATH,
  type StoriesArtifact,
  type StoryRecord,
  buildStoryPatternContext,
  type StoryPatternContext,
} from "@zachariahredfield/playbook-engine";
import { ExitCode } from "../lib/cliContract.js";
import { createCommandQualityTracker } from "../lib/commandQuality.js";
import { emitCommandFailure, printCommandHelp } from "../lib/commandSurface.js";
import { stageWorkflowArtifact } from "../lib/workflowPromotion.js";
import type { WorkflowPromotion } from "../lib/workflowPromotion.js";
import {
  buildRouteInterpretation,
  type InterpretationLayer,
} from "../lib/interpretation.js";

type RouteOptions = {
  format: "text" | "json";
  quiet: boolean;
  codexPrompt: boolean;
  help?: boolean;
};

type StoryTransitionOutput = {
  story_id: string;
  previous_status: StoryRecord["status"];
  next_status: StoryRecord["status"];
  promotion: WorkflowPromotion;
} | null;

type RouteOutput = {
  schemaVersion: "1.0";
  command: "route";
  task: string;
  story?: {
    id: string;
    title: string;
    status: StoryRecord["status"];
    derived_task: string;
  };
  pattern_context: StoryPatternContext;
  selectedRoute: RouteDecision["route"];
  why: string;
  requiredInputs: string[];
  executionPlan: ExecutionPlanArtifact;
  promotion: WorkflowPromotion;
  story_transition: StoryTransitionOutput;
  codexPrompt?: string;
  interpretation: InterpretationLayer;
};

const EXECUTION_PLAN_PATH = ".playbook/execution-plan.json";
const TASK_EXECUTION_PROFILE_PATH = ".playbook/task-execution-profile.json";
const LEARNING_STATE_PATH = ".playbook/learning-state.json";

const readOptionValue = (
  args: string[],
  optionName: string,
): string | undefined => {
  const exactIndex = args.findIndex((arg) => arg === optionName);
  if (exactIndex >= 0) {
    return args[exactIndex + 1];
  }
  const prefixed = args.find((arg) => arg.startsWith(`${optionName}=`));
  return prefixed ? prefixed.slice(optionName.length + 1) : undefined;
};

const filterOptionArgs = (args: string[]): string[] => {
  const filtered: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--story") {
      index += 1;
      continue;
    }
    if (arg.startsWith("--story=")) {
      continue;
    }
    filtered.push(arg);
  }
  return filtered;
};

const extractTask = (args: string[]): string | undefined => {
  const positional = filterOptionArgs(args).filter(
    (arg) => !arg.startsWith("-"),
  );
  if (positional.length === 0) {
    return undefined;
  }

  return positional.join(" ").trim();
};

const tryReadJsonArtifact = <T>(
  cwd: string,
  artifactPath: string,
): T | undefined => {
  const absolutePath = path.join(cwd, artifactPath);
  if (!fs.existsSync(absolutePath)) {
    return undefined;
  }

  return JSON.parse(fs.readFileSync(absolutePath, "utf8")) as T;
};

const promoteStoryTransition = (
  cwd: string,
  current: StoriesArtifact,
  storyId: string,
): StoryTransitionOutput => {
  const transition = deriveStoryTransitionPreview(current, storyId, "planned");
  if (!transition) {
    return null;
  }
  const generatedAt = new Date().toISOString();
  const nextArtifact = linkStoryToPlan(
    current,
    storyId,
    EXECUTION_PLAN_PATH,
    generatedAt,
  );
  const promotion = stageWorkflowArtifact({
    cwd,
    workflowKind: "story-status",
    candidateRelativePath: ".playbook/stories.staged.json",
    committedRelativePath: STORIES_RELATIVE_PATH,
    artifact: nextArtifact,
    validate: () => validateStoriesArtifact(nextArtifact),
    generatedAt,
    successSummary: `Updated story ${storyId} to status ${transition.next_status}`,
    blockedSummary:
      "Story status update blocked; committed backlog state preserved.",
  });
  return {
    story_id: storyId,
    previous_status: transition.previous_status,
    next_status: transition.next_status,
    promotion,
  };
};

const toOutput = (
  task: string,
  decision: RouteDecision,
  executionPlan: ExecutionPlanArtifact,
  promotion: WorkflowPromotion,
  codexPrompt: string | undefined,
  storyTransition: StoryTransitionOutput,
  patternContext: StoryPatternContext,
  storyContext?: {
    id: string;
    title: string;
    status: StoryRecord["status"];
    derived_task: string;
  },
): RouteOutput => ({
  schemaVersion: "1.0",
  command: "route",
  task,
  ...(storyContext ? { story: storyContext } : {}),
  pattern_context: patternContext,
  selectedRoute: decision.route,
  why: decision.why,
  requiredInputs: decision.requiredInputs,
  executionPlan,
  promotion,
  story_transition: storyTransition,
  codexPrompt,
  interpretation: buildRouteInterpretation({
    task,
    selectedRoute: decision.route,
    why: decision.why,
    requiredInputs: decision.requiredInputs,
    executionPlan,
    promotion,
  }),
});

const printText = (payload: RouteOutput, options: RouteOptions): void => {
  console.log("State");
  console.log(payload.interpretation.progressive_disclosure.default_view.state);
  console.log("");
  console.log("Why");
  console.log(payload.interpretation.progressive_disclosure.default_view.why);
  console.log("");
  console.log("Next step");
  console.log(
    payload.interpretation.progressive_disclosure.default_view.next_step
      .command ||
      payload.interpretation.progressive_disclosure.default_view.next_step
        .label,
  );
  console.log("");
  console.log("Route");
  console.log("─────");
  console.log(`Task: ${payload.task}`);
  if (payload.story) {
    console.log(`Story: ${payload.story.id} (${payload.story.status})`);
  }
  console.log(`Selected route: ${payload.selectedRoute}`);
  console.log(`Why: ${payload.why}`);
  console.log(`Task family: ${payload.executionPlan.task_family}`);
  console.log(`Route id: ${payload.executionPlan.route_id}`);
  console.log(
    `Proposal only: ${payload.executionPlan.proposalOnly ? "yes" : "no"}`,
  );
  console.log(
    `Repository mutation allowed: ${payload.executionPlan.mutation_allowed ? "yes" : "no"}`,
  );
  console.log(
    `Learning state available: ${payload.executionPlan.learning_state_available ? "yes" : "no"}`,
  );
  console.log(`Route confidence: ${payload.executionPlan.route_confidence}`);

  if (payload.executionPlan.story_reference) {
    console.log(
      `Story linkage: ${payload.executionPlan.story_reference.id} -> ${payload.executionPlan.story_reference.artifact_path}`,
    );
  }
  console.log(
    `Pattern context matches: ${payload.pattern_context.patterns.length}`,
  );

  console.log("");
  console.log("Rule packs:");
  for (const item of payload.executionPlan.rule_packs) {
    console.log(`- ${item}`);
  }

  console.log("");
  console.log("Required validations:");
  for (const item of payload.executionPlan.required_validations) {
    console.log(`- ${item}`);
  }

  if (payload.executionPlan.optional_validations.length > 0) {
    console.log("");
    console.log("Optional validations:");
    for (const item of payload.executionPlan.optional_validations) {
      console.log(`- ${item}`);
    }
  }

  if (payload.executionPlan.missing_prerequisites.length > 0) {
    console.log("");
    console.log("Missing prerequisites:");
    for (const item of payload.executionPlan.missing_prerequisites) {
      console.log(`- ${item}`);
    }
  }

  if (payload.executionPlan.open_questions.length > 0) {
    console.log("");
    console.log("Open questions:");
    for (const question of payload.executionPlan.open_questions) {
      console.log(`- ${question}`);
    }
  }

  if (payload.executionPlan.warnings.length > 0) {
    console.log("");
    console.log("Warnings:");
    for (const warning of payload.executionPlan.warnings) {
      console.log(`- ${warning}`);
    }
  }

  if (payload.story_transition) {
    console.log("");
    console.log(
      `Story transition: ${payload.story_transition.previous_status} -> ${payload.story_transition.next_status}`,
    );
  }

  if (options.codexPrompt && payload.codexPrompt) {
    console.log("");
    console.log("Codex worker prompt");
    console.log("───────────────────");
    console.log(payload.codexPrompt.trimEnd());
  }
};

export const runRoute = async (
  cwd: string,
  commandArgs: string[],
  options: RouteOptions,
): Promise<number> => {
  if (options.help) {
    printCommandHelp({
      usage: "playbook route <task> [options]",
      description:
        "Classify task routing and emit a deterministic proposal execution plan.",
      options: [
        "--story <id>               Build a route/execution plan from a canonical story",
        "--codex-prompt             Include compiled Codex worker prompt",
        "--json                     Alias for --format=json",
        "--format <text|json>       Output format",
        "--quiet                    Suppress success output in text mode",
        "--help                     Show help",
      ],
      artifacts: [EXECUTION_PLAN_PATH, STORIES_RELATIVE_PATH],
    });
    return ExitCode.Success;
  }

  const tracker = createCommandQualityTracker(cwd, "route");

  const storyId = readOptionValue(commandArgs, "--story");
  const storiesArtifact = storyId ? readStoriesArtifact(cwd) : null;
  const linkedStory =
    storyId && storiesArtifact ? findStoryById(storiesArtifact, storyId) : null;
  if (storyId && !linkedStory) {
    const exitCode = emitCommandFailure("route", options, {
      summary: `Route failed: story not found (${storyId}).`,
      findingId: "route.story.not_found",
      message: `Story not found: ${storyId}.`,
      nextActions: [
        "Run `playbook story list --json` to inspect canonical story ids.",
      ],
    });
    tracker.finish({
      inputsSummary: `story=${storyId}`,
      successStatus: "failure",
      warningsCount: 1,
    });
    return exitCode;
  }

  const task = linkedStory
    ? buildStoryRouteTask(linkedStory)
    : extractTask(commandArgs);
  if (!task) {
    const exitCode = emitCommandFailure("route", options, {
      summary: "Route failed: missing required task argument.",
      findingId: "route.task.required",
      message: "Missing required argument: <task>.",
      nextActions: [
        'Run `playbook route "<task>"` with a deterministic task statement.',
        "Or run `playbook route --story <id>` to plan from a canonical story.",
      ],
    });
    tracker.finish({
      inputsSummary: "missing task argument",
      successStatus: "failure",
      warningsCount: 1,
    });
    return exitCode;
  }

  const decision = routeTask(cwd, task);
  const patternContext = linkedStory
    ? buildStoryPatternContext(linkedStory)
    : { patterns: [] };
  const taskExecutionProfile = tryReadJsonArtifact(
    cwd,
    TASK_EXECUTION_PROFILE_PATH,
  );
  const learningState = tryReadJsonArtifact<LearningStateSnapshotArtifact>(
    cwd,
    LEARNING_STATE_PATH,
  );
  const executionPlan = buildExecutionPlan({
    task,
    decision,
    learningStateSnapshot: learningState,
    story: linkedStory ? toStoryPlanningReference(linkedStory) : undefined,
    patternContext,
    sourceArtifacts: {
      taskExecutionProfile: {
        available: taskExecutionProfile !== undefined,
        artifactPath: TASK_EXECUTION_PROFILE_PATH,
      },
      learningState: {
        available: learningState !== undefined,
        artifactPath: LEARNING_STATE_PATH,
      },
    },
  });

  const codexPrompt = options.codexPrompt
    ? compileCodexPrompt(task, decision, executionPlan)
    : undefined;
  const promotion = stageWorkflowArtifact({
    cwd,
    workflowKind: "route-execution-plan",
    candidateRelativePath:
      ".playbook/staged/workflow-route/execution-plan.json",
    committedRelativePath: EXECUTION_PLAN_PATH,
    artifact: executionPlan,
    validate: () => {
      const errors: string[] = [];
      if (executionPlan.schemaVersion !== "1.0")
        errors.push("schemaVersion must be 1.0");
      if (executionPlan.kind !== "execution-plan")
        errors.push("kind must be execution-plan");
      if (!Array.isArray(executionPlan.required_validations))
        errors.push("required_validations must be an array");
      return errors;
    },
    generatedAt: executionPlan.generatedAt,
    successSummary:
      "Staged execution-plan candidate validated and promoted into the committed route artifact.",
    blockedSummary:
      "Staged execution-plan candidate blocked; committed route artifact preserved.",
  });
  const storyTransition =
    linkedStory && storiesArtifact
      ? promoteStoryTransition(cwd, storiesArtifact, linkedStory.id)
      : null;
  const output = toOutput(
    task,
    decision,
    executionPlan,
    promotion,
    codexPrompt,
    storyTransition,
    patternContext,
    linkedStory
      ? {
          id: linkedStory.id,
          title: linkedStory.title,
          status: linkedStory.status,
          derived_task: task,
        }
      : undefined,
  );

  safeRecordRepositoryEvent(() => {
    recordRouteDecision(cwd, {
      task_text: task,
      task_family: executionPlan.task_family,
      route_id: executionPlan.route_id,
      confidence: executionPlan.route_confidence,
      related_artifacts: [
        { path: EXECUTION_PLAN_PATH, kind: "execution_plan" },
      ],
    });
  });

  if (options.format === "json") {
    console.log(JSON.stringify(output, null, 2));
    const exitCode =
      decision.route === "unsupported" ? ExitCode.Failure : ExitCode.Success;
    tracker.finish({
      inputsSummary: linkedStory ? `story=${linkedStory.id}` : `task=${task}`,
      artifactsRead: [
        TASK_EXECUTION_PROFILE_PATH,
        LEARNING_STATE_PATH,
        ...(linkedStory ? [STORIES_RELATIVE_PATH] : []),
      ],
      artifactsWritten: [
        EXECUTION_PLAN_PATH,
        ...(storyTransition ? [STORIES_RELATIVE_PATH] : []),
      ],
      downstreamArtifactsProduced: [EXECUTION_PLAN_PATH],
      successStatus: decision.route === "unsupported" ? "partial" : "success",
      warningsCount: output.executionPlan.warnings.length,
      openQuestionsCount: output.executionPlan.open_questions.length,
      confidenceScore: output.executionPlan.route_confidence,
    });
    return exitCode;
  }

  if (!options.quiet) {
    printText(output, options);
    console.log("");
    console.log(`Wrote proposal artifact: ${EXECUTION_PLAN_PATH}`);
  }

  tracker.finish({
    inputsSummary: linkedStory ? `story=${linkedStory.id}` : `task=${task}`,
    artifactsRead: [
      TASK_EXECUTION_PROFILE_PATH,
      LEARNING_STATE_PATH,
      ...(linkedStory ? [STORIES_RELATIVE_PATH] : []),
    ],
    artifactsWritten: [
      EXECUTION_PLAN_PATH,
      ...(storyTransition ? [STORIES_RELATIVE_PATH] : []),
    ],
    downstreamArtifactsProduced: [EXECUTION_PLAN_PATH],
    successStatus: decision.route === "unsupported" ? "partial" : "success",
    warningsCount: output.executionPlan.warnings.length,
    openQuestionsCount: output.executionPlan.open_questions.length,
    confidenceScore: output.executionPlan.route_confidence,
  });
  return decision.route === "unsupported" ? ExitCode.Failure : ExitCode.Success;
};
