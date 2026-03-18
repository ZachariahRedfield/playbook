import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { generateStoryCandidates, promoteStoryCandidate } from './candidates.js';
import { STORIES_RELATIVE_PATH, readStoriesArtifact } from './stories.js';

const createTempRepoFixture = (): { repoRoot: string } => ({
  repoRoot: fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-story-candidates-'))
});

describe('story candidates', () => {
  it('generateStoryCandidates does not mutate canonical backlog state', () => {
    const { repoRoot: repo } = createTempRepoFixture();
    expect(typeof repo).toBe('string');
    expect(repo.length).toBeGreaterThan(0);

    const storiesPath = path.join(repo, STORIES_RELATIVE_PATH);
    const generated = generateStoryCandidates(repo, [
      {
        id: 'story-candidate-1',
        title: 'Candidate only',
        type: 'feature',
        source: 'manual',
        severity: 'medium',
        priority: 'high',
        confidence: 'high',
        rationale: 'Generated from findings.',
        evidence: ['.playbook/session.json'],
        acceptance_criteria: ['Inspect candidate output'],
        dependencies: [],
        execution_lane: 'safe_single_pr',
        suggested_route: 'playbook route "candidate only" --json'
      }
    ]);

    expect(generated.repo).toBe(path.basename(repo));
    expect(generated.candidates).toHaveLength(1);
    expect(generated.candidates[0]?.id).toBe('story-candidate-1');
    expect(fs.existsSync(storiesPath)).toBe(false);
    expect(readStoriesArtifact(repo).stories).toEqual([]);
  });

  it('promoteStoryCandidate explicitly writes canonical backlog state', () => {
    const { repoRoot: repo } = createTempRepoFixture();
    expect(typeof repo).toBe('string');
    expect(repo.length).toBeGreaterThan(0);

    const storiesPath = path.join(repo, STORIES_RELATIVE_PATH);
    const generated = generateStoryCandidates(repo, [
      {
        id: 'story-candidate-2',
        title: 'Promoted candidate',
        type: 'governance',
        source: 'manual',
        severity: 'high',
        priority: 'urgent',
        confidence: 'medium',
        rationale: 'Promotion should persist canonical backlog state.',
        evidence: ['.playbook/policy-evaluation.json'],
        acceptance_criteria: ['Persist backlog entry'],
        dependencies: [],
        execution_lane: null,
        suggested_route: null
      }
    ]);

    expect(fs.existsSync(storiesPath)).toBe(false);

    const promoted = promoteStoryCandidate(repo, generated.candidates[0]!);

    expect(promoted.artifactPath).toBe(storiesPath);
    expect(fs.existsSync(storiesPath)).toBe(true);
    expect(promoted.story.id).toBe('story-candidate-2');
    expect(readStoriesArtifact(repo).stories.map((story) => story.id)).toEqual(['story-candidate-2']);
  });
});
