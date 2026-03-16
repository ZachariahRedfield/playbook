import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { evaluateImprovementPolicy } from '../src/policy/proposalEvaluator.js';

const createRepo = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-policy-evaluator-'));

const writeImprovementCandidates = (repoRoot: string, candidates: Array<Record<string, unknown>>): void => {
  const artifactPath = path.join(repoRoot, '.playbook', 'improvement-candidates.json');
  fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
  fs.writeFileSync(
    artifactPath,
    JSON.stringify(
      {
        schemaVersion: '1.0',
        kind: 'improvement-candidates',
        generatedAt: '2026-01-01T00:00:00.000Z',
        thresholds: { minimum_recurrence: 3, minimum_confidence: 0.6 },
        sourceArtifacts: { memoryEventsPath: '.playbook/memory/events', learningStatePath: '.playbook/learning-state.json', memoryEventCount: 0, learningStateAvailable: false },
        summary: { AUTO_SAFE: 0, CONVERSATIONAL: 0, GOVERNANCE: 0, total: candidates.length },
        router_recommendations: { schemaVersion: '1.0', kind: 'router-recommendations', generatedAt: '2026-01-01T00:00:00.000Z', proposalOnly: true, nonAutonomous: true, sourceArtifacts: { learningStatePath: '', learningCompactionPath: '', processTelemetryPath: '', outcomeTelemetryPath: '', memoryEventsPath: '' }, recommendations: [], rejected_recommendations: [] },
        doctrine_candidates: { schemaVersion: '1.0', kind: 'doctrine-promotion-candidates', generatedAt: '2026-01-01T00:00:00.000Z', proposalOnly: true, sourceArtifacts: { memoryCandidatesPath: '', processTelemetryPath: '', outcomeTelemetryPath: '' }, candidates: [] },
        doctrine_promotions: { schemaVersion: '1.0', kind: 'doctrine-promotions', generatedAt: '2026-01-01T00:00:00.000Z', proposalOnly: true, transitions: [], approvals: [] },
        command_improvements: { schemaVersion: '1.0', kind: 'command-improvements', generatedAt: '2026-01-01T00:00:00.000Z', proposalOnly: true, nonAutonomous: true, thresholds: { minimum_evidence_count: 0, high_failure_rate_threshold: 0, low_confidence_threshold: 0, high_warning_open_question_rate_threshold: 0, high_latency_peer_ratio_threshold: 0, repeated_partial_failure_rate_threshold: 0 }, sourceArtifacts: { commandQualityPath: '', commandQualitySummariesPath: [], memoryEventsPath: '', commandQualityAvailable: false, cycleHistoryPath: '', cycleStatePath: '', cycleTelemetrySummaryPath: '', cycleRegressionsPath: '', cycleTelemetrySummaryAvailable: false, cycleRegressionsAvailable: false, cycleHistoryAvailable: false, cycleStateAvailable: false }, runtime_hardening: { proposals: [], rejected_proposals: [], open_questions: [] }, proposals: [], rejected_proposals: [] },
        candidates,
        rejected_candidates: []
      },
      null,
      2
    )
  );
};

describe('evaluateImprovementPolicy', () => {
  it('returns deterministic empty output when no proposals exist', () => {
    const repo = createRepo();
    const artifact = evaluateImprovementPolicy(repo);

    expect(artifact.evaluations).toEqual([]);
    expect(artifact.summary).toEqual({ safe: 0, requires_review: 0, blocked: 0, total: 0 });

    fs.rmSync(repo, { recursive: true, force: true });
  });

  it('classifies strong narrow-scope evidence as safe', () => {
    const repo = createRepo();
    writeImprovementCandidates(repo, [
      {
        candidate_id: 'candidate-safe',
        category: 'ontology',
        observation: 'stable ontology signal',
        recurrence_count: 2,
        confidence_score: 0.9,
        suggested_action: 'keep',
        gating_tier: 'CONVERSATIONAL',
        improvement_tier: 'conversation',
        required_review: false,
        blocking_reasons: [],
        evidence: { event_ids: ['e1', 'e2', 'e3', 'e4'] },
        evidence_count: 4,
        supporting_runs: 2
      }
    ]);

    const artifact = evaluateImprovementPolicy(repo);

    expect(artifact.evaluations[0]?.decision).toBe('safe');

    fs.rmSync(repo, { recursive: true, force: true });
  });

  it('classifies repeated failures as requires_review', () => {
    const repo = createRepo();
    writeImprovementCandidates(repo, [
      {
        candidate_id: 'candidate-repeated',
        category: 'orchestration',
        observation: 'stage repeatedly failing',
        recurrence_count: 6,
        confidence_score: 0.8,
        suggested_action: 'review',
        gating_tier: 'GOVERNANCE',
        improvement_tier: 'governance',
        required_review: true,
        blocking_reasons: [],
        evidence: { event_ids: ['e1', 'e2', 'e3', 'e4', 'e5'] },
        evidence_count: 5,
        supporting_runs: 3
      }
    ]);

    const artifact = evaluateImprovementPolicy(repo);

    expect(artifact.evaluations[0]?.decision).toBe('requires_review');

    fs.rmSync(repo, { recursive: true, force: true });
  });

  it('classifies weak evidence as blocked', () => {
    const repo = createRepo();
    writeImprovementCandidates(repo, [
      {
        candidate_id: 'candidate-blocked',
        category: 'routing',
        observation: 'weak signal',
        recurrence_count: 1,
        confidence_score: 0.42,
        suggested_action: 'do thing',
        gating_tier: 'CONVERSATIONAL',
        improvement_tier: 'conversation',
        required_review: true,
        blocking_reasons: [],
        evidence: { event_ids: ['e1'] },
        evidence_count: 1,
        supporting_runs: 1
      }
    ]);

    const artifact = evaluateImprovementPolicy(repo);

    expect(artifact.evaluations[0]?.decision).toBe('blocked');

    fs.rmSync(repo, { recursive: true, force: true });
  });

  it('orders policy evaluations deterministically by proposal id', () => {
    const repo = createRepo();
    writeImprovementCandidates(repo, [
      {
        candidate_id: 'zeta',
        category: 'ontology',
        observation: 'z',
        recurrence_count: 2,
        confidence_score: 0.8,
        suggested_action: 'z',
        gating_tier: 'CONVERSATIONAL',
        improvement_tier: 'conversation',
        required_review: false,
        blocking_reasons: [],
        evidence: { event_ids: ['e1', 'e2', 'e3', 'e4'] },
        evidence_count: 4,
        supporting_runs: 2
      },
      {
        candidate_id: 'alpha',
        category: 'ontology',
        observation: 'a',
        recurrence_count: 2,
        confidence_score: 0.8,
        suggested_action: 'a',
        gating_tier: 'CONVERSATIONAL',
        improvement_tier: 'conversation',
        required_review: false,
        blocking_reasons: [],
        evidence: { event_ids: ['e1', 'e2', 'e3', 'e4'] },
        evidence_count: 4,
        supporting_runs: 2
      }
    ]);

    const artifact = evaluateImprovementPolicy(repo);

    expect(artifact.evaluations.map((entry) => entry.proposal_id)).toEqual(['alpha', 'zeta']);

    fs.rmSync(repo, { recursive: true, force: true });
  });
});
