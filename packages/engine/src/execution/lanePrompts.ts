import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export type LanePromptSpec = {
  objective: string;
  whyThisLaneExists: string;
  allowedFilesToModify: string[];
  forbiddenFilesToModify: string[];
  sharedFilesPolicy: string;
  dependenciesWaveInfo: string;
  shardOwnershipInfo: string;
  implementationPlan: string[];
  verificationSteps: string[];
  documentationUpdates: string[];
  mergeNotes: string[];
  laneOwnershipConstraints: string[];
};

export type RenderLanePromptInput = {
  laneNumber: number;
  lane: LanePromptSpec;
};

export type WriteLanePromptsInput = {
  outputDir: string;
  lanes: LanePromptSpec[];
};

const toBulletList = (items: string[]): string =>
  items.length === 0 ? '- None specified.' : items.map((entry) => `- ${entry}`).join('\n');

export const renderLanePrompt = ({ laneNumber, lane }: RenderLanePromptInput): string => {
  const normalizedLaneNumber = Number.isInteger(laneNumber) && laneNumber > 0 ? laneNumber : 1;

  return [
    `# Lane ${normalizedLaneNumber} Prompt`,
    '',
    '> **Lane ownership constraints (read first):**',
    '> - This lane owns only the paths listed in **Allowed files to modify**.',
    '> - **Do not modify outside allowed paths.** If work appears to require it, stop and escalate in merge notes.',
    '> - Respect lane-local ownership constraints before making any edits.',
    '',
    '## Objective',
    lane.objective,
    '',
    '## Why this lane exists',
    lane.whyThisLaneExists,
    '',
    '## Allowed files to modify',
    toBulletList(lane.allowedFilesToModify),
    '',
    '## Forbidden files to modify',
    toBulletList(lane.forbiddenFilesToModify),
    '',
    '## Shared files policy',
    lane.sharedFilesPolicy,
    '',
    '## Dependencies / wave info',
    lane.dependenciesWaveInfo,
    '',
    '## Shard ownership',
    lane.shardOwnershipInfo,
    '',
    '## Implementation plan',
    toBulletList(lane.implementationPlan),
    '',
    '## Verification steps',
    toBulletList(lane.verificationSteps),
    '',
    '## Documentation updates',
    toBulletList(lane.documentationUpdates),
    '',
    '## Merge notes',
    toBulletList([
      ...lane.laneOwnershipConstraints.map((constraint) => `[Ownership constraint] ${constraint}`),
      ...lane.mergeNotes
    ]),
    ''
  ].join('\n');
};

export const buildLanePromptFilename = (laneNumber: number): string => {
  const normalizedLaneNumber = Number.isInteger(laneNumber) && laneNumber > 0 ? laneNumber : 1;
  return `lane-${normalizedLaneNumber}.prompt.md`;
};

export const writeLanePrompts = ({ outputDir, lanes }: WriteLanePromptsInput): string[] => {
  mkdirSync(outputDir, { recursive: true });

  return lanes.map((lane, index) => {
    const laneNumber = index + 1;
    const fileName = buildLanePromptFilename(laneNumber);
    const outputPath = resolve(outputDir, fileName);
    const prompt = renderLanePrompt({ laneNumber, lane });

    writeFileSync(outputPath, `${prompt.endsWith('\n') ? prompt : `${prompt}\n`}`, 'utf8');

    return outputPath;
  });
};
