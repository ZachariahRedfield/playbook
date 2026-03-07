import { analyzePullRequest, formatAnalyzePrOutput } from '@zachariahredfield/playbook-engine';
import { ExitCode } from '../lib/cliContract.js';

type AnalyzePrOptions = {
  format: 'text' | 'json' | 'github-comment' | 'github-review';
  quiet: boolean;
  baseRef?: string;
};

const printAnalyzePrHelp = (): void => {
  console.log(`Usage: playbook analyze-pr [options]

Analyze current branch/worktree changes as deterministic PR intelligence using local git diff plus Playbook repository intelligence.

Options:
  --base <ref>   Optional git base ref used for diff resolution
  --json         Print machine-readable JSON output
  --format <type> Output format (text|json|github-comment|github-review)
  --help         Show help`);
};

const validateAnalyzePrFormat = (commandArgs: string[]): string | null => {
  const formatIndex = commandArgs.indexOf('--format');
  if (formatIndex < 0) {
    return null;
  }

  const value = commandArgs[formatIndex + 1];
  if (!value || ['text', 'json', 'github-comment', 'github-review'].includes(value)) {
    return null;
  }

  return `Unsupported analyze-pr format "${value}". Use one of: text, json, github-comment, github-review.`;
};

export const runAnalyzePr = async (cwd: string, commandArgs: string[], options: AnalyzePrOptions): Promise<number> => {
  if (commandArgs.includes('--help') || commandArgs.includes('-h')) {
    printAnalyzePrHelp();
    return ExitCode.Success;
  }

  const formatError = validateAnalyzePrFormat(commandArgs);
  if (formatError) {
    if (options.format === 'json') {
      console.log(
        JSON.stringify(
          {
            schemaVersion: '1.0',
            command: 'analyze-pr',
            error: formatError
          },
          null,
          2
        )
      );
    } else {
      console.error(formatError);
    }

    return ExitCode.Failure;
  }

  try {
    const payload = analyzePullRequest(cwd, { baseRef: options.baseRef });

    if (options.quiet && options.format === 'text') {
      return ExitCode.Success;
    }

    console.log(formatAnalyzePrOutput(payload, options.format));
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
