import fs from 'node:fs';
import path from 'node:path';
import { buildTestFixPlanArtifact, readTestTriageArtifact, renderTestFixPlanText } from '@zachariahredfield/playbook-engine';
import { ExitCode } from '../lib/cliContract.js';

type TestFixPlanOptions = {
  format: 'text' | 'json';
  quiet: boolean;
  fromTriage?: string;
  outFile?: string;
  help?: boolean;
};

const usage = 'Usage: playbook test-fix-plan --from-triage <artifact-path> [--out <artifact-path>] [--json]';
const DEFAULT_OUTPUT_PATH = '.playbook/test-fix-plan.json';

const writeArtifact = (cwd: string, outputPath: string, payload: string): void => {
  const absolute = path.resolve(cwd, outputPath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, `${payload}\n`, 'utf8');
};

export const runTestFixPlan = async (cwd: string, options: TestFixPlanOptions): Promise<number> => {
  if (options.help) {
    console.log(usage);
    console.log('Build a deterministic test-fix-plan artifact from a prior test-triage artifact.');
    return ExitCode.Success;
  }

  try {
    if (!options.fromTriage) {
      throw new Error('playbook test-fix-plan: --from-triage <artifact-path> is required.');
    }

    const triagePath = path.resolve(cwd, options.fromTriage);
    const triageArtifact = readTestTriageArtifact(JSON.parse(fs.readFileSync(triagePath, 'utf8')) as unknown);
    const artifact = buildTestFixPlanArtifact(triageArtifact, { from_triage: options.fromTriage });
    const outputPath = options.outFile ?? DEFAULT_OUTPUT_PATH;
    artifact.artifact_path = outputPath;
    const outputJson = JSON.stringify(artifact, null, 2);
    writeArtifact(cwd, outputPath, outputJson);

    if (options.format === 'json') {
      console.log(outputJson);
      return artifact.status === 'ready' ? ExitCode.Success : ExitCode.Failure;
    }

    if (!options.quiet) {
      console.log(renderTestFixPlanText(artifact));
      console.log(`Artifact: ${outputPath}`);
    }
    return artifact.status === 'ready' ? ExitCode.Success : ExitCode.Failure;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (options.format === 'json') {
      console.log(JSON.stringify({ schemaVersion: '1.0', command: 'test-fix-plan', error: message }, null, 2));
    } else {
      console.error(message);
    }
    return ExitCode.Failure;
  }
};
