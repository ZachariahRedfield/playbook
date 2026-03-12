import fs from 'node:fs';
import path from 'node:path';
import { renderLanePrompt, writeLanePrompts } from '../execution/lanePrompts.js';
import type { LanePromptSpec } from '../execution/lanePrompts.js';
import type { OrchestratorArtifactWriteResult, OrchestratorContract, OrchestratorLaneContract } from './types.js';

const toPromptSpec = (contract: OrchestratorContract): LanePromptSpec[] =>
  contract.lanes.map((lane) => ({
    objective: lane.objective,
    whyThisLaneExists: `Lane ${lane.id} (${lane.title}) owns a deterministic execution slice for this orchestration goal.`,
    allowedFilesToModify: lane.allowedPaths,
    forbiddenFilesToModify: lane.forbiddenPaths,
    sharedFilesPolicy: `Shared-file conflict hubs are explicitly controlled: ${contract.sharedPaths.join(', ')}. Do not claim ownership; coordinate through dependencies and shared-path policy.`,
    dependenciesWaveInfo: `Wave ${lane.wave}. Depends on: ${lane.dependsOn.length > 0 ? lane.dependsOn.join(', ') : 'none'}.`,
    shardOwnershipInfo: `Shard key: ${lane.shardKey}.`,
    implementationPlan: [
      `Implement lane objective: ${lane.objective}`,
      `Keep edits within allowed paths: ${lane.allowedPaths.join(', ') || '(none)'}`,
      `Honor explicit dependencies before starting blocked work.`
    ],
    verificationSteps: lane.verification,
    documentationUpdates: lane.documentationUpdates,
    mergeNotes: [
      `Coordinate shared-path updates only when changes touch: ${lane.sharedPaths.join(', ') || '(none)'}.`,
      `Prompt artifact: ${lane.promptFile}.`
    ],
    laneOwnershipConstraints: [
      `Primary ownership is exclusive to: ${lane.allowedPaths.join(', ') || '(none)'}.`,
      `Canonical shard ownership key: ${lane.shardKey}.`,
      `Forbidden paths remain off-limits: ${lane.forbiddenPaths.join(', ') || '(none)'}.`
    ]
  }));

const buildWorkerContract = (lane: OrchestratorLaneContract, goal: string) => ({
  laneId: lane.id,
  goal,
  shardKey: lane.shardKey,
  allowedPaths: lane.allowedPaths,
  forbiddenPaths: lane.forbiddenPaths,
  sharedPaths: lane.sharedPaths,
  wave: lane.wave,
  dependsOn: lane.dependsOn,
  verification: lane.verification
});

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

  const promptSpecs = toPromptSpec(contract);
  const workerBundleDirs: string[] = [];
  contract.lanes.forEach((lane, index) => {
    const workerDir = path.join(outDir, 'workers', lane.id);
    fs.mkdirSync(workerDir, { recursive: true });

    const workerPromptPath = path.join(workerDir, 'prompt.md');
    const workerPrompt = renderLanePrompt({ laneNumber: index + 1, lane: promptSpecs[index] ?? promptSpecs[0] });
    fs.writeFileSync(workerPromptPath, `${workerPrompt.endsWith('\n') ? workerPrompt : `${workerPrompt}\n`}`, 'utf8');

    const workerContractPath = path.join(workerDir, 'contract.json');
    fs.writeFileSync(workerContractPath, `${JSON.stringify(buildWorkerContract(lane, contract.goal), null, 2)}\n`, 'utf8');

    workerBundleDirs.push(workerDir);
  });

  return {
    outputDir: outDir,
    orchestratorPath,
    lanePromptPaths,
    workerBundleDirs
  };
};
