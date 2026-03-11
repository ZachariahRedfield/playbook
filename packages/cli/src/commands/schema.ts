import { CLI_SCHEMA_COMMANDS, getCliSchema, getCliSchemas, isCliSchemaCommand } from '@zachariahredfield/playbook-engine';
import { ExitCode } from '../lib/cliContract.js';

type SchemaOptions = {
  format: 'text' | 'json';
  quiet: boolean;
};

const firstPositionalArg = (args: string[]): string | undefined => args.find((arg) => !arg.startsWith('-'));

const printUsage = (): void => {
  console.error('Usage: playbook schema [rules|explain|index|graph|verify|plan|context|ai-context|ai-contract|doctor|analyze-pr|query|docs|contracts|ignore|learn] [--json]');
};

const renderTextSummary = (command?: string): void => {
  if (command) {
    console.log(`Schema for playbook ${command} --json`);
    return;
  }

  console.log('Playbook CLI output schemas');
  console.log('──────────────────────────');
  console.log(`Commands: ${CLI_SCHEMA_COMMANDS.join(', ')}`);
};

export const runSchema = async (_cwd: string, commandArgs: string[], options: SchemaOptions): Promise<number> => {
  const target = firstPositionalArg(commandArgs);

  if (target && !isCliSchemaCommand(target)) {
    console.error(`playbook schema: unknown schema target "${target}"`);
    printUsage();
    return ExitCode.Failure;
  }

  const payload = target ? getCliSchema(target) : getCliSchemas();

  if (options.format === 'json') {
    console.log(JSON.stringify(payload, null, 2));
    return ExitCode.Success;
  }

  if (!options.quiet) {
    renderTextSummary(target);
    console.log(JSON.stringify(payload, null, 2));
  }

  return ExitCode.Success;
};
