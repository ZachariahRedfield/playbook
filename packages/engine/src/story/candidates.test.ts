import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { generateStoryCandidates, promoteStoryCandidate, STORY_CANDIDATES_RELATIVE_PATH, STORIES_RELATIVE_PATH } from './candidates.js';

const tempDirs: string[] = [];

const createRepoRoot = (): string => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-story-'));
  tempDirs.push(repoRoot);
  return repoRoot;
};

const writeJson = (repoRoot: string, relativePath: string, payload: unknown): void => {
  const target = path.join(repoRoot, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(payload, null, 2));
};

afterEach(() => {
  while (tempDirs.length > 0) fs.rmSync(tempDirs.pop()!, { recursive: true, force: true });
});

describe('story candidates', () => {
  it('derives grouped candidates from deterministic evidence without mutating canonical backlog', () => {
    const repoRoot = createRepoRoot();
    expect(typeof repoRoot).toBe('string');
    expect(repoRoot.length).toBeGreaterThan(0);
    const repoName = path.basename(repoRoot);
    writeJson(repoRoot, '.playbook/repo-index.json', { framework: 'node' });
    writeJson(repoRoot, '.playbook/repo-graph.json', { edges: [] });
    writeJson(repoRoot, '.playbook/improvement-candidates.json', {
      schemaVersion: '1.0',
      kind: 'improvement-candidates',
      generatedAt: '2026-01-01T00:00:00.000Z',
      thresholds: { minimum_recurrence: 3, minimum_confidence: 0.6 },
      sourceArtifacts: { memoryEventsPath: '', learningStatePath: '', memoryEventCount: 0, learningStateAvailable: false },
      summary: { AUTO_SAFE: 0, CONVERSATIONAL: 1, GOVERNANCE: 1, total: 2 },
      router_recommendations: { recommendations: [], rejected_recommendations: [] },
      doctrine_candidates: { candidates: [], source_artifacts: [], generated_at: '2026-01-01T00:00:00.000Z', kind: 'knowledge-candidates', schemaVersion: '1.0' },
      doctrine_promotions: { transitions: [], generated_at: '2026-01-01T00:00:00.000Z', kind: 'knowledge-promotions', schemaVersion: '1.0' },
      command_improvements: { runtime_hardening: { proposals: [{ proposal_id: 'runtime-a', issue_type: 'repeated_verify_stage_failures', evidence_count: 2, supporting_runs: 2, proposed_improvement: 'harden verify stage', rationale: 'verify is noisy', confidence_score: 0.82, gating_tier: 'GOVERNANCE', blocking_reasons: [] }], rejected_proposals: [], open_questions: [] }, proposals: [], rejected_proposals: [] },
      opportunity_analysis: {
        top_recommendation: {
          opportunity_id: 'shared_read_aggregation_boundary',
          title: 'Converge reads',
          heuristic_class: 'broad_query_fanout',
          priority_score: 82,
          confidence: 0.88,
          why_it_matters: 'Too many direct reads',
          likely_change_shape: 'Add aggregation boundary',
          rationale: ['Grouped evidence matters'],
          evidence: [{ file: 'packages/cli/src/commands/story.ts', lines: [1, 2], detail: 'fanout' }]
        },
        secondary_queue: []
      },
      candidates: [
        { candidate_id: 'candidate-a', category: 'routing', observation: 'Docs route recurs', recurrence_count: 3, confidence_score: 0.75, suggested_action: 'stabilize docs route', gating_tier: 'GOVERNANCE', improvement_tier: 'governance', required_review: true, blocking_reasons: [], evidence: { event_ids: ['evt-1'] }, evidence_count: 3, supporting_runs: 2 },
        { candidate_id: 'candidate-b', category: 'routing', observation: 'CLI route recurs', recurrence_count: 4, confidence_score: 0.7, suggested_action: 'stabilize cli route', gating_tier: 'GOVERNANCE', improvement_tier: 'governance', required_review: true, blocking_reasons: [], evidence: { event_ids: ['evt-2'] }, evidence_count: 4, supporting_runs: 3 }
      ],
      rejected_candidates: []
    });
    writeJson(repoRoot, '.playbook/execution-receipt.json', { verification_summary: { planned_vs_actual_drift: ['lane drift detected'] } });
    writeJson(repoRoot, '.playbook/execution-updated-state.json', { summary: { by_reconciliation_status: { completed_with_drift: 1, stale_plan_or_superseded: 0 } } });

    const artifact = generateStoryCandidates(repoRoot, { generatedAt: '2026-01-02T00:00:00.000Z' });
    expect(artifact.repo).toBe(repoName);
    expect(artifact.candidates.length).toBeGreaterThanOrEqual(4);
    const routing = artifact.candidates.find((entry) => entry.candidate_id.includes('improvement-routing-governance'));
    expect(routing?.source_findings).toHaveLength(2);
    expect(routing?.promoted_story_id).toBeNull();
    expect(fs.existsSync(path.join(repoRoot, STORIES_RELATIVE_PATH))).toBe(false);
    expect(artifact.source_artifacts).toContain('.playbook/improvement-candidates.json');
  });

  it('promotes one candidate explicitly into canonical backlog state', () => {
    const repoRoot = createRepoRoot();
    expect(typeof repoRoot).toBe('string');
    expect(repoRoot.length).toBeGreaterThan(0);
    writeJson(repoRoot, '.playbook/repo-index.json', { framework: 'node' });
    writeJson(repoRoot, '.playbook/improvement-candidates.json', {
      schemaVersion: '1.0', kind: 'improvement-candidates', generatedAt: '2026-01-01T00:00:00.000Z',
      thresholds: { minimum_recurrence: 3, minimum_confidence: 0.6 }, sourceArtifacts: { memoryEventsPath: '', learningStatePath: '', memoryEventCount: 0, learningStateAvailable: false },
      summary: { AUTO_SAFE: 0, CONVERSATIONAL: 0, GOVERNANCE: 1, total: 1 },
      router_recommendations: { recommendations: [], rejected_recommendations: [] }, doctrine_candidates: { candidates: [], source_artifacts: [], generated_at: '2026-01-01T00:00:00.000Z', kind: 'knowledge-candidates', schemaVersion: '1.0' }, doctrine_promotions: { transitions: [], generated_at: '2026-01-01T00:00:00.000Z', kind: 'knowledge-promotions', schemaVersion: '1.0' },
      command_improvements: { runtime_hardening: { proposals: [], rejected_proposals: [], open_questions: [] }, proposals: [], rejected_proposals: [] },
      opportunity_analysis: { top_recommendation: null, secondary_queue: [] },
      candidates: [{ candidate_id: 'candidate-a', category: 'routing', observation: 'Docs route recurs', recurrence_count: 3, confidence_score: 0.75, suggested_action: 'stabilize docs route', gating_tier: 'GOVERNANCE', improvement_tier: 'governance', required_review: true, blocking_reasons: [], evidence: { event_ids: ['evt-1'] }, evidence_count: 3, supporting_runs: 2 }],
      rejected_candidates: []
    });

    const before = fs.existsSync(path.join(repoRoot, STORIES_RELATIVE_PATH)) ? fs.readFileSync(path.join(repoRoot, STORIES_RELATIVE_PATH), 'utf8') : null;
    const artifact = generateStoryCandidates(repoRoot, { generatedAt: '2026-01-02T00:00:00.000Z' });
    const promoted = promoteStoryCandidate(repoRoot, artifact.candidates[0]!.candidate_id);
    expect(promoted.story.id).toContain('story-');
    const stories = JSON.parse(fs.readFileSync(path.join(repoRoot, STORIES_RELATIVE_PATH), 'utf8')) as { stories: Array<{ id: string }> };
    expect(stories.stories).toHaveLength(1);
    expect(stories.stories[0]!.id).toBe(promoted.story.id);
    expect(fs.existsSync(path.join(repoRoot, STORY_CANDIDATES_RELATIVE_PATH))).toBe(true);
    expect(before).toBeNull();
  });
});
