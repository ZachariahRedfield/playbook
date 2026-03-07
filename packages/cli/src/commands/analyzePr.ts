import { analyzePullRequest } from '@zachariahredfield/playbook-engine';
import { ExitCode } from '../lib/cliContract.js';

type AnalyzePrOptions = {
  format: 'text' | 'json';
  quiet: boolean;
  baseRef?: string;
};

const printAnalyzePrHelp = (): void => {
  console.log(`Usage: playbook analyze-pr [options]

Analyze current branch/worktree changes as deterministic PR intelligence using local git diff plus Playbook repository intelligence.

Options:
  --base <ref>   Optional git base ref used for diff resolution
  --json         Print machine-readable JSON output
  --help         Show help`);
};

const printHuman = (payload: ReturnType<typeof analyzePullRequest>): void => {
  console.log('Playbook Pull Request Analysis');
  console.log('');
  console.log(`Base ref: ${payload.baseRef}`);
  console.log(`Changed files: ${payload.summary.changedFileCount}`);
  console.log(`Affected modules: ${payload.summary.affectedModuleCount}`);
  console.log(`Risk: ${payload.risk.level}`);
  console.log('');

  console.log('Changed files');
  if (payload.changedFiles.length === 0) {
    console.log('  - none');
  } else {
    for (const file of payload.changedFiles) {
      console.log(`  - ${file}`);
    }
  }
  console.log('');

  console.log('Affected modules');
  if (payload.affectedModules.length === 0) {
    console.log('  - none');
  } else {
    for (const moduleName of payload.affectedModules) {
      console.log(`  - ${moduleName}`);
    }
  }
  console.log('');

  console.log('Review guidance');
  for (const entry of payload.reviewGuidance) {
    console.log(`  - ${entry}`);
  }
};

export const runAnalyzePr = async (cwd: string, commandArgs: string[], options: AnalyzePrOptions): Promise<number> => {
  if (commandArgs.includes('--help') || commandArgs.includes('-h')) {
    printAnalyzePrHelp();
    return ExitCode.Success;
  }

  try {
    const payload = analyzePullRequest(cwd, { baseRef: options.baseRef });

    if (options.format === 'json') {
      console.log(JSON.stringify(payload, null, 2));
      return ExitCode.Success;
    }

    if (!options.quiet) {
      printHuman(payload);
    }

    return ExitCode.Success;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (options.format === 'json') {
      console.log(
        JSON.stringify(
          {
            schemaVersion: '1.0',
            command: 'analyze-pr',
            error: message
          },
          null,
          2
        )
      );
    } else {
      console.error(message);
    }

    return ExitCode.Failure;
  }
};
