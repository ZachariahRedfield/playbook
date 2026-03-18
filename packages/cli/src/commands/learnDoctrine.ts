import { extractDoctrineFromSummary, readDoctrineExtractionInput, type DoctrineExtractionResult } from '@zachariahredfield/playbook-engine';
import { ExitCode } from '../lib/cliContract.js';
import { emitJsonOutput } from '../lib/jsonArtifact.js';

type LearnDoctrineOptions = {
  format: 'text' | 'json';
  quiet: boolean;
  inputPath?: string;
  summaryText?: string;
};

const printLearnDoctrineHelp = (): void => {
  console.log(`Usage: playbook learn doctrine [options]

Extract report-only post-merge doctrine from a merged change summary, PR summary, or fixture input.

Options:
  --input <path>      Read a merged-change summary from a text or JSON file
  --summary <text>    Inline merged-change summary text
  --json              Print machine-readable JSON output
  --help              Show help`);
};

const renderText = (payload: DoctrineExtractionResult): void => {
  console.log('Post-merge doctrine extraction (report-only)');
  console.log('──────────────────────────────────────────');
  console.log('What was learned');
  for (const line of payload.conciseChangeSummary) {
    console.log(`- ${line}`);
  }

  console.log('\nRules');
  for (const entry of payload.learned.rules) {
    console.log(`- ${entry.statement}`);
  }

  console.log('\nPatterns');
  for (const entry of payload.learned.patterns) {
    console.log(`- ${entry.statement}`);
  }

  console.log('\nFailure Modes');
  for (const entry of payload.learned.failureModes) {
    console.log(`- ${entry.statement}`);
  }

  console.log('\nWhat should be documented');
  for (const suggestion of payload.suggestedNotesUpdate) {
    console.log(`- [${suggestion.target}] ${suggestion.summary}`);
  }

  console.log('\nWhat could be automated next');
  for (const check of payload.candidateFutureChecks) {
    console.log(`- [${check.scope}] ${check.name}: ${check.summary}`);
  }
};

export const runLearnDoctrine = async (cwd: string, commandArgs: string[], options: LearnDoctrineOptions): Promise<number> => {
  if (commandArgs.includes('--help') || commandArgs.includes('-h')) {
    printLearnDoctrineHelp();
    return ExitCode.Success;
  }

  const inputPath = options.inputPath;
  const summaryText = options.summaryText?.trim();

  if (!inputPath && !summaryText) {
    const message = 'playbook learn doctrine: provide --input <path> or --summary <text>.';
    if (options.format === 'json') {
      console.log(JSON.stringify({ schemaVersion: '1.0', command: 'learn-doctrine', error: message }, null, 2));
    } else {
      console.error(message);
    }
    return ExitCode.Failure;
  }

  try {
    const input = inputPath ? readDoctrineExtractionInput(cwd, inputPath) : { summary: summaryText ?? '' };
    const payload = extractDoctrineFromSummary(input, { inputPath });

    if (options.format === 'json') {
      emitJsonOutput({ cwd, command: 'learn doctrine', payload });
      return ExitCode.Success;
    }

    if (!options.quiet) {
      renderText(payload);
    }
    return ExitCode.Success;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (options.format === 'json') {
      console.log(JSON.stringify({ schemaVersion: '1.0', command: 'learn-doctrine', error: message }, null, 2));
    } else {
      console.error(message);
    }
    return ExitCode.Failure;
  }
};
