import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildStoryRouteTask,
  createDefaultStoriesArtifact,
  createStoryRecord,
  deriveStoryLifecycleStatus,
  deriveStoryTransitionPreview,
  readStoriesArtifact,
  transitionStoryFromEvent,
  validateStoriesArtifact,
  type StoryRecord,
} from './stories.js';

const baseStory: StoryRecord = {
  id: 'story-1',
  repo: 'repo',
  title: 'Update command docs',
  type: 'governance',
  source: 'manual',
  severity: 'medium',
  priority: 'high',
  confidence: 'high',
  status: 'ready',
  evidence: ['objective'],
  rationale: 'Need durable intent',
  acceptance_criteria: ['emit route'],
  dependencies: [],
  execution_lane: null,
  suggested_route: 'docs_only'
};

describe('story helpers', () => {
  it('derives a deterministic route task from story metadata', () => {
    expect(buildStoryRouteTask(baseStory)).toBe('update command docs: Update command docs');
  });

  it('applies conservative lifecycle transitions only when deterministic evidence exists', () => {
    expect(deriveStoryTransitionPreview({ ...createDefaultStoriesArtifact('repo'), stories: [baseStory] }, 'story-1', 'planned')).toEqual({
      story_id: 'story-1',
      previous_status: 'ready',
      next_status: 'in_progress'
    });
    expect(deriveStoryLifecycleStatus(baseStory, 'planned')).toBe('in_progress');
    expect(deriveStoryLifecycleStatus({ ...baseStory, status: 'in_progress' }, 'receipt_completed')).toBe('done');
    expect(deriveStoryLifecycleStatus({ ...baseStory, status: 'in_progress' }, 'receipt_blocked')).toBe('blocked');
    expect(deriveStoryLifecycleStatus({ ...baseStory, status: 'proposed' }, 'receipt_completed')).toBeNull();
  });

  it('preserves artifact state when a lifecycle event does not imply a transition', () => {
    const artifact = {
      ...createDefaultStoriesArtifact('repo'),
      stories: [{ ...baseStory, status: 'blocked' }],
    };
    expect(transitionStoryFromEvent(artifact, 'story-1', 'planned')).toEqual(artifact);
  });

  it('preserves backward compatibility for stories without provenance and supports optional provenance on new records', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-stories-compat-'));
    const artifactPath = path.join(repoRoot, '.playbook', 'stories.json');
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
    fs.writeFileSync(artifactPath, `${JSON.stringify({ schemaVersion: '1.0', repo: 'repo', stories: [baseStory] }, null, 2)}\n`, 'utf8');

    expect(validateStoriesArtifact({ schemaVersion: '1.0', repo: 'repo', stories: [baseStory] })).toEqual([]);
    expect(readStoriesArtifact(repoRoot).stories[0]).toEqual(baseStory);

    const withProvenance = createStoryRecord('repo', {
      ...baseStory,
      repo: undefined as never,
      status: undefined,
      provenance: {
        sourceRefs: [{ repoId: 'repo', artifactPath: '.playbook/story-candidates.json', entryId: 'story-1', fingerprint: 'fp-1' }]
      }
    });
    expect(withProvenance.provenance?.sourceRefs[0]?.entryId).toBe('story-1');
    fs.rmSync(repoRoot, { recursive: true, force: true });
  });
});
