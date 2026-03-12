import path from 'node:path';
import { buildOrchestratorContract, writeOrchestratorArtifact } from '@zachariahredfield/playbook-engine';
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

  const outDir = path.resolve(cwd, options.outDir);
  const relativeOutDir = path.relative(cwd, outDir) || '.';

  const contract = buildOrchestratorContract({
    goal,
    laneCountRequested: options.lanes
  });

  const artifact = writeOrchestratorArtifact(contract, outDir, options.artifactFormat);

  emitResult({
    format: options.format,
    quiet: options.quiet,
    command: 'orchestrate',
    ok: true,
    exitCode: ExitCode.Success,
    summary: `Orchestration artifacts generated in ${relativeOutDir}`,
    findings: [
      {
        id: 'orchestrate.goal',
        level: 'info',
        message: `Goal: ${contract.goal}`
      },
      {
        id: 'orchestrate.lanes.requested',
        level: 'info',
        message: `Lanes requested: ${contract.laneCountRequested}`
      },
      {
        id: 'orchestrate.lanes.produced',
        level: 'info',
        message: `Lanes produced: ${contract.laneCountProduced}`
      },
      {
        id: 'orchestrate.artifact-format',
        level: 'info',
        message: `Artifact format: ${options.artifactFormat}`
      },
      ...contract.warnings.map((warning, index) => ({
        id: `orchestrate.warning.${index + 1}`,
        level: 'warning' as const,
        message: warning
      }))
    ],
    nextActions: [
      `Review ${path.relative(cwd, artifact.orchestratorPath)} lane contracts.`,
      ...(artifact.lanePromptPaths.length > 0
        ? [`Distribute ${artifact.lanePromptPaths.length} lane prompt files to parallel Codex plan-mode workers.`]
        : [])
    ]
  });

  return ExitCode.Success;
};
