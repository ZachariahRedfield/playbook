import { answerRepositoryQuestion } from '@zachariahredfield/playbook-engine';
import { loadAskRepoContext } from '../ai/repoContext.js';
import { getResponseModeInstruction, parseResponseMode, type ResponseMode } from '../ai/responseModes.js';
import { ExitCode } from '../lib/cliContract.js';

type AskOptions = {
  format: 'text' | 'json';
  quiet: boolean;
  mode?: string;
  repoContext?: boolean;
  module?: string;
};

type AskResult = {
  command: 'ask';
  question: string;
  mode: ResponseMode;
  modeInstruction: string;
  answer: string;
  reason: string;
  repoContext: {
    enabled: boolean;
    sources: string[];
  };
  context: {
    architecture: string;
    framework: string;
    modules: string[];
    module?: unknown;
  };
};

type ParsedAskInput = {
  help: boolean;
  question?: string;
};

const parseAskInput = (args: string[]): ParsedAskInput => {
  const tokens: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--help' || arg === '-h') {
      return { help: true };
    }

    if (arg === '--mode' || arg === '--module') {
      index += 1;
      continue;
    }

    if (arg.startsWith('-')) {
      continue;
    }

    tokens.push(arg);
  }

  if (tokens.length === 0) {
    return { help: false };
  }

  return {
    help: false,
    question: tokens.join(' ')
  };
};

const formatAnswerForMode = (answer: string, reason: string, mode: ResponseMode): string => {
  if (mode === 'normal') {
    return answer;
  }

  if (mode === 'concise') {
    return `${answer} (${reason})`;
  }

  return [`- ${answer}`, `- Why: ${reason}`].join('\n');
};

const showAskHelp = (): void => {
  console.log(`Usage: playbook ask <question> [options]

Answer repository questions from machine-readable intelligence context.

Options:
  --mode <mode>              Controls response verbosity
                             normal   Full explanation (default)
                             concise  Compressed but informative
                             ultra    Maximum compression
  --repo-context             Inject trusted repository intelligence into ask context
                             using Playbook-managed artifacts (for example
                             .playbook/repo-index.json and .playbook/ai-contract.json)
  --module <name>            Scope ask reasoning to indexed module intelligence from
                             .playbook/repo-index.json
  --help                     Show help`);
};

export const runAsk = async (cwd: string, commandArgs: string[], options: AskOptions): Promise<number> => {
  const parsedInput = parseAskInput(commandArgs);

  if (parsedInput.help) {
    showAskHelp();
    return ExitCode.Success;
  }

  const questionArg = parsedInput.question;
  if (!questionArg) {
    console.error('playbook ask: missing required <question> argument');
    return ExitCode.Failure;
  }

  try {
    const mode = parseResponseMode(options.mode);
    const repoContext = loadAskRepoContext({ cwd, enabled: options.repoContext ?? false });
    const moduleContextPrefix = options.module ? `Scoped module context: ${options.module}` : '';
    const enrichedQuestion = repoContext.enabled
      ? `${moduleContextPrefix}${moduleContextPrefix.length > 0 ? '\n' : ''}${repoContext.promptContext}\n\nUser question: ${questionArg}`
      : questionArg;
    const answer = answerRepositoryQuestion(cwd, enrichedQuestion, { module: options.module });
    const modeInstruction = getResponseModeInstruction(mode);
    const answerForMode = formatAnswerForMode(answer.answer, answer.reason, mode);

    const result: AskResult = {
      command: 'ask',
      question: answer.question,
      mode,
      modeInstruction,
      answer: answerForMode,
      reason: answer.reason,
      repoContext: {
        enabled: repoContext.enabled,
        sources: repoContext.sources
      },
      context: answer.context
    };

    if (options.format === 'json') {
      console.log(JSON.stringify(result, null, 2));
      return ExitCode.Success;
    }

    if (!options.quiet) {
      console.log(result.answer);

      if (mode === 'normal') {
        console.log('');
        console.log('Reason');
        console.log(result.reason);
      }
    }

    return ExitCode.Success;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (options.format === 'json') {
      console.log(
        JSON.stringify(
          {
            command: 'ask',
            question: questionArg,
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
