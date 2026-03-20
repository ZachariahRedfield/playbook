import fs from 'node:fs';
import path from 'node:path';
import { buildTestTriageArtifact, renderTestTriageText } from '@zachariahredfield/playbook-engine';
import { ExitCode } from '../lib/cliContract.js';

type TestTriageOptions = {
  format: 'text' | 'json';
  quiet: boolean;
  input?: string;
  help?: boolean;
};

const usage = 'Usage: playbook test-triage --input <failure-log-path> [--json]';

const readInputLog = (cwd: string, inputPath?: string): { rawLog: string; path: string | null; input: 'file' | 'stdin' } => {
  if (!inputPath) {
    throw new Error('playbook test-triage: --input <failure-log-path> is required in this initial command slice.');
  }

  const absolute = path.resolve(cwd, inputPath);
  return {
    rawLog: fs.readFileSync(absolute, 'utf8'),
    path: inputPath,
    input: 'file'
  };
};

export const runTestTriage = async (cwd: string, options: TestTriageOptions): Promise<number> => {
  if (options.help) {
    console.log(usage);
    console.log('Parse captured Vitest / pnpm recursive failure output into deterministic test triage findings.');
    return ExitCode.Success;
  }

  try {
    const source = readInputLog(cwd, options.input);
    const artifact = buildTestTriageArtifact(source.rawLog, { input: source.input, path: source.path });

    if (options.format === 'json') {
      console.log(JSON.stringify(artifact, null, 2));
      return ExitCode.Success;
    }

    if (!options.quiet) {
      console.log(renderTestTriageText(artifact));
    }
    return ExitCode.Success;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (options.format === 'json') {
      console.log(JSON.stringify({ schemaVersion: '1.0', command: 'test-triage', error: message }, null, 2));
    } else {
      console.error(message);
    }
    return ExitCode.Failure;
  }
};
