import fs from 'node:fs';
import path from 'node:path';
import { buildTestTriageArtifact, renderTestTriageMarkdown, renderTestTriageText } from '@zachariahredfield/playbook-engine';
import { ExitCode } from '../lib/cliContract.js';
import { emitJsonOutput, writeJsonArtifact } from '../lib/jsonArtifact.js';

type TestTriageOptions = {
  format: 'text' | 'json';
  quiet: boolean;
  input?: string;
  outFile?: string;
  markdownOutFile?: string;
  markdown?: boolean;
  help?: boolean;
};

const usage = 'Usage: playbook test-triage [--input <failure-log-path>|--input -] [--out <artifact-path>] [--markdown] [--markdown-out <path>] [--json]';
const DEFAULT_OUT_FILE = '.playbook/failure-summary.json' as const;
const DEFAULT_MARKDOWN_OUT_FILE = '.playbook/failure-summary.md' as const;

const readInputLog = (cwd: string, inputPath?: string): { rawLog: string; path: string | null; input: 'file' | 'stdin' } => {
  if (!inputPath || inputPath === '-') {
    return { rawLog: fs.readFileSync(0, 'utf8'), path: null, input: 'stdin' };
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
    console.log('Parse captured Vitest / pnpm recursive failure output into deterministic failure-summary findings.');
    return ExitCode.Success;
  }

  try {
    const source = readInputLog(cwd, options.input);
    const artifact = buildTestTriageArtifact(source.rawLog, { input: source.input, path: source.path });
    const markdown = renderTestTriageMarkdown(artifact);
    const outFile = options.outFile ?? (options.format === 'json' ? undefined : DEFAULT_OUT_FILE);
    const markdownOutFile = options.markdownOutFile ?? DEFAULT_MARKDOWN_OUT_FILE;

    if (outFile) writeJsonArtifact(cwd, outFile, artifact, 'test-triage');
    if (markdownOutFile) {
      const target = path.isAbsolute(markdownOutFile) ? markdownOutFile : path.join(cwd, markdownOutFile);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, markdown, 'utf8');
    }

    if (options.format === 'json') {
      emitJsonOutput({ cwd, command: 'test-triage', payload: artifact });
      return ExitCode.Success;
    }

    if (options.markdown) {
      console.log(markdown.trimEnd());
      return ExitCode.Success;
    }

    if (!options.quiet) console.log(renderTestTriageText(artifact));
    return ExitCode.Success;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (options.format === 'json') {
      console.log(JSON.stringify({ schemaVersion: '1.1', command: 'test-triage', error: message }, null, 2));
    } else {
      console.error(message);
    }
    return ExitCode.Failure;
  }
};
