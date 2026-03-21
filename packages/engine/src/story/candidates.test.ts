import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { generateStoryCandidates, promoteStoryCandidate, readStoryCandidatesArtifact, STORY_CANDIDATES_RELATIVE_PATH } from './candidates.js';
import { STORIES_RELATIVE_PATH, readStoriesArtifact } from './stories.js';

const createTempRepoFixture = (): { repoRoot: string } => ({
  repoRoot: fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-story-candidates-'))
});

const writeArtifact = (repo: string, relativePath: string, value: unknown): void => {
  const target = path.join(repo, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
};

describe('story candidates', () => {
  it('generateStoryCandidates derives grouped read-only candidates from governed evidence without mutating canonical backlog state', () => {
    const { repoRoot: repo } = createTempRepoFixture();

    writeArtifact(repo, '.playbook/improvement-candidates.json', {
      schemaVersion: '1.0',
      kind: 'improvement-candidates',
      generatedAt: '2026-03-18T00:00:00.000Z',
      opportunity_analysis: {
        top_recommendation: {
          opportunity_id: 'shared_read_aggregation_boundary',
          title: 'Converge broad artifact fanout through a shared read aggregation boundary',
          heuristic_class: 'broad_query_fanout',
          confidence: 0.92,
          why_it_matters: 'Direct artifact fanout should be grouped into one durable architecture change.',
          likely_change_shape: 'Extract a shared read model.',
          rationale: ['Many surfaces read the same governed artifacts.'],
          evidence: [{ file: 'packages/cli/src/commands/observer/index.ts', detail: 'multiple .playbook artifact reads' }]
        },
        secondary_queue: []
      }
    });
    writeArtifact(repo, '.playbook/execution-updated-state.json', {
      summary: {
        repos_needing_review: ['repo-a'],
        repos_needing_retry: ['repo-b'],
        stale_or_superseded_repo_ids: ['repo-c'],
        blocked_repo_ids: []
      },
      repos: [
        { repo_id: 'repo-a', reconciliation_status: 'completed_with_drift', blocker_codes: [], drift_prompt_ids: ['prompt-1'], prompt_ids: ['prompt-1'] },
        { repo_id: 'repo-b', reconciliation_status: 'partial', blocker_codes: ['apply_required'], drift_prompt_ids: [], prompt_ids: ['prompt-2'] },
        { repo_id: 'repo-c', reconciliation_status: 'stale_plan_or_superseded', blocker_codes: [], drift_prompt_ids: [], prompt_ids: [] }
      ]
    });

    writeArtifact(repo, '.playbook/patterns.json', {
      schemaVersion: '1.0',
      kind: 'promoted-patterns',
      patterns: [
        {
          id: 'pattern.shared-read-model',
          pattern_family: 'shared-read-model',
          title: 'Shared read model',
          description: 'Converge broad artifact fanout through one shared read boundary.',
          storySeed: {
            title: 'Adopt the shared read model doctrine',
            summary: 'Promoted doctrine suggests converging read fanout behind one shared boundary.',
            acceptance: ['Document the shared boundary.', 'Route implementation through pattern learning.']
          },
          source_artifact: '.playbook/pattern-candidates.json',
          signals: ['fanout'],
          confidence: 0.91,
          evidence_refs: ['docs/ARCHITECTURE.md'],
          status: 'active',
          provenance: {
            source_ref: 'global/pattern-candidates/shared-read-model',
            candidate_id: 'shared-read-model',
            candidate_fingerprint: 'candidate-fingerprint',
            promoted_at: '2026-03-20T00:00:00.000Z'
          },
          superseded_by: null,
          supersedes: [],
          retired_at: null,
          retirement_reason: null,
          demoted_at: null,
          demotion_reason: null,
          recalled_at: null,
          recall_reason: null,
          compatibility: null,
          risk_class: null,
          known_failure_modes: [],
          transferred_from: null,
          lifecycle_events: []
        }
      ]
    });
    writeArtifact(repo, '.playbook/router-recommendations.json', {
      recommendations: [
        {
          recommendation_id: 'route-1',
          task_family: 'story_derivation',
          current_strategy: 'ad-hoc',
          recommended_strategy: 'deterministic_local:story_candidates',
          rationale: 'Stable route evidence favors a candidate-first backlog flow.',
          confidence_score: 0.81
        }
      ]
    });

    const storiesPath = path.join(repo, STORIES_RELATIVE_PATH);
    const generated = generateStoryCandidates(repo);

    expect(generated.repo).toBe(path.basename(repo));
    expect(generated.candidates.length).toBeGreaterThanOrEqual(3);
    expect(generated.candidates.some((candidate) => candidate.title.includes('Restore governed readiness prerequisites'))).toBe(true);
    expect(generated.candidates.some((candidate) => candidate.title.includes('Converge broad artifact fanout'))).toBe(true);
    expect(generated.candidates.some((candidate) => candidate.title.includes('Replan stale or superseded'))).toBe(true);
    expect(generated.candidates.some((candidate) => candidate.title.includes('Adopt the shared read model doctrine'))).toBe(true);
    expect(fs.existsSync(storiesPath)).toBe(false);
    expect(readStoriesArtifact(repo).stories).toEqual([]);
  });

  it('readStoryCandidatesArtifact falls back to fresh derivation when the candidate artifact is absent', () => {
    const { repoRoot: repo } = createTempRepoFixture();

    const artifact = readStoryCandidatesArtifact(repo);

    expect(artifact.kind).toBe('story-candidates');
    expect(artifact.readOnly).toBe(true);
    expect(artifact.candidates.some((candidate) => candidate.title.includes('Restore governed readiness prerequisites'))).toBe(true);
  });

  it('promoteStoryCandidate explicitly writes canonical backlog state after candidates are inspectable', () => {
    const { repoRoot: repo } = createTempRepoFixture();
    writeArtifact(repo, STORY_CANDIDATES_RELATIVE_PATH, generateStoryCandidates(repo));

    const candidate = readStoryCandidatesArtifact(repo).candidates[0];
    expect(candidate).toBeTruthy();

    const storiesPath = path.join(repo, STORIES_RELATIVE_PATH);
    const promoted = promoteStoryCandidate(repo, candidate!.id);

    expect(promoted.artifactPath).toBe(storiesPath);
    expect(fs.existsSync(storiesPath)).toBe(true);
    expect(promoted.story.id).toBe(candidate!.id);
    expect(readStoriesArtifact(repo).stories.map((story) => story.id)).toEqual([candidate!.id]);
  });
});
