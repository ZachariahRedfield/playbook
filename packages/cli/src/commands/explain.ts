import { explainTarget, type ExplainTargetResult } from '@zachariahredfield/playbook-engine';
import { ExitCode } from '../lib/cliContract.js';

type ExplainOptions = {
  format: 'text' | 'json';
  quiet: boolean;
};

type ExplainOutput = {
  command: 'explain';
  target: string;
  type: ExplainTargetResult['type'];
  explanation: Record<string, unknown>;
};

const positionalArgs = (args: string[]): string[] => args.filter((arg) => !arg.startsWith('-'));

const toExplainTarget = (args: string[]): string | undefined => {
  const positional = positionalArgs(args);
  if (positional.length === 0) {
    return undefined;
  }

  if ((positional[0] === 'subsystem' || positional[0] === 'artifact') && positional.length >= 2) {
    return `${positional[0]} ${positional.slice(1).join(' ')}`;
  }

  return positional[0];
};

const hasWithMemoryFlag = (args: string[]): boolean => args.includes('--with-memory');

const toOutput = (target: string, explanation: ExplainTargetResult): ExplainOutput => {
  if (explanation.type === 'unknown') {
    return {
      command: 'explain',
      target,
      type: 'unknown',
      explanation: {
        resolvedTarget: explanation.resolvedTarget,
        message: explanation.message
      }
    };
  }

  const payload = { ...explanation };
  delete (payload as { type?: string }).type;
  return {
    command: 'explain',
    target,
    type: explanation.type,
    explanation: payload
  };
};

const printText = (target: string, explanation: ExplainTargetResult): void => {
  if (explanation.type === 'rule') {
    console.log(`Rule: ${explanation.id}`);
    console.log('');
    console.log('Purpose');
    console.log(explanation.purpose);
    console.log('');
    console.log('Reason');
    console.log(explanation.reason);
    console.log('');
    console.log('How to fix');
    for (const step of explanation.fix) {
      console.log(`- ${step}`);
    }
    return;
  }

  if (explanation.type === 'module') {
    console.log(`Module: ${explanation.name}`);
    console.log('');
    console.log(`Architecture: ${explanation.architecture}`);
    console.log('');
    console.log('Responsibilities');
    for (const item of explanation.responsibilities) {
      console.log(`- ${item}`);
    }
    console.log('');
    console.log('Dependencies');
    if (explanation.dependencies.length === 0) {
      console.log('- none (not yet inferred)');
      return;
    }

    for (const item of explanation.dependencies) {
      console.log(`- ${item}`);
    }
    return;
  }

  if (explanation.type === 'architecture') {
    console.log(`Architecture: ${explanation.architecture}`);
    console.log('');
    console.log('Structure');
    console.log(explanation.structure);
    console.log('');
    console.log('Reasoning');
    console.log(explanation.reasoning);
    return;
  }

  if (explanation.type === 'subsystem') {
    console.log(`Subsystem: ${explanation.name}`);
    console.log('');
    console.log('Purpose');
    console.log(explanation.purpose);
    console.log('');
    console.log('Owned commands');
    for (const command of explanation.commands) {
      console.log(`- ${command}`);
    }
    console.log('');
    console.log('Owned artifacts');
    if (explanation.artifacts.length === 0) {
      console.log('- none');
      return;
    }

    for (const artifact of explanation.artifacts) {
      console.log(`- ${artifact}`);
    }
    return;
  }

  if (explanation.type === 'artifact') {
    console.log(`Artifact: ${explanation.artifact}`);
    console.log('');
    console.log(`Owning subsystem: ${explanation.subsystem}`);
    console.log('');
    console.log('Subsystem purpose');
    console.log(explanation.purpose);
    console.log('');
    console.log('Subsystem commands');
    for (const command of explanation.commands) {
      console.log(`- ${command}`);
    }
    return;
  }

  console.log(`Target: ${target}`);
  console.log('');
  console.log(explanation.message);
};

export const runExplain = async (cwd: string, commandArgs: string[], options: ExplainOptions): Promise<number> => {
  const target = toExplainTarget(commandArgs);
  if (!target) {
    console.error('playbook explain: missing required <target> argument');
    return ExitCode.Failure;
  }

  try {
    const explanation = explainTarget(cwd, target, { withMemory: hasWithMemoryFlag(commandArgs) });
    const output = toOutput(target, explanation);

    if (options.format === 'json') {
      console.log(JSON.stringify(output, null, 2));
      return explanation.type === 'unknown' ? ExitCode.Failure : ExitCode.Success;
    }

    if (!options.quiet) {
      printText(target, explanation);
    }

    return explanation.type === 'unknown' ? ExitCode.Failure : ExitCode.Success;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (options.format === 'json') {
      console.log(
        JSON.stringify(
          {
            command: 'explain',
            target,
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
