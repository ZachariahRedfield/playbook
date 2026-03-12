import path from 'node:path';
import { compileOrchestratorArtifacts } from '@zachariahredfield/playbook-engine';
import { emitResult, ExitCode } from '../lib/cliContract.js';

type OrchestrateArtifactFormat = 'md' | 'json' | 'both';

type OrchestrateOptions = {
  format: 'text' | 'json';
  quiet: boolean;
  goal?: string;
  lanes: number;
  outDir: string;
  artifactFormat: OrchestrateArtifactFormat;
};

export const runOrchestrate = async (cwd: string, options: OrchestrateOptions): Promise<number> => {
  const goal = options.goal?.trim();
  if (!goal) {
    emitResult({
      format: options.format,
      quiet: options.quiet,
      command: 'orchestrate',
      ok: false,
      exitCode: ExitCode.Failure,
      summary: 'Orchestration failed: --goal is required.',
      findings: [
        {
          id: 'orchestrate.goal.required',
          level: 'error',
          message: 'Missing required option: --goal <string>.'
        }
      ],
      nextActions: ['Run `playbook orchestrate --goal "<goal>"`.']
    });

    return ExitCode.Failure;
  }

  const compilation = compileOrchestratorArtifacts({
    cwd,
    goal,
    laneCountRequested: options.lanes,
    outDir: options.outDir,
    artifactFormat: options.artifactFormat
  });

  const artifactIncludesJson = options.artifactFormat === 'json' || options.artifactFormat === 'both';

  emitResult({
    format: options.format,
    quiet: options.quiet,
    command: 'orchestrate',
    ok: true,
    exitCode: ExitCode.Success,
    summary: `Orchestration artifacts generated in ${compilation.relativeOutputDir}`,
    findings: [
      {
        id: 'orchestrate.goal',
        level: 'info',
        message: `Goal: ${compilation.contract.goal}`
      },
      {
        id: 'orchestrate.lanes.requested',
        level: 'info',
        message: `Lanes requested: ${compilation.contract.laneCountRequested}`
      },
      {
        id: 'orchestrate.lanes.produced',
        level: 'info',
        message: `Lanes produced: ${compilation.contract.laneCountProduced}`
      },
      {
        id: 'orchestrate.artifact-format',
        level: 'info',
        message: `Artifact format: ${options.artifactFormat}`
      },
      ...compilation.contract.warnings.map((warning, index) => ({
        id: `orchestrate.warning.${index + 1}`,
        level: 'warning' as const,
        message: warning
      }))
    ],
    nextActions: [
      `Distribute ${compilation.artifact.workerBundleDirs.length} worker bundles from ${path.relative(cwd, path.join(compilation.outputDir, 'workers'))} to parallel Codex plan-mode workers.`,
      ...(compilation.artifact.lanePromptPaths.length > 0
        ? [`Legacy lane prompts remain available at ${compilation.relativeOutputDir} for backward compatibility.`]
        : []),
      ...(artifactIncludesJson ? [`Review ${path.relative(cwd, compilation.artifact.orchestratorPath)} lane contracts.`] : [])
    ]
  });

  return ExitCode.Success;
};
