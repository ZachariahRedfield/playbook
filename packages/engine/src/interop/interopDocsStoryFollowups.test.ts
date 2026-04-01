import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { compileInteropDocsStoryFollowups } from './interopDocsStoryFollowups.js';
import type { InteropUpdatedTruthArtifact } from './playbookLifelineInterop.js';

const createRepo = (name: string): string => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));
  fs.mkdirSync(path.join(repo, '.playbook'), { recursive: true });
  return repo;
};

const writeUpdatedTruth = (repo: string, updates: InteropUpdatedTruthArtifact['updates']): void => {
  const artifact: InteropUpdatedTruthArtifact = {
    schemaVersion: '1.0',
    kind: 'interop-updated-truth-artifact',
    contract: {
      sourceHash: 'fitness-contract-hash',
      sourceRef: 'main',
      sourcePath: 'fawxzzy-fitness/src/lib/ecosystem/fitness-integration-contract.ts'
    },
    updates
  };
  fs.writeFileSync(path.join(repo, '.playbook', 'interop-updated-truth.json'), `${JSON.stringify(artifact, null, 2)}\n`);
};

describe('compileInteropDocsStoryFollowups', () => {
  it('materializes deterministic docs/story followups only for completed revise_weekly_goal_plan outcomes', () => {
    const repo = createRepo('playbook-engine-interop-docs-story-followups');
    writeUpdatedTruth(repo, [
      {
        receiptId: 'receipt-1',
        requestId: 'request-1',
        action: 'revise_weekly_goal_plan',
        receiptType: 'goal_plan_amended',
        sourceHash: 'fitness-contract-hash',
        canonicalOutcomeSummary: { outcome: 'completed', detail: 'Goal plan revised after review.', completedAt: '2026-03-30T00:00:00.000Z' },
        boundedStateDelta: { requestState: 'completed', outputArtifactPath: '.playbook/rendezvous-manifest.json', outputSha256: 'sha-1' },
        memoryProvenanceRefs: ['.playbook/lifeline-interop-runtime.json'],
        nextActionHints: ['Sync docs/story followup.']
      },
      {
        receiptId: 'receipt-2',
        requestId: 'request-2',
        action: 'adjust_upcoming_workout_load',
        receiptType: 'schedule_adjustment_applied',
        sourceHash: 'fitness-contract-hash',
        canonicalOutcomeSummary: { outcome: 'completed', detail: 'Not part of bounded docs/story case.', completedAt: '2026-03-30T00:01:00.000Z' },
        boundedStateDelta: { requestState: 'completed', outputArtifactPath: null, outputSha256: null },
        memoryProvenanceRefs: ['.playbook/lifeline-interop-runtime.json'],
        nextActionHints: []
      },
      {
        receiptId: 'receipt-3',
        requestId: 'request-3',
        action: 'revise_weekly_goal_plan',
        receiptType: 'goal_plan_amended',
        sourceHash: 'fitness-contract-hash',
        canonicalOutcomeSummary: { outcome: 'blocked', detail: 'Blocked should stay noise-free.', completedAt: '2026-03-30T00:02:00.000Z' },
        boundedStateDelta: { requestState: 'blocked', outputArtifactPath: null, outputSha256: null },
        memoryProvenanceRefs: ['.playbook/lifeline-interop-runtime.json'],
        nextActionHints: []
      }
    ]);

    const first = compileInteropDocsStoryFollowups(repo);
    const firstRaw = fs.readFileSync(path.join(repo, '.playbook', 'interop-docs-story-followups.json'), 'utf8');
    const second = compileInteropDocsStoryFollowups(repo);
    const secondRaw = fs.readFileSync(path.join(repo, '.playbook', 'interop-docs-story-followups.json'), 'utf8');

    expect(first.artifactPath).toBe('.playbook/interop-docs-story-followups.json');
    expect(second.artifactPath).toBe('.playbook/interop-docs-story-followups.json');
    expect(firstRaw).toBe(secondRaw);

    expect(first.docsStoryFollowups.reviewOnly).toBe(true);
    expect(first.docsStoryFollowups.proposalOnly).toBe(true);
    expect(first.docsStoryFollowups.authority).toEqual({ mutation: 'read-only', promotion: 'review-required' });

    expect(first.docsStoryFollowups.followups).toHaveLength(2);
    expect(first.docsStoryFollowups.followups.map((entry) => entry.followupId)).toEqual([
      'docs-story-followup-receipt-1-docs',
      'docs-story-followup-receipt-1-story'
    ]);

    const docs = first.docsStoryFollowups.followups.find((entry) => entry.recommendedSurface === 'docs');
    const story = first.docsStoryFollowups.followups.find((entry) => entry.recommendedSurface === 'story');
    expect(docs?.targetPath).toBe('docs/PLAYBOOK_PRODUCT_ROADMAP.md');
    expect(story?.targetStoryId).toBe('interop-followup:request-1:receipt-1');

    expect(first.docsStoryFollowups.followups.every((entry) => entry.action === 'revise_weekly_goal_plan')).toBe(true);
    expect(first.docsStoryFollowups.followups.every((entry) => entry.canonicalOutcomeSummary.outcome === 'completed')).toBe(true);
  });

  it('rejects non-canonical path overrides', () => {
    const repo = createRepo('playbook-engine-interop-docs-story-followups-paths');
    writeUpdatedTruth(repo, []);

    expect(() => compileInteropDocsStoryFollowups(repo, { updatedTruthPath: '.playbook/not-updated-truth.json' })).toThrow(/only canonical/);
    expect(() => compileInteropDocsStoryFollowups(repo, { artifactPath: '.playbook/not-docs-story-followups.json' })).toThrow(/only canonical/);
  });
});
