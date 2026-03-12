import fs from 'node:fs';
import path from 'node:path';
import type { OrchestratorArtifactWriteResult, OrchestratorContract } from './types.js';

const lanePrompt = (contract: OrchestratorContract, laneIndex: number): string => {
  const lane = contract.lanes[laneIndex];
  if (!lane) {
    throw new Error(`Unknown lane index: ${laneIndex}.`);
  }

  return [
    `# ${lane.id} Prompt`,
    '',
    `Goal: ${contract.goal}`,
    `Lane goal: ${lane.goal}`,
    `Wave: ${lane.wave}`,
    `Depends on: ${lane.dependsOn.length > 0 ? lane.dependsOn.join(', ') : 'none'}`,
    '',
    '## File policy',
    `- Allowed paths: ${lane.allowedPaths.length > 0 ? lane.allowedPaths.join(', ') : '(none)'}`,
    `- Forbidden paths: ${lane.forbiddenPaths.length > 0 ? lane.forbiddenPaths.join(', ') : '(none)'}`,
    `- Shared paths: ${lane.sharedPaths.length > 0 ? lane.sharedPaths.join(', ') : '(none)'}`,
    '',
    '## Requirements',
    '- Keep output deterministic.',
    '- Do not edit files outside allowed/shared paths.',
    '- Raise conflicts instead of silently overlapping lane ownership.'
  ].join('\n');
};

export const writeOrchestratorArtifact = (contract: OrchestratorContract, outDir: string): OrchestratorArtifactWriteResult => {
  fs.mkdirSync(outDir, { recursive: true });

  const orchestratorPath = path.join(outDir, 'orchestrator.json');
  fs.writeFileSync(orchestratorPath, `${JSON.stringify(contract, null, 2)}\n`, 'utf8');

  const lanePromptPaths = contract.lanes.map((_, index) => {
    const promptPath = path.join(outDir, `lane-${index + 1}.prompt.md`);
    fs.writeFileSync(promptPath, `${lanePrompt(contract, index)}\n`, 'utf8');
    return promptPath;
  });

  return {
    outputDir: outDir,
    orchestratorPath,
    lanePromptPaths
  };
};
