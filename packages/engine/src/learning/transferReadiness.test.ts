import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { PatternPortabilityRun } from './patternPortability.js';
import { generateTransferReadinessArtifact, writeTransferReadinessArtifact } from './transferReadiness.js';

const createRepo = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-transfer-readiness-'));

const writeJson = (repoRoot: string, relativePath: string, payload: unknown): void => {
  const targetPath = path.join(repoRoot, relativePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, JSON.stringify(payload, null, 2));
};

const writeTargetSignals = (
  repoRoot: string,
  input: {
    validations?: string[];
    openQuestions?: string[];
    failures?: Array<{ signal_id: string; family: string; confidence: number }>;
    withProcessTelemetry?: boolean;
    withRouterRecommendations?: boolean;
    withPlaybookConfig?: boolean;
    withAiContract?: boolean;
  }
): void => {
  writeJson(repoRoot, '.playbook/learning-compaction.json', {
    schemaVersion: '1.0',
    kind: 'learning-compaction',
    generatedAt: '2026-09-01T00:00:00.000Z',
    summary: {
      validation_patterns: (input.validations ?? []).map((validation) => ({ validation_key: validation })),
      recurring_failures: input.failures ?? [],
      open_questions: input.openQuestions ?? []
    }
  });

  if (input.withRouterRecommendations) {
    writeJson(repoRoot, '.playbook/router-recommendations.json', {
      schemaVersion: '1.0',
      kind: 'router-recommendations',
      recommendations: [{ recommendation_id: 'r-1', task_family: 'knowledge_lifecycle' }]
    });
  }

  if (input.withProcessTelemetry) {
    writeJson(repoRoot, '.playbook/process-telemetry.json', { schemaVersion: '1.0', kind: 'process-telemetry', runs: [] });
  }

  if (input.withAiContract) {
    writeJson(repoRoot, '.playbook/ai-contract.json', { schemaVersion: '1.0', kind: 'playbook-ai-contract' });
  }

  if (input.withPlaybookConfig) {
    writeJson(repoRoot, 'playbook.config.json', { verify: { rules: {} } });
  }
};

const portabilityRun = (scores: PatternPortabilityRun['scores']): PatternPortabilityRun => ({
  run_id: 'portability-1',
  generatedAt: '2026-09-02T00:00:00.000Z',
  source_repo: 'source-repo',
  target_repo: 'target-repo',
  evidence_runs: 4,
  scores
});

describe('transfer readiness assessment', () => {
  it('marks a ready target repository when prerequisites are present', () => {
    const target = createRepo();
    writeTargetSignals(target, {
      validations: ['pnpm -r build', 'pnpm test', 'pnpm playbook verify --ci --json'],
      withProcessTelemetry: true,
      withRouterRecommendations: true,
      withPlaybookConfig: true,
      withAiContract: true
    });

    const artifact = generateTransferReadinessArtifact({
      targetRepoRoot: target,
      targetRepoId: 'target-repo',
      portabilityRun: portabilityRun([
        {
          pattern_id: 'portable_observation_engine_knowledge_lifecycle_governance_kernel',
          source_repo: 'source-repo',
          target_repo: 'target-repo',
          evidence_runs: 6,
          structural_similarity: 0.9,
          dependency_compatibility: 0.9,
          governance_risk: 0.1,
          confidence_score: 0.94
        }
      ])
    });

    expect(artifact.assessments[0]?.recommendation).toBe('ready');
    expect(artifact.assessments[0]?.blockers).toEqual([]);
    expect(artifact.assessments[0]?.readiness_score).toBeGreaterThanOrEqual(0.85);
  });

  it('marks partial readiness when only some prerequisites are present', () => {
    const target = createRepo();
    writeTargetSignals(target, {
      validations: ['pnpm test'],
      withRouterRecommendations: true,
      withPlaybookConfig: true
    });

    const artifact = generateTransferReadinessArtifact({
      targetRepoRoot: target,
      targetRepoId: 'target-repo',
      portabilityRun: portabilityRun([
        {
          pattern_id: 'portable_observation_engine_knowledge_lifecycle',
          source_repo: 'source-repo',
          target_repo: 'target-repo',
          evidence_runs: 4,
          structural_similarity: 0.7,
          dependency_compatibility: 0.6,
          governance_risk: 0.2,
          confidence_score: 0.72
        }
      ])
    });

    expect(artifact.assessments[0]?.recommendation).toBe('partial');
    expect(artifact.assessments[0]?.missing_prerequisites.length).toBeGreaterThan(0);
    expect(artifact.assessments[0]?.readiness_score).toBeLessThan(0.75);
  });

  it('marks blocked readiness when governance blockers exist', () => {
    const target = createRepo();
    writeTargetSignals(target, {
      validations: ['pnpm -r build', 'pnpm test'],
      withProcessTelemetry: true,
      withRouterRecommendations: true,
      failures: [{ signal_id: 'policy.governance.contract-missing', family: 'validation-policy', confidence: 0.8 }]
    });

    const artifact = generateTransferReadinessArtifact({
      targetRepoRoot: target,
      targetRepoId: 'target-repo',
      portabilityRun: portabilityRun([
        {
          pattern_id: 'portable_governance_kernel',
          source_repo: 'source-repo',
          target_repo: 'target-repo',
          evidence_runs: 5,
          structural_similarity: 0.8,
          dependency_compatibility: 0.7,
          governance_risk: 0.7,
          confidence_score: 0.66
        }
      ])
    });

    expect(artifact.assessments[0]?.recommendation).toBe('blocked');
    expect(artifact.assessments[0]?.blockers.some((blocker) => blocker.includes('policy.governance.contract-missing'))).toBe(true);
  });

  it('captures sparse-evidence open questions without auto-accepting missing prerequisites', () => {
    const target = createRepo();
    writeTargetSignals(target, {
      validations: ['pnpm -r build'],
      withPlaybookConfig: true
    });

    const artifact = generateTransferReadinessArtifact({
      targetRepoRoot: target,
      targetRepoId: 'target-repo',
      portabilityRun: portabilityRun([
        {
          pattern_id: 'portable_knowledge_lifecycle',
          source_repo: 'source-repo',
          target_repo: 'target-repo',
          evidence_runs: 1,
          structural_similarity: 0.55,
          dependency_compatibility: 0.45,
          governance_risk: 0.3,
          confidence_score: 0.5
        }
      ])
    });

    expect(artifact.assessments[0]?.open_questions.some((question) => question.includes('Sparse transfer evidence'))).toBe(true);
    expect(artifact.assessments[0]?.missing_prerequisites.length).toBeGreaterThan(0);
    expect(artifact.assessments[0]?.recommendation).not.toBe('ready');
  });

  it('writes deterministically ordered assessments for worker consumption', () => {
    const target = createRepo();
    writeTargetSignals(target, {
      validations: ['pnpm -r build', 'pnpm test'],
      withRouterRecommendations: true,
      withPlaybookConfig: true
    });

    const artifact = generateTransferReadinessArtifact({
      targetRepoRoot: target,
      targetRepoId: 'target-repo',
      portabilityRun: portabilityRun([
        {
          pattern_id: 'portable_knowledge_lifecycle',
          source_repo: 'source-repo',
          target_repo: 'target-repo',
          evidence_runs: 4,
          structural_similarity: 0.7,
          dependency_compatibility: 0.6,
          governance_risk: 0.2,
          confidence_score: 0.7
        },
        {
          pattern_id: 'portable_governance_kernel',
          source_repo: 'source-repo',
          target_repo: 'target-repo',
          evidence_runs: 4,
          structural_similarity: 0.6,
          dependency_compatibility: 0.5,
          governance_risk: 0.3,
          confidence_score: 0.65
        }
      ])
    });

    const targetPath = writeTransferReadinessArtifact(target, artifact);
    const persisted = JSON.parse(fs.readFileSync(targetPath, 'utf8')) as { assessments: Array<{ pattern_id: string }> };
    const persistedOrder = persisted.assessments.map((entry) => entry.pattern_id);
    const sortedOrder = [...persistedOrder].sort((left, right) => left.localeCompare(right));

    expect(targetPath).toBe(path.join(target, '.playbook/transfer-readiness.json'));
    expect(persistedOrder).toEqual(sortedOrder);
  });
});
