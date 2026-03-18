import { describe, expect, it } from 'vitest';
import {
  buildStoryRouteTask,
  createDefaultStoriesArtifact,
  deriveStoryLifecycleStatus,
  transitionStoryFromEvent,
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
});
