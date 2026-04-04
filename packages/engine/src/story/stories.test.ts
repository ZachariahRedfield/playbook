import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildStoryRouteTask,
  buildStableStoryReference,
  createDefaultStoriesArtifact,
  createStoryRecord,
  deriveStoryLifecycleStatus,
  deriveStoryTransitionPreview,
  linkStoryToPlan,
  readStoriesArtifact,
  reconcileStoryExecution,
  sortStoriesForBacklog,
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
  story_reference: 'story:story-1',
  evidence: ['objective'],
  rationale: 'Need durable intent',
  acceptance_criteria: ['emit route'],
  dependencies: [],
  execution_lane: null,
  suggested_route: 'docs_only',
  last_plan_ref: null,
  last_receipt_ref: null,
  last_updated_state_ref: null,
  reconciliation_status: null,
  planned_at: null,
  last_receipt_at: null,
  last_updated_state_at: null,
  reconciled_at: null
};

describe('story helpers', () => {
  it('derives a deterministic route task from story metadata', () => {
    expect(buildStoryRouteTask(baseStory)).toBe('update command docs: Update command docs');
    expect(buildStableStoryReference(baseStory.id)).toBe('story:story-1');
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

  it('links plans and reconciles receipt linkage idempotently without embedding downstream artifacts', () => {
    const planned = linkStoryToPlan({ ...createDefaultStoriesArtifact('repo'), stories: [baseStory] }, 'story-1', '.playbook/execution-plan.json', '2026-03-19T00:00:00.000Z');
    expect(planned.stories[0]?.last_plan_ref).toBe('.playbook/execution-plan.json');
    expect(planned.stories[0]?.reconciliation_status).toBe('in_progress');

    const reconciled = reconcileStoryExecution(planned, 'story-1', {
      receiptRef: '.playbook/execution-receipt.json',
      updatedStateRef: '.playbook/execution-updated-state.json',
      reconciledAt: '2026-03-19T01:00:00.000Z',
      event: 'receipt_completed'
    });
    expect(reconciled.outcome).toBe('applied');
    expect(reconciled.artifact.stories[0]?.last_receipt_ref).toBe('.playbook/execution-receipt.json');
    expect(reconciled.artifact.stories[0]?.last_updated_state_ref).toBe('.playbook/execution-updated-state.json');
    expect(reconciled.artifact.stories[0]?.reconciliation_status).toBe('completed');

    const replay = reconcileStoryExecution(reconciled.artifact, 'story-1', {
      receiptRef: '.playbook/execution-receipt.json',
      updatedStateRef: '.playbook/execution-updated-state.json',
      reconciledAt: '2026-03-19T01:00:00.000Z',
      event: 'receipt_completed'
    });
    expect(replay.outcome).toBe('noop');
  });

  it('preserves backward compatibility for stories without provenance and supports optional provenance on new records', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-stories-compat-'));
    const artifactPath = path.join(repoRoot, '.playbook', 'stories.json');
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
    fs.writeFileSync(artifactPath, `${JSON.stringify({ schemaVersion: '1.0', repo: 'repo', stories: [baseStory] }, null, 2)}\n`, 'utf8');

    expect(validateStoriesArtifact({ schemaVersion: '1.0', repo: 'repo', stories: [baseStory] })).toEqual([]);
    const persistedStory = readStoriesArtifact(repoRoot).stories[0];
    expect(persistedStory).toEqual(expect.objectContaining(baseStory));
    expect(persistedStory?.backlog_order).toBe(1);
    expect(persistedStory?.backlog_priority_score).toBe(332);
    expect(persistedStory?.backlog_unmet_dependencies).toEqual([]);
    expect(persistedStory?.backlog_score_explanation).toEqual([
      'priority:high=300',
      'severity:medium=20',
      'confidence:high=9',
      'status:ready=20',
      'type:governance=4',
      'unmet_dependencies:0=-0'
    ]);

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

  it('assigns deterministic priority scoring and stable tie-break ordering from explicit story fields', () => {
    const stories: StoryRecord[] = [
      { ...baseStory, id: 'story-b', title: 'B', priority: 'high', severity: 'high', confidence: 'high', dependencies: [] },
      { ...baseStory, id: 'story-a', title: 'A', priority: 'high', severity: 'high', confidence: 'high', dependencies: [] }
    ];
    const first = sortStoriesForBacklog(stories);
    const second = sortStoriesForBacklog(stories);
    expect(first.map((story) => story.id)).toEqual(['story-a', 'story-b']);
    expect(second).toEqual(first);
    expect(first[0]?.backlog_priority_score).toBeTypeOf('number');
    expect(first[0]?.backlog_score_explanation?.length).toBeGreaterThan(0);
    expect(first[0]?.backlog_order).toBe(1);
  });

  it('keeps dependency-blocked stories behind ready stories deterministically', () => {
    const ready: StoryRecord = { ...baseStory, id: 'ready-1', priority: 'medium', severity: 'medium', confidence: 'medium', status: 'ready', dependencies: [] };
    const blocked: StoryRecord = { ...baseStory, id: 'blocked-1', priority: 'urgent', severity: 'critical', confidence: 'high', status: 'ready', dependencies: ['missing-story'] };
    const ordered = sortStoriesForBacklog([blocked, ready]);
    expect(ordered.map((story) => story.id)).toEqual(['ready-1', 'blocked-1']);
    expect(ordered[1]?.backlog_unmet_dependencies).toEqual(['missing-story']);
  });
});
