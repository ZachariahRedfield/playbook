import fs from 'node:fs';
import path from 'node:path';
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

type OrchestrateLane = {
  lane: number;
  objective: string;
};

const buildLanePlan = (goal: string, lanes: number): OrchestrateLane[] =>
  Array.from({ length: lanes }, (_, index) => ({
    lane: index + 1,
    objective: `Advance "${goal}" via lane ${index + 1}`
  }));

const buildMarkdown = (goal: string, lanes: OrchestrateLane[]): string => {
  const lines = [
    '# Playbook Orchestration Plan',
    '',
    `Goal: ${goal}`,
    `Lane count: ${lanes.length}`,
    '',
    '## Lanes',
    ...lanes.map((lane) => `- Lane ${lane.lane}: ${lane.objective}`)
  ];

  return `${lines.join('\n')}\n`;
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

  const lanes = buildLanePlan(goal, options.lanes);
  const outDir = path.resolve(cwd, options.outDir);
  const relativeOutDir = path.relative(cwd, outDir) || '.';
  const jsonArtifactPath = path.join(relativeOutDir, 'orchestration.json');
  const markdownArtifactPath = path.join(relativeOutDir, 'orchestration.md');

  const payload = {
    schemaVersion: '1.0' as const,
    command: 'orchestrate' as const,
    goal,
    lanes: lanes.length,
    plan: lanes,
    artifacts: {
      json: jsonArtifactPath,
      markdown: markdownArtifactPath
    }
  };

  fs.mkdirSync(outDir, { recursive: true });

  if (options.artifactFormat === 'json' || options.artifactFormat === 'both') {
    fs.writeFileSync(path.join(outDir, 'orchestration.json'), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  }

  if (options.artifactFormat === 'md' || options.artifactFormat === 'both') {
    fs.writeFileSync(path.join(outDir, 'orchestration.md'), buildMarkdown(goal, lanes), 'utf8');
  }

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
        message: `Goal: ${goal}`
      },
      {
        id: 'orchestrate.lanes',
        level: 'info',
        message: `Lanes: ${lanes.length}`
      },
      {
        id: 'orchestrate.artifact-format',
        level: 'info',
        message: `Artifact format: ${options.artifactFormat}`
      }
    ],
    nextActions: ['Review orchestration artifacts and execute planned lane tasks.']
  });

  return ExitCode.Success;
};
