import { answerRepositoryQuestion } from '@zachariahredfield/playbook-engine';
import { ExitCode } from '../lib/cliContract.js';

type AskOptions = {
  format: 'text' | 'json';
  quiet: boolean;
};

type AskResult = {
  command: 'ask';
  question: string;
  answer: string;
  reason: string;
  context: {
    architecture: string;
    framework: string;
    modules: string[];
  };
};

const questionFromArgs = (args: string[]): string | undefined => {
  const tokens = args.filter((arg) => !arg.startsWith('-'));
  if (tokens.length === 0) {
    return undefined;
  }

  return tokens.join(' ');
};

export const runAsk = async (cwd: string, commandArgs: string[], options: AskOptions): Promise<number> => {
  const questionArg = questionFromArgs(commandArgs);
  if (!questionArg) {
    console.error('playbook ask: missing required <question> argument');
    return ExitCode.Failure;
  }

  try {
    const answer = answerRepositoryQuestion(cwd, questionArg);
    const result: AskResult = {
      command: 'ask',
      question: answer.question,
      answer: answer.answer,
      reason: answer.reason,
      context: answer.context
    };

    if (options.format === 'json') {
      console.log(JSON.stringify(result, null, 2));
      return ExitCode.Success;
    }

    if (!options.quiet) {
      console.log(result.answer);
      console.log('');
      console.log('Reason');
      console.log(result.reason);
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
