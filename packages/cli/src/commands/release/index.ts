import fs from 'node:fs';
import path from 'node:path';
import { ExitCode } from '../../lib/cliContract.js';
import { runApply } from '../apply.js';

type ReleaseCommandOptions = {
  format: 'text' | 'json';
  quiet: boolean;
};

type ReleasePlanPayload = {
  summary: {
    recommendedBump: string;
    reasons: string[];
  };
};

type ReleaseSyncPayload = {
  schemaVersion: '1.0';
  kind: 'playbook-release-sync';
  hasDrift: boolean;
  plan: ReleasePlanPayload & { tasks?: Array<{ id: string; file: string | null; action: string; task_kind: string }> };
  governanceFailures: Array<{ id: string; message: string }>;
  actionableTasks: Array<{ id: string; file: string | null; action: string; task_kind: string }>;
  drift: Array<{ taskId: string; file: string; reason: string; expected: string; actual: string }>;
};

const DEFAULT_OUT = '.playbook/release-plan.json';

const printReleaseHelp = (): void => {
  console.log(`Usage: playbook release <subcommand> [options]

Subcommands:
  plan                       Build a deterministic release/version plan
  sync                       Plan + detect/apply unapplied release updates

Options for \`release plan\`:
  --base <ref>               Optional git base ref used for diff resolution
  --out <path>               Write the plan artifact (default: ${DEFAULT_OUT})
  --json                     Print machine-readable JSON output

Options for \`release sync\`:
  --base <ref>               Optional git base ref used for diff resolution
  --out <path>               Write the synchronized plan artifact (default: ${DEFAULT_OUT})
  --check                    Check-only mode (do not apply changes)
  --json                     Print machine-readable JSON output
  --help                     Show help`);
};

export const runRelease = async (
  cwd: string,
  args: string[],
  options: ReleaseCommandOptions
): Promise<number> => {
  const subcommand = args.find((arg) => !arg.startsWith('-'));
  if (!subcommand || args.includes('--help') || args.includes('-h')) {
    printReleaseHelp();
    return subcommand ? ExitCode.Success : ExitCode.Failure;
  }

  if (!['plan', 'sync'].includes(subcommand)) {
    const message = 'playbook release: unsupported subcommand. Use "playbook release plan" or "playbook release sync".';
    if (options.format === 'json') {
      console.log(JSON.stringify({ schemaVersion: '1.0', command: 'release', error: message }, null, 2));
    } else {
      console.error(message);
    }
    return ExitCode.Failure;
  }

  const baseIndex = args.indexOf('--base');
  const outIndex = args.indexOf('--out');
  const baseRef = baseIndex >= 0 ? args[baseIndex + 1] : undefined;
  const outFile = outIndex >= 0 ? args[outIndex + 1] : DEFAULT_OUT;

  try {
    const engine = await import('@zachariahredfield/playbook-engine');
    const typedEngine = engine as unknown as {
      buildReleasePlan: (repoRoot: string, options?: { baseRef?: string }) => ReleasePlanPayload;
      assessReleaseSync: (repoRoot: string, options?: { baseRef?: string; mode?: 'check' | 'apply' }) => ReleaseSyncPayload;
    };

    if (subcommand === 'plan') {
      const payload = typedEngine.buildReleasePlan(cwd, { baseRef });
      const absoluteOutputPath = path.resolve(cwd, outFile);
      fs.mkdirSync(path.dirname(absoluteOutputPath), { recursive: true });
      fs.writeFileSync(absoluteOutputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

      if (options.format === 'json') {
        console.log(JSON.stringify(payload, null, 2));
        return ExitCode.Success;
      }

      if (!options.quiet) {
        console.log(`playbook release plan: ${payload.summary.recommendedBump}`);
        console.log(`artifact: ${outFile}`);
        for (const reason of payload.summary.reasons) {
          console.log(`- ${reason}`);
        }
      }

      return ExitCode.Success;
    }

    const checkOnly = args.includes('--check');
    const initial = typedEngine.assessReleaseSync(cwd, { baseRef, mode: checkOnly ? 'check' : 'apply' });
    const absoluteOutputPath = path.resolve(cwd, outFile);
    fs.mkdirSync(path.dirname(absoluteOutputPath), { recursive: true });
    fs.writeFileSync(absoluteOutputPath, `${JSON.stringify(initial.plan, null, 2)}\n`, 'utf8');

    if (!checkOnly && initial.hasDrift && initial.actionableTasks.length > 0) {
      const applyExitCode = await runApply(cwd, {
        format: 'json',
        ci: false,
        quiet: true,
        fromPlan: outFile
      });
      if (applyExitCode !== ExitCode.Success) {
        if (options.format === 'json') {
          console.log(JSON.stringify({
            schemaVersion: '1.0',
            command: 'release',
            subcommand: 'sync',
            error: 'release sync: failed to apply reviewed release tasks through apply --from-plan',
            sync: initial
          }, null, 2));
        } else {
          console.error('release sync: failed to apply reviewed release tasks through apply --from-plan');
        }
        return ExitCode.Failure;
      }
    }
    const payload = checkOnly ? initial : typedEngine.assessReleaseSync(cwd, { baseRef, mode: 'check' });

    if (options.format === 'json') {
      console.log(JSON.stringify(payload, null, 2));
      return payload.hasDrift ? ExitCode.Failure : ExitCode.Success;
    }

    if (!options.quiet) {
      console.log(`playbook release sync: ${payload.hasDrift ? 'drift-detected' : 'aligned'}`);
      console.log(`artifact: ${outFile}`);
      if (payload.hasDrift) {
        console.log('Actionable tasks:');
        for (const task of payload.actionableTasks) {
          console.log(`- ${task.id} ${task.file ?? '<none>'}: ${task.action}`);
        }
        if (checkOnly) {
          console.log('Check-only mode detected drift. Run `pnpm playbook release sync` to apply the reviewed release plan.');
        } else {
          console.log('Drift detected and apply attempted via `playbook apply --from-plan`.');
        }
      }
    }

    return payload.hasDrift ? ExitCode.Failure : ExitCode.Success;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (options.format === 'json') {
      console.log(JSON.stringify({ schemaVersion: '1.0', command: 'release', error: message }, null, 2));
    } else {
      console.error(message);
    }
    return ExitCode.Failure;
  }
};
