import path from 'node:path';
import { buildOrchestratorContract } from './planner.js';
import type { CompileOrchestratorArtifactsInput, CompileOrchestratorArtifactsResult } from './types.js';
import { writeOrchestratorArtifact } from './writer.js';

export const compileOrchestratorArtifacts = (input: CompileOrchestratorArtifactsInput): CompileOrchestratorArtifactsResult => {
  const outputDir = path.resolve(input.cwd, input.outDir);
  const relativeOutputDir = path.relative(input.cwd, outputDir) || '.';

  const contract = buildOrchestratorContract({
    goal: input.goal,
    laneCountRequested: input.laneCountRequested
  });

  const artifact = writeOrchestratorArtifact(contract, outputDir, input.artifactFormat);

  return {
    contract,
    artifact,
    outputDir,
    relativeOutputDir
  };
};
