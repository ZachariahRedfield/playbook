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

export const commandRegistry: RegisteredCommand[] = [
  {
    name: 'demo',
    description: 'Show the official Playbook demo repository and guided first-run workflow',
    run: async ({ cwd, format, quiet }) => {
      const { runDemo } = await import('./demo.js');
      return runDemo(cwd, { format, quiet });
    }
  },
  {
    name: 'init',
    description: 'Initialize playbook docs/config',
    run: async ({ cwd, commandArgs, format, quiet, ci }) => {
      const { runInit } = await import('./init.js');
      return runInit(cwd, {
        format,
        quiet,
        ci,
        force: parseFlag(commandArgs, '--force'),
        help: parseFlag(commandArgs, '--help') || parseFlag(commandArgs, '-h')
      });
    }
  },
  {
    name: 'analyze',
    description: 'Analyze project stack',
    run: async ({ cwd, ci, explain, format, quiet }) => {
      const { runAnalyze } = await import('./analyze.js');
      return runAnalyze(cwd, { ci, explain, format, quiet });
    }
  },
  {
    name: 'verify',
    description: 'Verify governance rules',
    run: async ({ cwd, commandArgs, ci, explain, format, quiet }) => {
      const { runVerify } = await import('./verify.js');
      return runVerify(cwd, { ci, explain, format, quiet, policy: parseFlag(commandArgs, '--policy') });
    }
  },
  {
    name: 'plan',
    description: 'Generate a structured fix plan from rule findings',
    run: async ({ cwd, ci, format, quiet }) => {
      const { runPlan } = await import('./plan.js');
      return runPlan(cwd, { ci, format, quiet });
    }
  },
  {
    name: 'apply',
    description: 'Execute deterministic auto-fixable plan tasks',
    run: async ({ cwd, commandArgs, ci, format, quiet }) => {
      const { runApply } = await import('./apply.js');
      return runApply(cwd, {
        ci,
        format,
        quiet,
        fromPlan: parseOptionValue(commandArgs, '--from-plan'),
        tasks: parseOptionValues(commandArgs, '--task')
      });
    }
  },
  {
    name: 'fix',
    description: 'Apply safe, deterministic autofixes for verify findings',
    run: async ({ cwd, commandArgs, ci, explain, format, quiet }) => {
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
    }
  },
  {
    name: 'doctor',
    description: 'Repository health entry point for architecture, governance, and issues',
    run: async ({ cwd, commandArgs, format, quiet }) => {
      const { runDoctor } = await import('./doctor.js');
      return runDoctor(cwd, {
        format,
        quiet,
        fix: parseFlag(commandArgs, '--fix'),
        dryRun: parseFlag(commandArgs, '--dry-run'),
        yes: parseFlag(commandArgs, '--yes')
      });
    }
  },
  {
    name: 'status',
    description: 'Show overall Playbook repository health',
    run: async ({ cwd, ci, format, quiet }) => {
      const { runStatus } = await import('./status.js');
      return runStatus(cwd, { ci, format, quiet });
    }
  },
  {
    name: 'upgrade',
    description: 'Plan safe upgrades and local deterministic migrations',
    run: async ({ cwd, commandArgs, ci, explain, format, quiet }) => {
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
    }
  },
  {
    name: 'diagram',
    description: 'Generate deterministic architecture Mermaid diagrams',
    run: async ({ cwd, commandArgs, format, quiet }) => {
      const { runDiagram } = await import('./diagram.js');
      return runDiagram(cwd, {
        repo: parseOptionValue(commandArgs, '--repo') ?? '.',
        out: parseOptionValue(commandArgs, '--out') ?? 'docs/ARCHITECTURE_DIAGRAMS.md',
        deps: parseFlag(commandArgs, '--deps'),
        structure: parseFlag(commandArgs, '--structure'),
        format,
        quiet
      });
    }
  },
  {
    name: 'explain',
    description: 'Explain rules, modules, or architecture from repository intelligence',
    run: async ({ cwd, commandArgs, format, quiet }) => {
      const { runExplain } = await import('./explain.js');
      return runExplain(cwd, commandArgs, { format, quiet });
    }
  },
  {
    name: 'schema',
    description: 'Print JSON Schemas for Playbook CLI command outputs',
    run: async ({ cwd, commandArgs, format, quiet }) => {
      const { runSchema } = await import('./schema.js');
      return runSchema(cwd, commandArgs, { format, quiet });
    }
  },

  {
    name: 'rules',
    description: 'List loaded verify and analyze rules',
    run: async ({ cwd, explain, format, quiet }) => {
      const { runRules } = await import('./rules.js');
      return runRules(cwd, { explain, format, quiet });
    }
  },

  {
    name: 'index',
    description: 'Generate machine-readable repository intelligence index',
    run: async ({ cwd, format, quiet }) => {
      const { runIndex } = await import('./repoIndex.js');
      return runIndex(cwd, { format, quiet });
    }
  },


  {
    name: 'ask',
    description: 'Answer repository questions from machine-readable intelligence context',
    run: async ({ cwd, commandArgs, format, quiet }) => {
      const { runAsk } = await import('./ask.js');
      return runAsk(cwd, commandArgs, { format, quiet });
    }
  },


  {
    name: 'query',
    description: 'Query machine-readable repository intelligence from .playbook/repo-index.json',
    run: async ({ cwd, commandArgs, format, quiet }) => {
      const { runQuery } = await import('./query.js');
      return runQuery(cwd, commandArgs, { format, quiet });
    }
  },

  {
    name: 'session',
    description: 'Import, merge, and cleanup session snapshots',
    run: async ({ cwd, commandArgs, format, quiet }) => {
      const { runSession } = await import('./session.js');
      return runSession(cwd, commandArgs, { format, quiet });
    }
  }
];

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
