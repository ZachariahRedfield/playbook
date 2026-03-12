import fs from 'node:fs';
import path from 'node:path';
import { writeLanePrompts } from '../execution/lanePrompts.js';
import type { LanePromptSpec } from '../execution/lanePrompts.js';
import type { OrchestratorArtifactWriteResult, OrchestratorContract } from './types.js';

const toPromptSpec = (contract: OrchestratorContract): LanePromptSpec[] =>
  contract.lanes.map((lane) => ({
    objective: lane.objective,
    whyThisLaneExists: lane.whyThisLaneExists,
    allowedFilesToModify: lane.allowedPaths,
    forbiddenFilesToModify: lane.forbiddenPaths,
    sharedFilesPolicy: `Shared-file conflict hubs are explicitly controlled: ${contract.sharedPaths.join(', ')}. Do not claim ownership; coordinate in merge notes or the integration lane.`,
    dependenciesWaveInfo: `Wave ${lane.wave}. Depends on: ${lane.dependsOn.length > 0 ? lane.dependsOn.join(', ') : 'none'}.`,
    implementationPlan: lane.implementationPlan,
    verificationSteps: lane.verification,
    documentationUpdates: lane.documentationUpdates,
    mergeNotes: lane.mergeNotes,
    laneOwnershipConstraints: [
      `Primary ownership is exclusive to: ${lane.allowedPaths.join(', ') || '(none)'}.`,
      `Prompt artifact: ${lane.promptFile}.`
    ]
  }));

export const writeOrchestratorArtifact = (
  contract: OrchestratorContract,
  outDir: string,
  artifactFormat: 'md' | 'json' | 'both' = 'both'
): OrchestratorArtifactWriteResult => {
  fs.mkdirSync(outDir, { recursive: true });

  const orchestratorPath = path.join(outDir, 'orchestrator.json');
  if (artifactFormat === 'json' || artifactFormat === 'both') {
    fs.writeFileSync(orchestratorPath, `${JSON.stringify(contract, null, 2)}\n`, 'utf8');
  }

  const lanePromptPaths = artifactFormat === 'json' ? [] : writeLanePrompts({ outputDir: outDir, lanes: toPromptSpec(contract) });

  return {
    outputDir: outDir,
    orchestratorPath,
    lanePromptPaths
  };
};
