import { commandMetadata } from "../lib/commandMetadata.js";
import { ExitCode } from "../lib/cliContract.js";

type CommandContext = {
  cwd: string;
  args: string[];
  commandArgs: string[];
  ci: boolean;
  explain: boolean;
  format: "text" | "json";
  quiet: boolean;
};

type CommandRunResult =
  | number
  | {
      exitCode: number;
      childCommands?: string[];
    };

type RegisteredCommand = {
  name: string;
  description: string;
  run: (context: CommandContext) => Promise<CommandRunResult>;
};

const parseFlag = (allArgs: string[], flag: string): boolean =>
  allArgs.includes(flag);
const parseOptionValue = (
  allArgs: string[],
  name: string,
): string | undefined => {
  const index = allArgs.indexOf(name);
  return index >= 0 && allArgs[index + 1]
    ? String(allArgs[index + 1])
    : undefined;
};

const parseOptionValues = (
  allArgs: string[],
  name: string,
): string[] | undefined => {
  const values: string[] = [];
  for (let index = 0; index < allArgs.length; index += 1) {
    if (allArgs[index] !== name) {
      continue;
    }

    const value = allArgs[index + 1];
    if (value) {
      values.push(String(value));
    }
  }

  return values.length > 0 ? values : undefined;
};

const parseLearnDiffContext = (allArgs: string[]): boolean => {
  if (allArgs.includes("--no-diff-context")) {
    return false;
  }

  return true;
};

const parseAnalyzePrFormat = (
  allArgs: string[],
  globalFormat: "text" | "json",
): "text" | "json" | "github-comment" | "github-review" => {
  if (globalFormat === "json") {
    return "json";
  }

  const format = parseOptionValue(allArgs, "--format");
  if (format === "github-comment") {
    return "github-comment";
  }

  if (format === "github-review") {
    return "github-review";
  }

  return format === "json" ? "json" : "text";
};

const parseReviewPrFormat = (
  allArgs: string[],
  globalFormat: "text" | "json",
): "text" | "json" | "github-comment" => {
  if (globalFormat === "json") {
    return "json";
  }

  const format = parseOptionValue(allArgs, "--format");
  if (format === "github-comment") {
    return "github-comment";
  }

  return format === "json" ? "json" : "text";
};

const parseOrchestrateArtifactFormat = (
  allArgs: string[],
  globalFormat: "text" | "json",
): "md" | "json" | "both" => {
  if (globalFormat === "json") {
    return "json";
  }

  const format = parseOptionValue(allArgs, "--format");
  if (format === "md" || format === "json" || format === "both") {
    return format;
  }

  return "both";
};

const commandRunners: Record<
  string,
  (context: CommandContext) => Promise<CommandRunResult>
> = {
  demo: async ({ cwd, format, quiet }) => {
    const { runDemo } = await import("./demo.js");
    return runDemo(cwd, { format, quiet });
  },
  init: async ({ cwd, commandArgs, format, quiet, ci }) => {
    const { runInit } = await import("./init.js");
    return runInit(cwd, {
      format,
      quiet,
      ci,
      force: parseFlag(commandArgs, "--force"),
      help: parseFlag(commandArgs, "--help") || parseFlag(commandArgs, "-h"),
    });
  },
  analyze: async ({ cwd, ci, explain, format, quiet }) => {
    const { runAnalyze } = await import("./analyze.js");
    return runAnalyze(cwd, { ci, explain, format, quiet });
  },
  pilot: async ({ cwd, commandArgs, format, quiet }) => {
    const { runPilot } = await import("./pilot.js");
    return runPilot(cwd, {
      format,
      quiet,
      repo: parseOptionValue(commandArgs, "--repo"),
    });
  },
  ignore: async ({ cwd, commandArgs, format, quiet }) => {
    const { runIgnore } = await import("./ignore.js");
    return runIgnore(cwd, commandArgs, { format, quiet });
  },
  'test-triage': async ({ cwd, commandArgs, format, quiet }) => {
    const { runTestTriage } = await import("./testTriage.js");
    return runTestTriage(cwd, {
      format,
      quiet,
      input: parseOptionValue(commandArgs, '--input'),
      help: parseFlag(commandArgs, '--help') || parseFlag(commandArgs, '-h')
    });
  },
  'test-fix-plan': async ({ cwd, commandArgs, format, quiet }) => {
    const { runTestFixPlan } = await import("./testFixPlan.js");
    return runTestFixPlan(cwd, {
      format,
      quiet,
      fromTriage: parseOptionValue(commandArgs, '--from-triage'),
      outFile: parseOptionValue(commandArgs, '--out'),
      help: parseFlag(commandArgs, '--help') || parseFlag(commandArgs, '-h')
    });
  },
  'test-autofix': async ({ cwd, commandArgs, format, quiet }) => {
    const { runTestAutofix } = await import("./testAutofix.js");
    return runTestAutofix(cwd, {
      format,
      quiet,
      input: parseOptionValue(commandArgs, '--input'),
      outFile: parseOptionValue(commandArgs, '--out'),
      dryRun: parseFlag(commandArgs, '--dry-run'),
      confidenceThreshold: parseOptionValue(commandArgs, '--confidence-threshold') ? Number(parseOptionValue(commandArgs, '--confidence-threshold')) : undefined,
      help: parseFlag(commandArgs, '--help') || parseFlag(commandArgs, '-h')
    });
  },
  'remediation-status': async ({ cwd, commandArgs, format, quiet }) => {
    const { runRemediationStatus } = await import("./remediationStatus.js");
    return runRemediationStatus(cwd, {
      format,
      quiet,
      latestResultPath: parseOptionValue(commandArgs, '--latest-result'),
      historyPath: parseOptionValue(commandArgs, '--history'),
      help: parseFlag(commandArgs, '--help') || parseFlag(commandArgs, '-h')
    });
  },
  rendezvous: async ({ cwd, commandArgs, format, quiet }) => {
    const { runRendezvous } = await import("./rendezvous.js");
    return runRendezvous(cwd, commandArgs, {
      format,
      quiet,
      help: parseFlag(commandArgs, '--help') || parseFlag(commandArgs, '-h')
    });
  },
  interop: async ({ cwd, commandArgs, format, quiet }) => {
    const { runInterop } = await import("./interop.js");
    return runInterop(cwd, commandArgs, {
      format,
      quiet,
      help: parseFlag(commandArgs, '--help') || parseFlag(commandArgs, '-h')
    });
  },
  "analyze-pr": async ({ cwd, commandArgs, format, quiet }) => {
    const { runAnalyzePr } = await import("./analyzePr.js");
    return runAnalyzePr(cwd, commandArgs, {
      format: parseAnalyzePrFormat(commandArgs, format),
      quiet,
      baseRef: parseOptionValue(commandArgs, "--base"),
    });
  },

  "review-pr": async ({ cwd, commandArgs, format, quiet }) => {
    const { runReviewPr } = await import("./reviewPr.js");
    return runReviewPr(cwd, {
      format: parseReviewPrFormat(commandArgs, format),
      quiet,
      baseRef: parseOptionValue(commandArgs, "--base"),
      help: parseFlag(commandArgs, "--help") || parseFlag(commandArgs, "-h"),
    });
  },
  verify: async ({ cwd, commandArgs, ci, explain, format, quiet }) => {
    const { runVerify } = await import("./verify.js");
    return runVerify(cwd, {
      ci,
      explain,
      format,
      quiet,
      policy: parseFlag(commandArgs, "--policy"),
      outFile: parseOptionValue(commandArgs, "--out"),
      runId: parseOptionValue(commandArgs, "--run-id"),
      phase: parseOptionValue(commandArgs, "--phase") as never,
      ruleIds: commandArgs.flatMap((arg, index, allArgs) => arg == "--rule" && allArgs[index + 1] ? [String(allArgs[index + 1])] : []),
      help: parseFlag(commandArgs, "--help") || parseFlag(commandArgs, "-h"),
    });
  },
  plan: async ({ cwd, commandArgs, ci, format, quiet }) => {
    const { runPlan } = await import("./plan.js");
    return runPlan(cwd, {
      ci,
      format,
      quiet,
      outFile: parseOptionValue(commandArgs, "--out"),
      runId: parseOptionValue(commandArgs, "--run-id"),
    });
  },
  lanes: async ({ cwd, commandArgs, format, quiet }) => {
    const { runLanes } = await import("./lanes.js");
    const action = commandArgs[0];
    if (action === "start" || action === "complete") {
      return runLanes(cwd, { format, quiet, action, laneId: commandArgs[1] });
    }

    return runLanes(cwd, { format, quiet });
  },
  execute: async ({ cwd, commandArgs, format, quiet }) => {
    const { runExecution } = await import("./execute.js");
    return runExecution(cwd, {
      format,
      quiet,
      help: parseFlag(commandArgs, "--help") || parseFlag(commandArgs, "-h"),
      workerAdapter: parseOptionValue(commandArgs, "--worker-adapter"),
    });
  },
  cycle: async ({ cwd, commandArgs, format, quiet }) => {
    const { runCycle } = await import("./cycle.js");
    return runCycle(cwd, {
      format,
      quiet,
      stopOnError: !parseFlag(commandArgs, "--no-stop-on-error"),
      help: parseFlag(commandArgs, "--help") || parseFlag(commandArgs, "-h"),
    });
  },
  workers: async ({ cwd, commandArgs, format, quiet }) => {
    const { runWorkers } = await import("./workers.js");
    const action = commandArgs[0];
    if (action === "assign") {
      return runWorkers(cwd, { format, quiet, action: "assign" });
    }
    if (action === "submit") {
      return runWorkers(cwd, { format, quiet, action: "submit", from: parseOptionValue(commandArgs, "--from") });
    }
    if (action === "launch-plan") {
      return runWorkers(cwd, { format, quiet, action: "launch-plan" });
    }

    return runWorkers(cwd, { format, quiet });
  },
  orchestrate: async ({ cwd, commandArgs, format, quiet }) => {
    const { runOrchestrate } = await import("./orchestrate.js");
    const lanesValue = parseOptionValue(commandArgs, "--lanes");
    const lanes =
      lanesValue === undefined ? 3 : Number.parseInt(lanesValue, 10);

    if (!Number.isFinite(lanes) || Number.isNaN(lanes) || lanes < 1) {
      const message =
        "playbook orchestrate: --lanes must be a positive integer.";
      if (format === "json") {
        console.log(
          JSON.stringify(
            { schemaVersion: "1.0", command: "orchestrate", error: message },
            null,
            2,
          ),
        );
      } else {
        console.error(message);
      }
      return ExitCode.Failure;
    }

    return runOrchestrate(cwd, {
      format,
      quiet,
      goal: parseOptionValue(commandArgs, "--goal"),
      tasksFile: parseOptionValue(commandArgs, "--tasks-file"),
      lanes,
      outDir:
        parseOptionValue(commandArgs, "--out") ?? ".playbook/orchestrator",
      artifactFormat: parseOrchestrateArtifactFormat(commandArgs, format),
      help: parseFlag(commandArgs, "--help") || parseFlag(commandArgs, "-h"),
    });
  },
  apply: async ({ cwd, commandArgs, ci, format, quiet }) => {
    const { runApply } = await import("./apply.js");
    return runApply(cwd, {
      ci,
      format,
      quiet,
      help: parseFlag(commandArgs, "--help") || parseFlag(commandArgs, "-h"),
      policyCheck: parseFlag(commandArgs, "--policy-check"),
      policy: parseFlag(commandArgs, "--policy"),
      fromPlan: parseOptionValue(commandArgs, "--from-plan"),
      tasks: parseOptionValues(commandArgs, "--task"),
      runId: parseOptionValue(commandArgs, "--run-id"),
    });
  },
  fix: async ({ cwd, commandArgs, ci, explain, format, quiet }) => {
    const { runFix } = await import("./fix.js");
    return runFix(cwd, {
      dryRun: parseFlag(commandArgs, "--dry-run"),
      yes: parseFlag(commandArgs, "--yes"),
      only: parseOptionValue(commandArgs, "--only"),
      ci,
      explain,
      format,
      quiet,
    });
  },
  doctor: async ({ cwd, commandArgs, format, quiet }) => {
    const { runDoctor } = await import("./doctor.js");
    return runDoctor(cwd, {
      ai: parseFlag(commandArgs, "--ai"),
      help: parseFlag(commandArgs, "--help") || parseFlag(commandArgs, "-h"),
      format,
      quiet,
    });
  },
  status: async ({ cwd, ci, format, quiet, commandArgs }) => {
    const { runStatus } = await import("./status.js");
    const scopeArg = commandArgs.find((arg) => !arg.startsWith("-"));
    const proofGate = parseFlag(commandArgs, "--proof-gate");
    const scope =
      scopeArg === "fleet"
        ? "fleet"
        : scopeArg === "queue"
          ? "queue"
          : scopeArg === "execute"
            ? "execute"
            : scopeArg === "receipt"
              ? "receipt"
              : scopeArg === "updated"
                ? "updated"
                : scopeArg === "proof"
                  ? "proof"
                  : "repo";
    return runStatus(cwd, {
      ci,
      format,
      quiet,
      scope,
      proofPolicy: proofGate ? "enforce" : "report",
      enforceProofGate: proofGate,
    });
  },
  upgrade: async ({ cwd, commandArgs, ci, explain, format, quiet }) => {
    const { runUpgrade } = await import("./upgrade.js");
    return runUpgrade(cwd, {
      check: parseFlag(commandArgs, "--check"),
      apply: parseFlag(commandArgs, "--apply"),
      dryRun: parseFlag(commandArgs, "--dry-run"),
      offline: parseFlag(commandArgs, "--offline"),
      from: parseOptionValue(commandArgs, "--from"),
      to: parseOptionValue(commandArgs, "--to"),
      ci,
      explain,
      format,
      quiet,
    });
  },
  release: async ({ cwd, commandArgs, format, quiet }) => {
    const { runRelease } = await import("./release.js");
    return runRelease(cwd, commandArgs, { format, quiet });
  },
  docs: async ({ cwd, commandArgs, ci, format, quiet }) => {
    const { runDocs } = await import("./docs.js");
    return runDocs(cwd, commandArgs, { ci, format, quiet });
  },
  audit: async ({ cwd, commandArgs, format, quiet }) => {
    const { runAuditArchitecture } = await import("./auditArchitecture.js");
    return runAuditArchitecture(cwd, commandArgs, { format, quiet });
  },
  diagram: async ({ cwd, commandArgs, format, quiet }) => {
    const { runDiagram } = await import("./diagram.js");
    const diagramTarget = commandArgs.find((arg) => !arg.startsWith("-"));
    return runDiagram(cwd, {
      repo: parseOptionValue(commandArgs, "--repo") ?? ".",
      out:
        parseOptionValue(commandArgs, "--out") ??
        "docs/ARCHITECTURE_DIAGRAMS.md",
      deps: parseFlag(commandArgs, "--deps"),
      structure: parseFlag(commandArgs, "--structure"),
      format,
      quiet,
      target: diagramTarget,
    });
  },
  explain: async ({ cwd, commandArgs, format, quiet }) => {
    const { runExplain } = await import("./explain.js");
    return runExplain(cwd, commandArgs, { format, quiet });
  },
  context: async ({ cwd, format, quiet }) => {
    const { runContext } = await import("./context.js");
    return runContext(cwd, { format, quiet });
  },
  "ai-context": async ({ cwd, format, quiet }) => {
    const { runAiContext } = await import("./aiContext.js");
    return runAiContext(cwd, { format, quiet });
  },
  "ai-contract": async ({ cwd, format, quiet }) => {
    const { runAiContract } = await import("./aiContract.js");
    return runAiContract(cwd, { format, quiet });
  },
  ai: async ({ cwd, commandArgs, format, quiet }) => {
    const { runAi } = await import('./ai.js');
    return runAi(cwd, commandArgs, {
      format,
      quiet,
      outFile: parseOptionValue(commandArgs, '--out')
    });
  },
  contracts: async ({ cwd, commandArgs, format, quiet }) => {
    const { runContracts } = await import("./contracts.js");
    return runContracts(cwd, {
      format,
      quiet,
      out: parseOptionValue(commandArgs, "--out"),
    });
  },
  schema: async ({ cwd, commandArgs, format, quiet }) => {
    const { runSchema } = await import("./schema.js");
    return runSchema(cwd, commandArgs, { format, quiet });
  },
  memory: async ({ cwd, commandArgs, format, quiet }) => {
    const { runMemory } = await import("./memory.js");
    return runMemory(cwd, commandArgs, { format, quiet });
  },
  story: async ({ cwd, commandArgs, format, quiet }) => {
    const { runStory } = await import("./story.js");
    return runStory(cwd, commandArgs, { format, quiet });
  },
  promote: async ({ cwd, commandArgs, format, quiet }) => {
    const { runPromote } = await import("./promote.js");
    return runPromote(cwd, commandArgs, { format, quiet });
  },
  knowledge: async ({ cwd, commandArgs, format, quiet }) => {
    const { runKnowledge } = await import("./knowledge.js");
    return runKnowledge(cwd, commandArgs, { format, quiet });
  },
  security: async ({ cwd, commandArgs, format, quiet }) => {
    const { runSecurity } = await import("./security.js");
    return runSecurity(cwd, commandArgs, { format, quiet });
  },
  telemetry: async ({ cwd, commandArgs, format, quiet }) => {
    const { runTelemetry } = await import("./telemetry.js");
    return runTelemetry(cwd, commandArgs, {
      format,
      quiet,
      help: parseFlag(commandArgs, "--help") || parseFlag(commandArgs, "-h"),
    });
  },
  commit: async ({ cwd, commandArgs, format, quiet }) => {
    const { runCommit } = await import("./commit.js");
    return runCommit(cwd, commandArgs, {
      format,
      quiet,
      help: parseFlag(commandArgs, "--help") || parseFlag(commandArgs, "-h"),
    });
  },
  policy: async ({ cwd, commandArgs, format, quiet }) => {
    const { runPolicy } = await import("./policy.js");
    return runPolicy(cwd, commandArgs, {
      format,
      quiet,
      help: parseFlag(commandArgs, "--help") || parseFlag(commandArgs, "-h"),
    });
  },
  improve: async ({ cwd, commandArgs, format, quiet }) => {
    const {
      runImprove,
      runImproveCommands,
      runImproveOpportunities,
      runImproveApplySafe,
      runImproveApprove,
    } = await import("./improve.js");
    const help =
      parseFlag(commandArgs, "--help") || parseFlag(commandArgs, "-h");
    const subcommand = commandArgs.find((arg) => !arg.startsWith("-"));

    if (subcommand === "opportunities") {
      return runImproveOpportunities(cwd, { format, quiet, help });
    }

    if (subcommand === "commands") {
      return runImproveCommands(cwd, { format, quiet, help });
    }

    if (subcommand === "apply-safe") {
      return runImproveApplySafe(cwd, { format, quiet, help });
    }

    if (subcommand === "approve") {
      const proposalId = commandArgs.find(
        (arg, index) =>
          index > commandArgs.indexOf("approve") && !arg.startsWith("-"),
      );
      return runImproveApprove(cwd, proposalId, { format, quiet, help });
    }

    return runImprove(cwd, { format, quiet, help });
  },
  agent: async ({ cwd, commandArgs, format, quiet }) => {
    const { runAgent } = await import("./agent.js");
    return runAgent(cwd, commandArgs, { format, quiet });
  },
  receipt: async ({ cwd, commandArgs, format, quiet }) => {
    const { runReceipt } = await import("./receipt.js");
    return runReceipt(cwd, commandArgs, { format, quiet });
  },
  observer: async ({ cwd, commandArgs, format, quiet }) => {
    const { runObserver } = await import("./observer.js");
    return runObserver(cwd, commandArgs, { format, quiet });
  },
  learn: async ({ cwd, commandArgs, format, quiet }) => {
    const { runLearnDraft } = await import("./learnDraft.js");
    const { runLearnDoctrine } = await import("./learnDoctrine.js");
    const subcommand = commandArgs.find((arg) => !arg.startsWith("-"));

    if (subcommand !== "draft" && subcommand !== "doctrine") {
      const message =
        'playbook learn: unsupported subcommand. Use "playbook learn draft" or "playbook learn doctrine".';
      if (format === "json") {
        console.log(
          JSON.stringify(
            { schemaVersion: "1.0", command: "learn", error: message },
            null,
            2,
          ),
        );
      } else {
        console.error(message);
      }
      return ExitCode.Failure;
    }

    const subcommandArgs = commandArgs.filter((arg, index) => {
      if (index === 0 && arg === subcommand) {
        return false;
      }
      return true;
    });

    if (subcommand === "doctrine") {
      return runLearnDoctrine(cwd, subcommandArgs, {
        format,
        quiet,
        inputPath: parseOptionValue(subcommandArgs, "--input"),
        summaryText: parseOptionValue(subcommandArgs, "--summary"),
      });
    }

    return runLearnDraft(cwd, subcommandArgs, {
      format,
      quiet,
      outFile: parseOptionValue(subcommandArgs, "--out"),
      baseRef: parseOptionValue(subcommandArgs, "--base"),
      diffContext: parseLearnDiffContext(subcommandArgs),
      appendNotes: parseFlag(subcommandArgs, "--append-notes"),
    });
  },
  rules: async ({ cwd, explain, format, quiet }) => {
    const { runRules } = await import("./rules.js");
    return runRules(cwd, { explain, format, quiet });
  },
  index: async ({ cwd, commandArgs, format, quiet }) => {
    const { runIndex } = await import("./repoIndex.js");
    return runIndex(cwd, {
      format,
      quiet,
      outFile: parseOptionValue(commandArgs, "--out"),
    });
  },
  graph: async ({ cwd, format, quiet }) => {
    const { runGraph } = await import("./graph.js");
    return runGraph(cwd, { format, quiet });
  },
  ask: async ({ cwd, commandArgs, format, quiet }) => {
    const { runAsk } = await import("./ask.js");
    return runAsk(cwd, commandArgs, {
      format,
      quiet,
      mode: parseOptionValue(commandArgs, "--mode"),
      repoContext: parseFlag(commandArgs, "--repo-context"),
      module: parseOptionValue(commandArgs, "--module"),
      diffContext: parseFlag(commandArgs, "--diff-context"),
      base: parseOptionValue(commandArgs, "--base"),
      withRepoContextMemory: parseFlag(
        commandArgs,
        "--with-repo-context-memory",
      ),
      withDiffContextMemory: parseFlag(
        commandArgs,
        "--with-diff-context-memory",
      ),
    });
  },
  deps: async ({ cwd, commandArgs, format, quiet }) => {
    const { runDeps } = await import("./deps.js");
    return runDeps(cwd, commandArgs, { format, quiet });
  },
  route: async ({ cwd, commandArgs, format, quiet }) => {
    const { runRoute } = await import("./route.js");
    return runRoute(cwd, commandArgs, {
      format,
      quiet,
      codexPrompt: parseFlag(commandArgs, "--codex-prompt"),
      help: parseFlag(commandArgs, "--help") || parseFlag(commandArgs, "-h"),
    });
  },
  query: async ({ cwd, commandArgs, format, quiet }) => {
    const { runQuery } = await import("./query.js");
    return runQuery(cwd, commandArgs, {
      format,
      quiet,
      outFile: parseOptionValue(commandArgs, "--out"),
    });
  },
  architecture: async ({ cwd, commandArgs, format, quiet }) => {
    const { runArchitecture } = await import("./architecture.js");
    return runArchitecture(cwd, commandArgs, { format, quiet });
  },
  session: async ({ cwd, commandArgs, format, quiet }) => {
    const { runSession } = await import("./session.js");
    return runSession(cwd, commandArgs, { format, quiet });
  },
  patterns: async ({ cwd, commandArgs, format, quiet }) => {
    const { runPatterns } = await import("./patterns.js");
    return runPatterns(cwd, commandArgs, {
      format,
      quiet,
      outFile: parseOptionValue(commandArgs, "--out"),
    });
  },
};

const commandOrder = [
  "demo",
  "init",
  "analyze",
  "pilot",
  "analyze-pr",
  "review-pr",
  "ignore",
  "test-triage",
  "test-fix-plan",
  "test-autofix",
  "remediation-status",
  "rendezvous",
  "interop",
  "verify",
  "plan",
  "orchestrate",
  "lanes",
  "workers",
  "execute",
  "cycle",
  "apply",
  "commit",
  "fix",
  "doctor",
  "status",
  "upgrade",
  "diagram",
  "explain",
  "context",
  "ai-context",
  "ai-contract",
  "ai",
  "contracts",
  "release",
  "docs",
  "audit",
  "schema",
  "rules",
  "index",
  "graph",
  "ask",
  "deps",
  "query",
  "route",
  "architecture",
  "session",
  "patterns",
  "story",
  "promote",
  "learn",
  "memory",
  "improve",
  "knowledge",
  "security",
  "telemetry",
  "policy",
  "agent",
  "observer",
  "receipt",
] as const;

const metadataByName = new Map(
  commandMetadata.map((command) => [command.name, command]),
);

export const commandRegistry: RegisteredCommand[] = commandOrder.map((name) => {
  const metadata = metadataByName.get(name);
  const run = commandRunners[name];

  if (!metadata || !run) {
    throw new Error(`Command registry is out of sync for "${name}"`);
  }

  return {
    name: metadata.name,
    description: metadata.description,
    run,
  };
});

const commandMap = new Map(
  commandRegistry.map((command) => [command.name, command]),
);

export const listRegisteredCommands = (): RegisteredCommand[] => [
  ...commandRegistry,
];

export const hasRegisteredCommand = (commandName: string): boolean =>
  commandMap.has(commandName);

export type CommandExecutionResult = {
  exitCode: number;
  childCommands: string[];
};

export const runRegisteredCommand = async (
  commandName: string,
  context: CommandContext,
): Promise<CommandExecutionResult> => {
  const command = commandMap.get(commandName);
  if (!command) {
    return { exitCode: ExitCode.Failure, childCommands: [] };
  }

  const result = await command.run(context);
  if (typeof result === "number") {
    return { exitCode: result, childCommands: [] };
  }

  return {
    exitCode: result.exitCode,
    childCommands: result.childCommands ?? [],
  };
};
