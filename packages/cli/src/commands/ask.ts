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
  diffContext?: boolean;
  base?: string;
};

type AskResult = {
  answerability: {
    state: 'answered-from-trusted-artifact' | 'artifact-missing' | 'artifact-stale' | 'unsupported-question';
    artifact?: string;
  };
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
  scope: {
    module?: string;
    diffContext: {
      enabled: boolean;
      baseRef?: string;
    };
  };
  context: {
    architecture: string;
    framework: string;
    modules: string[];
    module?: unknown;
    moduleDigest?: unknown;
    diff?: unknown;
    sources: ContextSource[];
  };
};

type ContextSource = {
  type: 'repo-index' | 'repo-graph' | 'architecture-metadata' | 'rule-registry' | 'module' | 'module-digest' | 'diff' | 'docs' | 'ai-contract';
  path?: string;
  name?: string;
  files?: string[];
};

type AskContextSnapshot = AskResult['context'];

const REPO_INDEX_PATH = '.playbook/repo-index.json' as const;
const AI_CONTRACT_PATH = '.playbook/ai-contract.json' as const;

const toUniqueSortedStrings = (values: unknown): string[] => {
  if (!Array.isArray(values)) {
    return [];
  }

  const unique = new Set<string>();
  for (const value of values) {
    if (typeof value === 'string' && value.length > 0) {
      unique.add(value);
    }
  }

  return Array.from(unique).sort((left, right) => left.localeCompare(right));
};

const buildContextSources = (context: AskContextSnapshot, repoContextSources: string[], moduleName?: string): ContextSource[] => {
  const sources: ContextSource[] = [
    { type: 'repo-index', path: REPO_INDEX_PATH },
    { type: 'repo-graph', path: '.playbook/repo-graph.json' },
    { type: 'architecture-metadata', path: REPO_INDEX_PATH },
    { type: 'rule-registry', path: REPO_INDEX_PATH }
  ];

  if (repoContextSources.includes(AI_CONTRACT_PATH) || repoContextSources.includes('generated-ai-contract-fallback')) {
    sources.push({
      type: 'ai-contract',
      path: repoContextSources.includes(AI_CONTRACT_PATH) ? AI_CONTRACT_PATH : 'generated-ai-contract-fallback'
    });
  }

  if (typeof moduleName === 'string' && moduleName.length > 0) {
    sources.push({ type: 'module', name: moduleName });
  }

  if (context.moduleDigest && typeof context.moduleDigest === 'object') {
    const digestModule = (context.moduleDigest as { module?: { name?: unknown } }).module;
    const digestName = digestModule && typeof digestModule.name === 'string' ? digestModule.name : moduleName;
    if (typeof digestName === 'string' && digestName.length > 0) {
      sources.push({ type: 'module-digest', path: `.playbook/context/modules/${digestName.replace(/[\/]/g, '__')}.json` });
    }
  }

  if (context.diff && typeof context.diff === 'object' && !Array.isArray(context.diff)) {
    const diffRecord = context.diff as { changedFiles?: unknown; docs?: unknown };
    const changedFiles = toUniqueSortedStrings(diffRecord.changedFiles);
    sources.push({ type: 'diff', files: changedFiles });

    const docs = toUniqueSortedStrings(diffRecord.docs);
    for (const docsPath of docs) {
      sources.push({ type: 'docs', path: docsPath });
    }
  }

  return sources;
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

    if (arg === '--mode' || arg === '--module' || arg === '--base') {
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
  --diff-context             Scope ask reasoning to changed files mapped through
                             .playbook/repo-index.json (requires git diff + index)
  --base <ref>               Optional git base ref used with --diff-context
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
    if (options.module && options.diffContext) {
      throw new Error('playbook ask: --module and --diff-context cannot be used together. Choose one deterministic scope.');
    }

    const mode = parseResponseMode(options.mode);
    const repoContext = loadAskRepoContext({ cwd, enabled: options.repoContext ?? false });
    const moduleContextPrefix = options.module ? `Scoped module context: ${options.module}` : '';
    const diffContextPrefix = options.diffContext
      ? `Diff context enabled${options.base ? ` (base: ${options.base})` : ''}`
      : '';
    const scopesPrefix = [moduleContextPrefix, diffContextPrefix].filter((value) => value.length > 0).join('\n');
    const enrichedQuestion = repoContext.enabled
      ? `${scopesPrefix}${scopesPrefix.length > 0 ? '\n' : ''}${repoContext.promptContext}\n\nUser question: ${questionArg}`
      : questionArg;
    const answer = answerRepositoryQuestion(cwd, enrichedQuestion, {
      module: options.module,
      diffContext: options.diffContext,
      baseRef: options.base
    });
    const modeInstruction = getResponseModeInstruction(mode);
    const answerForMode = formatAnswerForMode(answer.answer, answer.reason, mode);

    const resultContext: AskResult['context'] = {
      ...answer.context,
      sources: buildContextSources(answer.context, repoContext.sources, options.module)
    };

    const result: AskResult = {
      answerability: answer.answerability,
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
      scope: {
        module: options.module,
        diffContext: {
          enabled: options.diffContext ?? false,
          baseRef: options.base
        }
      },
      context: resultContext
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
