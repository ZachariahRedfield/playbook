import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { buildLanePromptFilename, renderLanePrompt, writeLanePrompts, type LanePromptSpec } from '../src/execution/lanePrompts.js';

const sampleLane: LanePromptSpec = {
  objective: 'Implement lane-scoped prompt rendering.',
  whyThisLaneExists: 'To isolate deterministic prompt generation for the lane.',
  allowedFilesToModify: ['packages/engine/src/execution/**'],
  fragmentOnlySingletonDocs: ['docs/CHANGELOG.md'],
  forbiddenFilesToModify: ['packages/cli/**', 'README.md'],
  sharedFilesPolicy: 'Coordinate shared files through merge notes before editing.',
  dependenciesWaveInfo: 'Depends on wave 1 schema stabilization.',
  shardOwnershipInfo: 'Shard key: packages-engine.',
  implementationPlan: ['Define schema.', 'Render markdown.', 'Write output files.'],
  verificationSteps: ['pnpm -r build', 'pnpm --filter @zachariahredfield/playbook-engine test'],
  documentationUpdates: ['Update docs/commands/README.md if command surface changes.'],
  mergeNotes: ['Keep diff lane-scoped.'],
  laneOwnershipConstraints: ['Only mutate files under packages/engine/src/execution.']
};

describe('lane prompt rendering', () => {
  it('renders required sections and explicit ownership warning text', () => {
    const prompt = renderLanePrompt({ laneNumber: 1, lane: sampleLane });

    expect(prompt).toContain('## Objective');
    expect(prompt).toContain('## Why this lane exists');
    expect(prompt).toContain('## Allowed direct-edit files');
    expect(prompt).toContain('## Fragment-only protected docs');
    expect(prompt).toContain('## Forbidden files to modify');
    expect(prompt).toContain('## Shared files policy');
    expect(prompt).toContain('## Dependencies / wave info');
    expect(prompt).toContain('## Shard ownership');
    expect(prompt).toContain('Shard key: packages-engine.');
    expect(prompt).toContain('## Implementation plan');
    expect(prompt).toContain('## Verification steps');
    expect(prompt).toContain('## Documentation updates');
    expect(prompt).toContain('## Merge notes');
    expect(prompt).toContain('Protected singleton docs are **fragment-only**');
    expect(prompt).toContain('**Do not modify outside allowed direct-edit paths.**');
    expect(prompt).toContain('[Ownership constraint] Only mutate files under packages/engine/src/execution.');
  });

  it('writes deterministic prompt filenames to target output directory', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'lane-prompts-'));

    try {
      const written = writeLanePrompts({
        outputDir,
        lanes: [sampleLane, { ...sampleLane, objective: 'Second lane objective.' }]
      });

      expect(written.map((filePath) => basename(filePath))).toEqual(['lane-1.prompt.md', 'lane-2.prompt.md']);
      expect(readFileSync(join(outputDir, 'lane-1.prompt.md'), 'utf8')).toContain('# Lane 1 Prompt');
      expect(readFileSync(join(outputDir, 'lane-2.prompt.md'), 'utf8')).toContain('# Lane 2 Prompt');
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('buildLanePromptFilename returns deterministic names', () => {
    expect(buildLanePromptFilename(1)).toBe('lane-1.prompt.md');
    expect(buildLanePromptFilename(4)).toBe('lane-4.prompt.md');
  });
});
