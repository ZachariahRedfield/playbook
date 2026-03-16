import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { generateTransferPlansArtifact, writeTransferPlansArtifact } from './transferPlanning.js';

const createRepo = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-transfer-plans-'));

const writeJson = (repoRoot: string, relativePath: string, value: unknown): void => {
  const targetPath = path.join(repoRoot, relativePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, JSON.stringify(value, null, 2));
};

const writeBaseArtifacts = (
  repoRoot: string,
  options?: { confidenceScore?: number; evidenceRuns?: number; includeRouter?: boolean; includeCompaction?: boolean }
): void => {
  const confidenceScore = options?.confidenceScore ?? 0.83;
  const evidenceRuns = options?.evidenceRuns ?? 4;

  writeJson(repoRoot, '.playbook/pattern-portability.json', {
    schemaVersion: '1.0',
    kind: 'pattern-portability',
    generatedAt: '2026-08-01T00:00:00.000Z',
    runs: [
      {
        run_id: 'portability-run-1',
        generatedAt: '2026-08-01T00:00:00.000Z',
        source_repo: 'repo-source',
        target_repo: 'repo-target',
        evidence_runs: evidenceRuns,
        scores: [
          {
            pattern_id: 'router_over_fragmented_knowledge_lifecycle',
            source_repo: 'repo-source',
            target_repo: 'repo-target',
            evidence_runs: evidenceRuns,
            structural_similarity: 0.85,
            dependency_compatibility: 0.82,
            governance_risk: 0.2,
            confidence_score: confidenceScore
          }
        ]
      }
    ]
  });

  writeJson(repoRoot, '.playbook/cross-repo-patterns.json', {
    schemaVersion: '1.0',
    kind: 'cross-repo-patterns',
    generatedAt: '2026-08-02T00:00:00.000Z',
    repositories: [],
    aggregates: [{ pattern_id: 'router_over_fragmented_knowledge_lifecycle', portability_score: 0.81 }]
  });

  writeJson(repoRoot, '.playbook/portability-confidence.json', {
    schemaVersion: '1.0',
    kind: 'portability-confidence',
    generatedAt: '2026-08-03T00:00:00.000Z',
    sourceArtifacts: {},
    summaries: [
      {
        source_pattern_family: 'knowledge_lifecycle',
        source_repo: 'repo-source',
        target_repo: 'repo-target',
        prior_confidence_average: 0.78,
        realized_success_rate: 0.8,
        recalibrated_confidence: 0.82,
        recommended_adjustment: 0.04,
        sample_size: evidenceRuns,
        open_questions: []
      }
    ]
  });

  if (options?.includeRouter !== false) {
    writeJson(repoRoot, '.playbook/router-recommendations.json', {
      schemaVersion: '1.0',
      kind: 'router-recommendations',
      generatedAt: '2026-08-03T00:00:00.000Z',
      proposalOnly: true,
      nonAutonomous: true,
      sourceArtifacts: {},
      recommendations: [
        {
          recommendation_id: 'router_over_fragmented_knowledge_lifecycle',
          task_family: 'knowledge_lifecycle',
          current_strategy: 'aggressive-fragmentation',
          recommended_strategy: 'reduce-fragmentation-lanes',
          evidence_count: 4,
          supporting_runs: 2,
          confidence_score: 0.8,
          rationale: 'lane telemetry converges',
          gating_tier: 'CONVERSATIONAL'
        }
      ],
      rejected_recommendations: []
    });
  }

  if (options?.includeCompaction !== false) {
    writeJson(repoRoot, '.playbook/learning-compaction.json', {
      schemaVersion: '1.0',
      kind: 'learning-compaction',
      generatedAt: '2026-08-04T00:00:00.000Z',
      sourceArtifacts: {},
      summary: {
        summary_id: 'summary-1',
        source_run_ids: ['run-1'],
        time_window: { start: '2026-07-01T00:00:00.000Z', end: '2026-07-31T00:00:00.000Z' },
        route_patterns: [],
        lane_patterns: [],
        validation_patterns: [{ validation_key: 'contracts', observation_count: 3, bottleneck_rate: 0.2, avg_duration_ms: 44 }],
        recurring_failures: [],
        recurring_successes: [],
        confidence: 0.76,
        open_questions: []
      }
    });
  }
};

describe('transfer planning', () => {
  it('generates transfer plans for high-confidence portable patterns', () => {
    const repo = createRepo();
    writeBaseArtifacts(repo, { confidenceScore: 0.86, evidenceRuns: 5 });

    const artifact = generateTransferPlansArtifact(repo);
    expect(artifact.plans).toHaveLength(1);
    expect(artifact.plans[0]?.pattern_id).toBe('router_over_fragmented_knowledge_lifecycle');
    expect(artifact.plans[0]?.portability_confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('excludes low-confidence portability candidates', () => {
    const repo = createRepo();
    writeBaseArtifacts(repo, { confidenceScore: 0.42, evidenceRuns: 4 });

    const artifact = generateTransferPlansArtifact(repo);
    expect(artifact.plans).toHaveLength(0);
  });

  it('adds open questions when evidence is sparse and upstream artifacts are partial', () => {
    const repo = createRepo();
    writeBaseArtifacts(repo, { confidenceScore: 0.88, evidenceRuns: 1, includeRouter: false, includeCompaction: false });

    const artifact = generateTransferPlansArtifact(repo);
    expect(artifact.plans).toHaveLength(1);
    expect(artifact.plans[0]?.open_questions.some((question) => question.includes('Sparse transfer evidence'))).toBe(true);
    expect(artifact.plans[0]?.open_questions.some((question) => question.includes('No matching router recommendation'))).toBe(true);
  });

  it('produces deterministic ordering for equal-confidence plans', () => {
    const repo = createRepo();
    writeBaseArtifacts(repo, { confidenceScore: 0.83, evidenceRuns: 5 });

    const portabilityPath = path.join(repo, '.playbook/pattern-portability.json');
    const artifact = JSON.parse(fs.readFileSync(portabilityPath, 'utf8')) as { runs: Array<{ scores: unknown[] }> };
    artifact.runs[0]?.scores.push({
      pattern_id: 'router_under_fragmented_improvement_engine',
      source_repo: 'repo-source',
      target_repo: 'repo-target',
      evidence_runs: 5,
      structural_similarity: 0.85,
      dependency_compatibility: 0.82,
      governance_risk: 0.2,
      confidence_score: 0.83
    });
    fs.writeFileSync(portabilityPath, JSON.stringify(artifact, null, 2));

    writeJson(repo, '.playbook/cross-repo-patterns.json', {
      schemaVersion: '1.0',
      kind: 'cross-repo-patterns',
      generatedAt: '2026-08-02T00:00:00.000Z',
      repositories: [],
      aggregates: [
        { pattern_id: 'router_over_fragmented_knowledge_lifecycle', portability_score: 0.81 },
        { pattern_id: 'router_under_fragmented_improvement_engine', portability_score: 0.81 }
      ]
    });

    writeJson(repo, '.playbook/portability-confidence.json', {
      schemaVersion: '1.0',
      kind: 'portability-confidence',
      generatedAt: '2026-08-03T00:00:00.000Z',
      sourceArtifacts: {},
      summaries: [
        {
          source_pattern_family: 'improvement_engine',
          source_repo: 'repo-source',
          target_repo: 'repo-target',
          prior_confidence_average: 0.78,
          realized_success_rate: 0.8,
          recalibrated_confidence: 0.82,
          recommended_adjustment: 0.04,
          sample_size: 5,
          open_questions: []
        },
        {
          source_pattern_family: 'knowledge_lifecycle',
          source_repo: 'repo-source',
          target_repo: 'repo-target',
          prior_confidence_average: 0.78,
          realized_success_rate: 0.8,
          recalibrated_confidence: 0.82,
          recommended_adjustment: 0.04,
          sample_size: 5,
          open_questions: []
        }
      ]
    });

    const transfer = generateTransferPlansArtifact(repo);
    expect(transfer.plans.map((plan) => plan.pattern_id)).toEqual([
      'router_over_fragmented_knowledge_lifecycle',
      'router_under_fragmented_improvement_engine'
    ]);

    const targetPath = writeTransferPlansArtifact(repo, transfer);
    const persisted = JSON.parse(fs.readFileSync(targetPath, 'utf8')) as { plans: Array<{ pattern_id: string }> };
    expect(persisted.plans.map((plan) => plan.pattern_id)).toEqual([
      'router_over_fragmented_knowledge_lifecycle',
      'router_under_fragmented_improvement_engine'
    ]);
  });
});
