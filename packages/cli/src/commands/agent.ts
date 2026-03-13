import {
  listRuntimeLogRecords,
  listRuntimeRuns,
  listRuntimeTasks,
  readRuntimeControlPlaneStatus,
  readRuntimeRun,
  runAgentPlanDryRun
} from '@zachariahredfield/playbook-engine';
import { emitJsonOutput } from '../lib/jsonArtifact.js';
import { ExitCode } from '../lib/cliContract.js';

type AgentOptions = {
  format: 'text' | 'json';
  quiet: boolean;
};

const printAgentHelp = (): void => {
  console.log(`Usage: playbook agent <subcommand> [options]

Read-only control-plane runtime surfaces.

Subcommands:
  runs                           List runtime runs
  run --from-plan <path> --dry-run
                                 Compile a plan and preview dry-run scheduling/policy output
  show <run-id>                  Show one runtime run
  tasks --run-id <run-id>        List tasks for one run
  logs --run-id <run-id>         List log records for one run
  status                         Show runtime control-plane status

Options:
  --run-id <id>              Run identifier for tasks/logs
  --from-plan <path>         Plan artifact path for agent run dry-run
  --dry-run                  Required for agent run (live execution is not available)
  --json                     Print machine-readable JSON output
  --help                     Show help`);
};

const readOptionValue = (args: string[], optionName: string): string | null => {
  const exactIndex = args.findIndex((arg) => arg === optionName);
  if (exactIndex >= 0) {
    return args[exactIndex + 1] ?? null;
  }

  const prefixed = args.find((arg) => arg.startsWith(`${optionName}=`));
  if (!prefixed) {
    return null;
  }

  return prefixed.slice(optionName.length + 1) || null;
};

const requireRunId = (args: string[], command: string): string => {
  const runId = readOptionValue(args, '--run-id');
  if (!runId) {
    throw new Error(`playbook agent ${command}: missing required --run-id <id> option`);
  }
  return runId;
};

const resolvePositionalRunId = (args: string[]): string | null => {
  const positional = args.filter((arg) => !arg.startsWith('-'));
  return positional.length > 1 ? positional[1] ?? null : null;
};

export const runAgent = async (cwd: string, args: string[], options: AgentOptions): Promise<number> => {
  const subcommand = args.find((arg) => !arg.startsWith('-'));

  if (!subcommand || args.includes('--help') || args.includes('-h')) {
    printAgentHelp();
    return subcommand ? ExitCode.Success : ExitCode.Failure;
  }

  try {
    if (subcommand === 'runs') {
      const payload = {
        schemaVersion: '1.0',
        command: 'agent-runs',
        runs: listRuntimeRuns(cwd)
      };

      if (options.format === 'json') {
        emitJsonOutput({ cwd, command: 'agent runs', payload });
      } else if (!options.quiet) {
        console.log(`Found ${payload.runs.length} runs.`);
      }
      return ExitCode.Success;
    }

    if (subcommand === 'show') {
      const runId = resolvePositionalRunId(args);
      if (!runId) {
        throw new Error('playbook agent show: missing required <run-id> argument');
      }

      const run = readRuntimeRun(cwd, runId);
      if (!run) {
        throw new Error(`playbook agent show: run not found: ${runId}`);
      }

      const payload = {
        schemaVersion: '1.0',
        command: 'agent-show',
        run
      };

      if (options.format === 'json') {
        emitJsonOutput({ cwd, command: 'agent show', payload });
      } else if (!options.quiet) {
        console.log(`Run ${run.runId}: state=${run.state}`);
      }
      return ExitCode.Success;
    }

    if (subcommand === 'run') {
      const fromPlan = readOptionValue(args, '--from-plan');
      if (!fromPlan) {
        throw new Error('playbook agent run: missing required --from-plan <path> option');
      }

      if (!args.includes('--dry-run')) {
        throw new Error('playbook agent run: --dry-run is required in this release; live execution is not available');
      }

      const payload = {
        schemaVersion: '1.0',
        command: 'agent-run',
        dryRun: true,
        ...runAgentPlanDryRun({
          repoRoot: cwd,
          fromPlanPath: fromPlan
        })
      };

      if (options.format === 'json') {
        emitJsonOutput({ cwd, command: 'agent run', payload });
      } else if (!options.quiet) {
        console.log(
          `Dry-run compiled ${payload.compiledTaskCount} tasks (ready=${payload.readyBlockedSummary.readyCount}, blocked=${payload.readyBlockedSummary.blockedCount}).`
        );
      }
      return ExitCode.Success;
    }

    if (subcommand === 'tasks') {
      const runId = requireRunId(args, 'tasks');
      const payload = {
        schemaVersion: '1.0',
        command: 'agent-tasks',
        runId,
        tasks: listRuntimeTasks(cwd, runId)
      };

      if (options.format === 'json') {
        emitJsonOutput({ cwd, command: 'agent tasks', payload });
      } else if (!options.quiet) {
        console.log(`Found ${payload.tasks.length} tasks for ${runId}.`);
      }
      return ExitCode.Success;
    }

    if (subcommand === 'logs') {
      const runId = requireRunId(args, 'logs');
      const payload = {
        schemaVersion: '1.0',
        command: 'agent-logs',
        runId,
        logs: listRuntimeLogRecords(cwd, runId)
      };

      if (options.format === 'json') {
        emitJsonOutput({ cwd, command: 'agent logs', payload });
      } else if (!options.quiet) {
        console.log(`Found ${payload.logs.length} logs for ${runId}.`);
      }
      return ExitCode.Success;
    }

    if (subcommand === 'status') {
      const payload = readRuntimeControlPlaneStatus(cwd);

      if (options.format === 'json') {
        emitJsonOutput({ cwd, command: 'agent status', payload });
      } else if (!options.quiet) {
        console.log(`Runtime runs=${payload.runCount}, tasks=${payload.taskCount}, logs=${payload.logCount}`);
      }
      return ExitCode.Success;
    }

    throw new Error('playbook agent: unsupported subcommand. Use runs, run, show, tasks, logs, or status.');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (options.format === 'json') {
      console.log(JSON.stringify({ schemaVersion: '1.0', command: `agent-${subcommand}`, error: message }, null, 2));
    } else {
      console.error(message);
    }

    return ExitCode.Failure;
  }
};
