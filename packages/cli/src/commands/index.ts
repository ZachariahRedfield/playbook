import { commandMetadata } from '../lib/commandMetadata.js';
import { ExitCode } from '../lib/cliContract.js';

type CommandContext = {
  cwd: string;
  args: string[];
  commandArgs: string[];
  ci: boolean;
  explain: boolean;
  format: 'text' | 'json';
  quiet: boolean;
};

type RegisteredCommand = {
  name: string;
  description: string;
  run: (context: CommandContext) => Promise<number>;
};

const parseFlag = (allArgs: string[], flag: string): boolean => allArgs.includes(flag);
const parseOptionValue = (allArgs: string[], name: string): string | undefined => {
  const index = allArgs.indexOf(name);
  return index >= 0 && allArgs[index + 1] ? String(allArgs[index + 1]) : undefined;
};

const parseOptionValues = (allArgs: string[], name: string): string[] | undefined => {
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


const parseAnalyzePrFormat = (allArgs: string[], globalFormat: 'text' | 'json'): 'text' | 'json' | 'github-comment' => {
  if (globalFormat === 'json') {
    return 'json';
  }

  const format = parseOptionValue(allArgs, '--format');
  if (format === 'github-comment') {
    return 'github-comment';
  }

  return format === 'json' ? 'json' : 'text';
};

const commandRunners: Record<string, (context: CommandContext) => Promise<number>> = {
  demo: async ({ cwd, format, quiet }) => {
    const { runDemo } = await import('./demo.js');
    return runDemo(cwd, { format, quiet });
  },
  init: async ({ cwd, commandArgs, format, quiet, ci }) => {
    const { runInit } = await import('./init.js');
    return runInit(cwd, {
      format,
      quiet,
      ci,
      force: parseFlag(commandArgs, '--force'),
      help: parseFlag(commandArgs, '--help') || parseFlag(commandArgs, '-h')
    });
  },
  analyze: async ({ cwd, ci, explain, format, quiet }) => {
    const { runAnalyze } = await import('./analyze.js');
    return runAnalyze(cwd, { ci, explain, format, quiet });
  },
  'analyze-pr': async ({ cwd, commandArgs, format, quiet }) => {
    const { runAnalyzePr } = await import('./analyzePr.js');
    return runAnalyzePr(cwd, commandArgs, {
      format: parseAnalyzePrFormat(commandArgs, format),
      quiet,
      baseRef: parseOptionValue(commandArgs, '--base')
    });
  },
  verify: async ({ cwd, commandArgs, ci, explain, format, quiet }) => {
    const { runVerify } = await import('./verify.js');
    return runVerify(cwd, { ci, explain, format, quiet, policy: parseFlag(commandArgs, '--policy') });
  },
  plan: async ({ cwd, ci, format, quiet }) => {
    const { runPlan } = await import('./plan.js');
    return runPlan(cwd, { ci, format, quiet });
  },
  apply: async ({ cwd, commandArgs, ci, format, quiet }) => {
    const { runApply } = await import('./apply.js');
    return runApply(cwd, {
      ci,
      format,
      quiet,
      fromPlan: parseOptionValue(commandArgs, '--from-plan'),
      tasks: parseOptionValues(commandArgs, '--task')
    });
  },
  fix: async ({ cwd, commandArgs, ci, explain, format, quiet }) => {
    const { runFix } = await import('./fix.js');
    return runFix(cwd, {
      dryRun: parseFlag(commandArgs, '--dry-run'),
      yes: parseFlag(commandArgs, '--yes'),
      only: parseOptionValue(commandArgs, '--only'),
      ci,
      explain,
      format,
      quiet
    });
  },
  doctor: async ({ cwd, format, quiet }) => {
    const { runDoctor } = await import('./doctor.js');
    return runDoctor(cwd, {
      format,
      quiet
    });
  },
  status: async ({ cwd, ci, format, quiet }) => {
    const { runStatus } = await import('./status.js');
    return runStatus(cwd, { ci, format, quiet });
  },
  upgrade: async ({ cwd, commandArgs, ci, explain, format, quiet }) => {
    const { runUpgrade } = await import('./upgrade.js');
    return runUpgrade(cwd, {
      check: parseFlag(commandArgs, '--check'),
      apply: parseFlag(commandArgs, '--apply'),
      dryRun: parseFlag(commandArgs, '--dry-run'),
      offline: parseFlag(commandArgs, '--offline'),
      from: parseOptionValue(commandArgs, '--from'),
      to: parseOptionValue(commandArgs, '--to'),
      ci,
      explain,
      format,
      quiet
    });
  },
  docs: async ({ cwd, commandArgs, ci, format, quiet }) => {
    const { runDocs } = await import('./docs.js');
    return runDocs(cwd, commandArgs, { ci, format, quiet });
  },
  diagram: async ({ cwd, commandArgs, format, quiet }) => {
    const { runDiagram } = await import('./diagram.js');
    return runDiagram(cwd, {
      repo: parseOptionValue(commandArgs, '--repo') ?? '.',
      out: parseOptionValue(commandArgs, '--out') ?? 'docs/ARCHITECTURE_DIAGRAMS.md',
      deps: parseFlag(commandArgs, '--deps'),
      structure: parseFlag(commandArgs, '--structure'),
      format,
      quiet
    });
  },
  explain: async ({ cwd, commandArgs, format, quiet }) => {
    const { runExplain } = await import('./explain.js');
    return runExplain(cwd, commandArgs, { format, quiet });
  },
  context: async ({ cwd, format, quiet }) => {
    const { runContext } = await import('./context.js');
    return runContext(cwd, { format, quiet });
  },
  'ai-context': async ({ cwd, format, quiet }) => {
    const { runAiContext } = await import('./aiContext.js');
    return runAiContext(cwd, { format, quiet });
  },
  'ai-contract': async ({ cwd, format, quiet }) => {
    const { runAiContract } = await import('./aiContract.js');
    return runAiContract(cwd, { format, quiet });
  },
  schema: async ({ cwd, commandArgs, format, quiet }) => {
    const { runSchema } = await import('./schema.js');
    return runSchema(cwd, commandArgs, { format, quiet });
  },
  rules: async ({ cwd, explain, format, quiet }) => {
    const { runRules } = await import('./rules.js');
    return runRules(cwd, { explain, format, quiet });
  },
  index: async ({ cwd, format, quiet }) => {
    const { runIndex } = await import('./repoIndex.js');
    return runIndex(cwd, { format, quiet });
  },
  ask: async ({ cwd, commandArgs, format, quiet }) => {
    const { runAsk } = await import('./ask.js');
    return runAsk(cwd, commandArgs, {
      format,
      quiet,
      mode: parseOptionValue(commandArgs, '--mode'),
      repoContext: parseFlag(commandArgs, '--repo-context'),
      module: parseOptionValue(commandArgs, '--module'),
      diffContext: parseFlag(commandArgs, '--diff-context'),
      base: parseOptionValue(commandArgs, '--base')
    });
  },
  deps: async ({ cwd, commandArgs, format, quiet }) => {
    const { runDeps } = await import('./deps.js');
    return runDeps(cwd, commandArgs, { format, quiet });
  },
  query: async ({ cwd, commandArgs, format, quiet }) => {
    const { runQuery } = await import('./query.js');
    return runQuery(cwd, commandArgs, { format, quiet });
  },
  session: async ({ cwd, commandArgs, format, quiet }) => {
    const { runSession } = await import('./session.js');
    return runSession(cwd, commandArgs, { format, quiet });
  }
};

const commandOrder = [
  'demo',
  'init',
  'analyze',
  'analyze-pr',
  'verify',
  'plan',
  'apply',
  'fix',
  'doctor',
  'status',
  'upgrade',
  'diagram',
  'explain',
  'context',
  'ai-context',
  'ai-contract',
  'docs',
  'schema',
  'rules',
  'index',
  'ask',
  'deps',
  'query',
  'session'
] as const;

const metadataByName = new Map(commandMetadata.map((command) => [command.name, command]));

export const commandRegistry: RegisteredCommand[] = commandOrder.map((name) => {
  const metadata = metadataByName.get(name);
  const run = commandRunners[name];

  if (!metadata || !run) {
    throw new Error(`Command registry is out of sync for "${name}"`);
  }

  return {
    name: metadata.name,
    description: metadata.description,
    run
  };
});

const commandMap = new Map(commandRegistry.map((command) => [command.name, command]));

export const listRegisteredCommands = (): RegisteredCommand[] => [...commandRegistry];

export const hasRegisteredCommand = (commandName: string): boolean => commandMap.has(commandName);

export const runRegisteredCommand = async (commandName: string, context: CommandContext): Promise<number> => {
  const command = commandMap.get(commandName);
  if (!command) {
    return ExitCode.Failure;
  }

  return command.run(context);
};
