import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ImprovementCandidate, RouterRecommendationsArtifact } from './candidateEngine.js';
import { generateDoctrinePromotionArtifacts } from './doctrinePromotion.js';

const createRepo = (): string => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-doctrine-'));
  fs.mkdirSync(path.join(repo, '.playbook', 'memory', 'events'), { recursive: true });
  return repo;
};

const baseRouterRecommendations = (): RouterRecommendationsArtifact => ({
  schemaVersion: '1.0',
  kind: 'router-recommendations',
  generatedAt: '2026-01-01T00:00:00.000Z',
  proposalOnly: true,
  nonAutonomous: true,
  sourceArtifacts: {
    learningStatePath: '.playbook/learning-state.json',
    learningCompactionPath: '.playbook/learning-compaction.json',
    processTelemetryPath: '.playbook/process-telemetry.json',
    outcomeTelemetryPath: '.playbook/outcome-telemetry.json',
    memoryEventsPath: '.playbook/memory/events/*'
  },
  recommendations: [],
  rejected_recommendations: []
});

const makeImprovementCandidate = (overrides: Partial<ImprovementCandidate> = {}): ImprovementCandidate => ({
  candidate_id: 'routing_docs',
  category: 'routing',
  observation: 'Recurring docs route',
  recurrence_count: 4,
  confidence_score: 0.84,
  suggested_action: 'codify docs route',
  gating_tier: 'CONVERSATIONAL',
  improvement_tier: 'conversation',
  required_review: true,
  blocking_reasons: [],
  evidence: { event_ids: ['run:1', 'run:2', 'run:3'] },
  evidence_count: 3,
  supporting_runs: 3,
  ...overrides
});

describe('generateDoctrinePromotionArtifacts', () => {
  it('creates promotion candidates with required doctrine fields', () => {
    const repo = createRepo();
    const artifacts = generateDoctrinePromotionArtifacts({
      repoRoot: repo,
      improvementCandidates: [makeImprovementCandidate()],
      routerRecommendations: baseRouterRecommendations(),
      compactedLearning: undefined
    });

    const candidate = artifacts.candidatesArtifact.candidates.find((entry) => entry.candidate_id === 'improvement_routing_docs');
    expect(candidate).toBeDefined();
    expect(candidate?.source_evidence.length).toBeGreaterThan(0);
    expect(candidate?.related_artifacts).toContain('.playbook/improvement-candidates.json');
    expect(candidate?.lifecycle_stage).toBe('promoted');
  });

  it('supports compacted-to-promoted transition when evidence and confidence are sufficient', () => {
    const repo = createRepo();
    const artifacts = generateDoctrinePromotionArtifacts({
      repoRoot: repo,
      improvementCandidates: [makeImprovementCandidate()],
      routerRecommendations: baseRouterRecommendations(),
      compactedLearning: {
        summary_id: 'summary-1',
        source_run_ids: ['r1', 'r2', 'r3'],
        time_window: { start: '2026-01-01T00:00:00.000Z', end: '2026-01-02T00:00:00.000Z' },
        route_patterns: [],
        lane_patterns: [],
        validation_patterns: [],
        recurring_failures: [],
        recurring_successes: [],
        confidence: 0.9,
        open_questions: []
      }
    });

    const transition = artifacts.promotionsArtifact.transitions.find((entry) => entry.candidate_id === 'improvement_routing_docs');
    expect(transition?.from_stage).toBe('candidate');
    expect(transition?.to_stage).toBe('promoted');
  });

  it('rejects promotion with insufficient evidence by keeping lifecycle below promoted', () => {
    const repo = createRepo();
    const artifacts = generateDoctrinePromotionArtifacts({
      repoRoot: repo,
      improvementCandidates: [
        makeImprovementCandidate({
          candidate_id: 'weak_signal',
          confidence_score: 0.55,
          evidence: { event_ids: ['run:1'] },
          evidence_count: 1,
          supporting_runs: 1
        })
      ],
      routerRecommendations: baseRouterRecommendations(),
      compactedLearning: undefined
    });

    const transition = artifacts.promotionsArtifact.transitions.find((entry) => entry.candidate_id === 'improvement_weak_signal');
    expect(transition?.to_stage).not.toBe('promoted');
  });

  it('proposes retirement when previously promoted doctrine loses repeated evidence', () => {
    const repo = createRepo();
    fs.writeFileSync(
      path.join(repo, '.playbook', 'knowledge-candidates.json'),
      JSON.stringify({
        schemaVersion: '1.0',
        kind: 'knowledge-candidates',
        generatedAt: '2026-01-01T00:00:00.000Z',
        proposalOnly: true,
        nonAutonomous: true,
        candidates: [
          {
            candidate_id: 'legacy_promoted',
            source_evidence: ['event:a', 'event:b', 'event:c'],
            related_runs: ['run-1', 'run-2'],
            related_artifacts: ['.playbook/improvement-candidates.json'],
            pattern_family: 'routing',
            confidence_score: 0.9,
            lifecycle_stage: 'promoted',
            promotion_rationale: 'legacy',
            retirement_rationale: null,
            gating_tier: 'CONVERSATIONAL'
          }
        ]
      })
    );

    const artifacts = generateDoctrinePromotionArtifacts({
      repoRoot: repo,
      improvementCandidates: [makeImprovementCandidate()],
      routerRecommendations: baseRouterRecommendations(),
      compactedLearning: undefined
    });

    expect(artifacts.candidatesArtifact.candidates.some((entry) => entry.candidate_id === 'legacy_promoted' && entry.lifecycle_stage === 'retired')).toBe(true);
  });

  it('keeps governance-gated promotions compacted without approval and promotes with approval', () => {
    const repo = createRepo();
    const governanceCandidate = makeImprovementCandidate({
      candidate_id: 'governance_route',
      gating_tier: 'GOVERNANCE',
      improvement_tier: 'governance'
    });

    const unapproved = generateDoctrinePromotionArtifacts({
      repoRoot: repo,
      improvementCandidates: [governanceCandidate],
      routerRecommendations: baseRouterRecommendations(),
      compactedLearning: undefined
    });

    const unapprovedTransition = unapproved.promotionsArtifact.transitions.find((entry) => entry.candidate_id === 'improvement_governance_route');
    expect(unapprovedTransition?.to_stage).toBe('compacted');

    fs.writeFileSync(
      path.join(repo, '.playbook', 'improvement-approvals.json'),
      JSON.stringify({
        schemaVersion: '1.0',
        kind: 'improvement-governance-approvals',
        updatedAt: '2026-01-01T00:00:00.000Z',
        approvals: [{ proposal_id: 'improvement_governance_route', approvedAt: '2026-01-01T00:00:00.000Z' }]
      })
    );

    const approved = generateDoctrinePromotionArtifacts({
      repoRoot: repo,
      improvementCandidates: [governanceCandidate],
      routerRecommendations: baseRouterRecommendations(),
      compactedLearning: undefined
    });

    const approvedTransition = approved.promotionsArtifact.transitions.find((entry) => entry.candidate_id === 'improvement_governance_route');
    expect(approvedTransition?.to_stage).toBe('promoted');
  });
});
